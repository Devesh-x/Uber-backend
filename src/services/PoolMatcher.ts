import { Booking, RidePool, Cab, PoolParticipant } from '../models/types';
import { db } from '../utils/database';
import { RidePoolingAlgorithm } from '../algorithms/RidePoolingAlgorithm';
import { RouteOptimizer } from '../algorithms/RouteOptimizer';
import { PricingEngine } from './PricingEngine';
import { BookingService } from './BookingService';
import { generatePoolCode } from '../utils/helpers';
import { redisClient } from '../utils/redis';
import { logger } from '../utils/logger';

// Orchestrates pooling with concurrency control
export class PoolMatcher {
    private algorithm: RidePoolingAlgorithm;
    private routeOptimizer: RouteOptimizer;
    private pricingEngine: PricingEngine;
    private bookingService: BookingService;

    constructor() {
        this.algorithm = new RidePoolingAlgorithm();
        this.routeOptimizer = new RouteOptimizer();
        this.pricingEngine = new PricingEngine();
        this.bookingService = new BookingService();
    }

    // Runs matching process using distributed locks to prevent conflicts
    public async runMatching(): Promise<void> {
        // Acquire distributed lock
        const lockAcquired = await redisClient.acquireLock('pool_matching', 10000);
        if (!lockAcquired) {
            logger.info('Another matching process is running, skipping');
            return;
        }

        try {
            logger.info('Starting pool matching process');

            // Get pending bookings
            const pendingBookings = await this.bookingService.getPendingBookings();
            if (pendingBookings.length === 0) {
                logger.info('No pending bookings to match');
                return;
            }

            // Get existing forming pools
            const existingPools = await this.getFormingPools();

            // Get available cabs
            const availableCabs = await this.getAvailableCabs();

            // Run matching algorithm
            const { updatedPools, newPools } = this.algorithm.matchRides(
                pendingBookings,
                existingPools,
                availableCabs
            );

            // Process updated pools
            for (const [poolId, bookings] of updatedPools.entries()) {
                await this.updatePool(poolId, bookings);
            }

            // Process new pools
            for (const [poolCode, bookings] of newPools.entries()) {
                await this.createPool(poolCode, bookings);
            }

            logger.info('Pool matching process completed');
        } catch (error) {
            logger.error('Error in matching process', error);
            throw error;
        } finally {
            await redisClient.releaseLock('pool_matching');
        }
    }


    private async createPool(poolCode: string, bookings: Booking[]): Promise<void> {
        const client = await db.getClient();

        try {
            await client.query('BEGIN');

            // Calculate optimized route
            const route = this.routeOptimizer.optimize(bookings);

            // Calculate totals
            const totalSeats = bookings.reduce((sum, b) => sum + b.seats_required, 0);
            const totalLuggage = bookings.reduce((sum, b) => sum + b.luggage_count, 0);

            // Create pool
            const poolResult = await client.query(
                `INSERT INTO ride_pools (
                    pool_code, status, total_seats_used, total_luggage,
                    total_distance_km, total_duration_minutes, optimized_route_json
                ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                [
                    poolCode,
                    'forming',
                    totalSeats,
                    totalLuggage,
                    route.total_distance_km,
                    route.total_duration_minutes,
                    JSON.stringify(route.waypoints),
                ]
            );

            const pool: RidePool = poolResult.rows[0];

            // Add participants and update booking prices
            for (const booking of bookings) {
                // Find sequences in route
                const pickupSeq = route.waypoints.findIndex(
                    w => w.booking_id === booking.id && w.type === 'pickup'
                );
                const dropoffSeq = route.waypoints.findIndex(
                    w => w.booking_id === booking.id && w.type === 'dropoff'
                );

                // Calculate individual distance
                const { distance, duration } = this.routeOptimizer.calculatePassengerDistance(
                    route.waypoints,
                    booking.id!
                );

                // Add to pool_participants
                await client.query(
                    `INSERT INTO pool_participants (
                        pool_id, booking_id, pickup_sequence, dropoff_sequence,
                        individual_distance_km, individual_duration_minutes, discount_percentage
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [pool.id, booking.id, pickupSeq, dropoffSeq, distance, duration, 30.0]
                );

                // Update booking status and recalculate price
                const newPrice = await this.pricingEngine.calculatePrice(booking, true);
                await client.query(
                    `UPDATE bookings SET status = $1, final_price = $2 WHERE id = $3`,
                    ['matched', newPrice, booking.id]
                );
            }

            await client.query('COMMIT');
            logger.info(`Created pool ${poolCode} with ${bookings.length} bookings`);
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error creating pool', error);
            throw error;
        } finally {
            client.release();
        }
    }


    private async updatePool(poolId: number, bookings: Booking[]): Promise<void> {
        const client = await db.getClient();

        try {
            await client.query('BEGIN');

            // Recalculate route with all bookings
            const route = this.routeOptimizer.optimize(bookings);

            // Update pool
            const totalSeats = bookings.reduce((sum, b) => sum + b.seats_required, 0);
            const totalLuggage = bookings.reduce((sum, b) => sum + b.luggage_count, 0);

            await client.query(
                `UPDATE ride_pools SET 
                    total_seats_used = $1, total_luggage = $2,
                    total_distance_km = $3, total_duration_minutes = $4,
                    optimized_route_json = $5, updated_at = CURRENT_TIMESTAMP
                WHERE id = $6`,
                [
                    totalSeats,
                    totalLuggage,
                    route.total_distance_km,
                    route.total_duration_minutes,
                    JSON.stringify(route.waypoints),
                    poolId,
                ]
            );

            // Update all participants with new sequences
            for (const booking of bookings) {
                const pickupSeq = route.waypoints.findIndex(
                    w => w.booking_id === booking.id && w.type === 'pickup'
                );
                const dropoffSeq = route.waypoints.findIndex(
                    w => w.booking_id === booking.id && w.type === 'dropoff'
                );

                const { distance, duration } = this.routeOptimizer.calculatePassengerDistance(
                    route.waypoints,
                    booking.id!
                );

                // Update or insert participant
                await client.query(
                    `INSERT INTO pool_participants (
                        pool_id, booking_id, pickup_sequence, dropoff_sequence,
                        individual_distance_km, individual_duration_minutes, discount_percentage
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (pool_id, booking_id) DO UPDATE SET
                        pickup_sequence = $3, dropoff_sequence = $4,
                        individual_distance_km = $5, individual_duration_minutes = $6`,
                    [poolId, booking.id, pickupSeq, dropoffSeq, distance, duration, 30.0]
                );

                // Recalculate price
                const newPrice = await this.pricingEngine.calculatePrice(booking, true);
                await client.query(
                    `UPDATE bookings SET final_price = $1 WHERE id = $2`,
                    [newPrice, booking.id]
                );
            }

            await client.query('COMMIT');
            logger.info(`Updated pool ${poolId} with ${bookings.length} bookings`);
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error updating pool', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Handles cancellation validation and pool rebalancing
    public async handleCancellation(bookingId: number): Promise<void> {
        const lockAcquired = await redisClient.acquireLock(`cancel_${bookingId}`, 5000);
        if (!lockAcquired) {
            throw new Error('Cancellation already in progress');
        }

        try {
            // Get associated pool
            const poolResult = await db.query(
                `SELECT pp.pool_id, pp.id as participant_id
                FROM pool_participants pp
                WHERE pp.booking_id = $1`,
                [bookingId]
            );

            if (poolResult.rows.length === 0) {
                // No pool association, just cancel booking
                await this.bookingService.cancelBooking(bookingId);
                return;
            }

            const { pool_id, participant_id } = poolResult.rows[0];

            // Remove from pool
            await db.query('DELETE FROM pool_participants WHERE id = $1', [participant_id]);

            // Get remaining bookings in pool
            const remainingResult = await db.query(
                `SELECT b.* FROM bookings b
                JOIN pool_participants pp ON b.id = pp.booking_id
                WHERE pp.pool_id = $1`,
                [pool_id]
            );

            if (remainingResult.rows.length === 0) {
                // Pool is empty, delete it
                await db.query('DELETE FROM ride_pools WHERE id = $1', [pool_id]);
            } else {
                // Rebalance pool
                await this.updatePool(pool_id, remainingResult.rows);
            }

            // Cancel booking
            await this.bookingService.cancelBooking(bookingId);
            logger.info(`Cancelled booking ${bookingId} and rebalanced pool ${pool_id}`);
        } finally {
            await redisClient.releaseLock(`cancel_${bookingId}`);
        }
    }


    private async getFormingPools(): Promise<RidePool[]> {
        const result = await db.query("SELECT * FROM ride_pools WHERE status = 'forming'");
        return result.rows;
    }


    private async getAvailableCabs(): Promise<Cab[]> {
        const result = await db.query("SELECT * FROM cabs WHERE status = 'available'");
        return result.rows;
    }


    public async getPoolDetails(poolId: number): Promise<any> {
        const poolResult = await db.query('SELECT * FROM ride_pools WHERE id = $1', [poolId]);
        if (poolResult.rows.length === 0) {
            return null;
        }

        const pool = poolResult.rows[0];

        // Get participants
        const participantsResult = await db.query(
            `SELECT pp.*, b.pickup_address, b.dropoff_address, p.name as passenger_name
            FROM pool_participants pp
            JOIN bookings b ON pp.booking_id = b.id
            JOIN passengers p ON b.passenger_id = p.id
            WHERE pp.pool_id = $1
            ORDER BY pp.pickup_sequence`,
            [poolId]
        );

        return {
            ...pool,
            participants: participantsResult.rows,
            optimized_route: JSON.parse(pool.optimized_route_json || '[]'),
        };
    }
}
