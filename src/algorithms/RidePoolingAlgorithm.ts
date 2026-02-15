import { Booking, RidePool, Cab } from '../models/types';
import { RouteOptimizer } from './RouteOptimizer';
import { calculateDistance, calculateDetour, isWithinRadius } from '../utils/helpers';
import { logger } from '../utils/logger';

/**
 * Ride Pooling Algorithm
 * Groups passengers into shared cabs using Modified Greedy Matching with Constraint Satisfaction
 * 
 * Time Complexity: O(n log n + n*k^2) where k << n (typically k <= 4)
 * Space Complexity: O(n + m) where m = number of pools
 */
export class RidePoolingAlgorithm {
    private routeOptimizer: RouteOptimizer;
    private maxPoolSize: number;
    private proximityRadiusKm: number;

    constructor(maxPoolSize: number = 4, proximityRadiusKm: number = 5) {
        this.routeOptimizer = new RouteOptimizer();
        this.maxPoolSize = maxPoolSize;
        this.proximityRadiusKm = proximityRadiusKm;
    }

    /**
     * Main matching algorithm
     * @param pendingBookings Array of bookings awaiting matching
     * @param existingPools Currently forming pools
     * @param availableCabs Available cabs for new pools
     * @returns Updated pools with matched bookings
     */
    public matchRides(
        pendingBookings: Booking[],
        existingPools: RidePool[],
        availableCabs: Cab[]
    ): { updatedPools: Map<number, Booking[]>; newPools: Map<string, Booking[]> } {
        logger.info(`Starting ride matching for ${pendingBookings.length} bookings`);

        // Sort bookings by creation time (FIFO fairness)
        const sortedBookings = [...pendingBookings].sort(
            (a, b) => (a.created_at?.getTime() || 0) - (b.created_at?.getTime() || 0)
        );

        const updatedPools = new Map<number, Booking[]>();
        const newPools = new Map<string, Booking[]>();
        const unmatched: Booking[] = [];

        for (const booking of sortedBookings) {
            let matched = false;

            // Try to add to existing pools first
            for (const pool of existingPools) {
                if (updatedPools.has(pool.id!)) {
                    const poolBookings = updatedPools.get(pool.id!)!;
                    if (this.canAddToPool(booking, poolBookings, pool)) {
                        poolBookings.push(booking);
                        matched = true;
                        logger.debug(`Added booking ${booking.id} to existing pool ${pool.id}`);
                        break;
                    }
                }
            }

            // Try to create a new pool or add to newly created pools
            if (!matched) {
                let addedToNewPool = false;

                for (const [poolCode, poolBookings] of newPools.entries()) {
                    if (this.canAddToNewPool(booking, poolBookings)) {
                        poolBookings.push(booking);
                        addedToNewPool = true;
                        logger.debug(`Added booking ${booking.id} to new pool ${poolCode}`);
                        break;
                    }
                }

                if (!addedToNewPool) {
                    // Create a new pool with this booking
                    const poolCode = `POOL_${Date.now()}_${Math.random().toString(36).substring(7)}`;
                    newPools.set(poolCode, [booking]);
                    logger.debug(`Created new pool ${poolCode} with booking ${booking.id}`);
                }
            }
        }

        logger.info(`Matching complete. Updated pools: ${updatedPools.size}, New pools: ${newPools.size}`);
        return { updatedPools, newPools };
    }

    /**
     * Check if a booking can be added to an existing pool
     */
    private canAddToPool(booking: Booking, poolBookings: Booking[], pool: RidePool): boolean {
        // Check seat capacity
        const totalSeats = poolBookings.reduce((sum, b) => sum + b.seats_required, booking.seats_required);
        if (totalSeats > this.maxPoolSize) {
            return false;
        }

        // Check luggage capacity (assuming max 3 per 4-seater cab)
        const maxLuggage = Math.floor(this.maxPoolSize * 0.75);
        const totalLuggage = poolBookings.reduce((sum, b) => sum + b.luggage_count, booking.luggage_count);
        if (totalLuggage > maxLuggage) {
            return false;
        }

        // Check route compatibility
        const testBookings = [...poolBookings, booking];
        return this.checkRouteConstraints(testBookings);
    }

    /**
     * Check if a booking can be added to a newly forming pool
     */
    private canAddToNewPool(booking: Booking, poolBookings: Booking[]): boolean {
        // Pool not yet full
        if (poolBookings.length >= this.maxPoolSize) {
            return false;
        }

        // Check capacity constraints
        const totalSeats = poolBookings.reduce((sum, b) => sum + b.seats_required, booking.seats_required);
        if (totalSeats > this.maxPoolSize) {
            return false;
        }

        const maxLuggage = Math.floor(this.maxPoolSize * 0.75);
        const totalLuggage = poolBookings.reduce((sum, b) => sum + b.luggage_count, booking.luggage_count);
        if (totalLuggage > maxLuggage) {
            return false;
        }

        // Check route compatibility
        const testBookings = [...poolBookings, booking];
        return this.checkRouteConstraints(testBookings);
    }

    /**
     * Check if all bookings in a pool satisfy route constraints
     * - Proximity: pickups/dropoffs within reasonable radius
     * - Detour tolerance: no passenger exceeds their max detour
     */
    private checkRouteConstraints(bookings: Booking[]): boolean {
        if (bookings.length === 1) {
            return true;
        }

        // Check proximity: all pickups should be relatively close
        const pickupLocations = bookings.map(b => ({ lat: b.pickup_lat, lng: b.pickup_lng }));
        for (let i = 0; i < pickupLocations.length; i++) {
            for (let j = i + 1; j < pickupLocations.length; j++) {
                if (!isWithinRadius(pickupLocations[i], pickupLocations[j], this.proximityRadiusKm)) {
                    logger.debug('Bookings too far apart for pooling');
                    return false;
                }
            }
        }

        // Optimize route and check detour tolerance
        try {
            const optimizedRoute = this.routeOptimizer.optimize(bookings);

            for (const booking of bookings) {
                // Calculate direct distance
                const directDistance = calculateDistance(
                    { lat: booking.pickup_lat, lng: booking.pickup_lng },
                    { lat: booking.dropoff_lat, lng: booking.dropoff_lng }
                );

                // Calculate shared route distance
                const { distance: sharedDistance } = this.routeOptimizer.calculatePassengerDistance(
                    optimizedRoute.waypoints,
                    booking.id!
                );

                // Calculate detour in minutes
                const detourMinutes = calculateDetour(directDistance, sharedDistance);

                // Check if detour exceeds tolerance
                if (detourMinutes > booking.detour_tolerance_minutes) {
                    logger.debug(`Booking ${booking.id} detour ${detourMinutes}min exceeds tolerance ${booking.detour_tolerance_minutes}min`);
                    return false;
                }
            }

            return true;
        } catch (error) {
            logger.error('Error checking route constraints', error);
            return false;
        }
    }

    /**
     * Calculate compatibility score for pool matching (lower is better)
     * Used for ranking multiple compatible pools
     */
    public calculatePoolScore(booking: Booking, poolBookings: Booking[]): number {
        let score = 0;

        // Factor 1: Number of existing passengers (prefer fuller pools)
        score += (this.maxPoolSize - poolBookings.length) * 10;

        // Factor 2: Average proximity to existing bookings
        const avgDistance = poolBookings.reduce((sum, pb) => {
            return sum + calculateDistance(
                { lat: booking.pickup_lat, lng: booking.pickup_lng },
                { lat: pb.pickup_lat, lng: pb.pickup_lng }
            );
        }, 0) / poolBookings.length;
        score += avgDistance;

        return score;
    }
}
