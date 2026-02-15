import { Booking } from '../models/types';
import { db } from '../utils/database';
import { PricingEngine } from './PricingEngine';
import { calculateDistance, calculateTravelTime } from '../utils/helpers';
import { logger } from '../utils/logger';

/**
 * Booking Service
 * Handles CRUD operations for bookings
 */
export class BookingService {
    private pricingEngine: PricingEngine;

    constructor() {
        this.pricingEngine = new PricingEngine();
    }

    /**
     * Create a new booking
     */
    public async createBooking(bookingData: Partial<Booking>): Promise<Booking> {
        try {
            // Calculate estimated distance and duration
            const distance = calculateDistance(
                { lat: bookingData.pickup_lat!, lng: bookingData.pickup_lng! },
                { lat: bookingData.dropoff_lat!, lng: bookingData.dropoff_lng! }
            );
            const duration = calculateTravelTime(distance);

            // Calculate base price
            const basePrice = await this.pricingEngine.calculatePrice({
                ...bookingData,
                estimated_distance_km: distance,
                estimated_duration_minutes: duration,
            } as Booking, false);

            // Insert booking
            const result = await db.query(
                `INSERT INTO bookings (
                    passenger_id, pickup_lat, pickup_lng, pickup_address,
                    dropoff_lat, dropoff_lng, dropoff_address,
                    seats_required, luggage_count, detour_tolerance_minutes,
                    estimated_distance_km, estimated_duration_minutes,
                    base_price, final_price, status, requested_pickup_time
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                RETURNING *`,
                [
                    bookingData.passenger_id,
                    bookingData.pickup_lat,
                    bookingData.pickup_lng,
                    bookingData.pickup_address || null,
                    bookingData.dropoff_lat,
                    bookingData.dropoff_lng,
                    bookingData.dropoff_address || null,
                    bookingData.seats_required || 1,
                    bookingData.luggage_count || 0,
                    bookingData.detour_tolerance_minutes || 15,
                    distance,
                    duration,
                    basePrice,
                    basePrice, // Initially same as base price
                    'pending',
                    bookingData.requested_pickup_time || null,
                ]
            );

            const booking: Booking = result.rows[0];
            logger.info(`Booking created: ${booking.id}`);
            return booking;
        } catch (error) {
            logger.error('Error creating booking', error);
            throw error;
        }
    }

    /**
     * Get booking by ID
     */
    public async getBooking(bookingId: number): Promise<Booking | null> {
        try {
            const result = await db.query('SELECT * FROM bookings WHERE id = $1', [bookingId]);
            return result.rows.length > 0 ? result.rows[0] : null;
        } catch (error) {
            logger.error('Error fetching booking', error);
            throw error;
        }
    }

    /**
     * Get all pending bookings
     */
    public async getPendingBookings(): Promise<Booking[]> {
        try {
            const result = await db.query(
                "SELECT * FROM bookings WHERE status = 'pending' ORDER BY created_at ASC"
            );
            return result.rows;
        } catch (error) {
            logger.error('Error fetching pending bookings', error);
            throw error;
        }
    }

    /**
     * Update booking status
     */
    public async updateBookingStatus(bookingId: number, status: Booking['status']): Promise<void> {
        try {
            await db.query(
                'UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [status, bookingId]
            );
            logger.info(`Booking ${bookingId} status updated to ${status}`);
        } catch (error) {
            logger.error('Error updating booking status', error);
            throw error;
        }
    }

    /**
     * Update booking final price
     */
    public async updateBookingPrice(bookingId: number, finalPrice: number): Promise<void> {
        try {
            await db.query(
                'UPDATE bookings SET final_price = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [finalPrice, bookingId]
            );
            logger.info(`Booking ${bookingId} price updated to ${finalPrice}`);
        } catch (error) {
            logger.error('Error updating booking price', error);
            throw error;
        }
    }

    /**
     * Cancel a booking
     */
    public async cancelBooking(bookingId: number): Promise<void> {
        try {
            const booking = await this.getBooking(bookingId);
            if (!booking) {
                throw new Error('Booking not found');
            }

            if (booking.status === 'completed' || booking.status === 'cancelled') {
                throw new Error('Cannot cancel completed or already cancelled booking');
            }

            await this.updateBookingStatus(bookingId, 'cancelled');
            logger.info(`Booking ${bookingId} cancelled`);
        } catch (error) {
            logger.error('Error cancelling booking', error);
            throw error;
        }
    }

    /**
     * Get bookings for a passenger
     */
    public async getPassengerBookings(passengerId: number): Promise<Booking[]> {
        try {
            const result = await db.query(
                'SELECT * FROM bookings WHERE passenger_id = $1 ORDER BY created_at DESC',
                [passengerId]
            );
            return result.rows;
        } catch (error) {
            logger.error('Error fetching passenger bookings', error);
            throw error;
        }
    }
}
