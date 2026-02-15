import { PricingConfig, Booking, RidePool } from '../models/types';
import { db } from '../utils/database';
import { calculateDistance, isPeakHour } from '../utils/helpers';
import { logger } from '../utils/logger';

/**
 * Dynamic Pricing Engine
 * Implements strategy pattern for different pricing models
 */
export class PricingEngine {
    private config: PricingConfig | null = null;

    /**
     * Load pricing configuration from database
     */
    private async loadConfig(): Promise<void> {
        try {
            const result = await db.query('SELECT * FROM pricing_config WHERE id = 1');
            if (result.rows.length > 0) {
                this.config = result.rows[0];
            } else {
                // Use default config
                this.config = {
                    base_fare: 5.00,
                    per_km_rate: 2.00,
                    per_minute_rate: 0.50,
                    pool_discount_percentage: 30.00,
                    surge_multiplier: 1.00,
                    peak_hour_multiplier: 1.50,
                };
            }
        } catch (error) {
            logger.error('Error loading pricing config', error);
            throw error;
        }
    }

    /**
     * Calculate price for a booking
     * Formula: (Base + Distance Cost + Time Cost) × Surge × Peak Hour × Pool Discount
     */
    public async calculatePrice(booking: Booking, isPooled: boolean = false): Promise<number> {
        if (!this.config) {
            await this.loadConfig();
        }

        const config = this.config!;

        // Calculate distance if not already set
        const distance = booking.estimated_distance_km || calculateDistance(
            { lat: booking.pickup_lat, lng: booking.pickup_lng },
            { lat: booking.dropoff_lat, lng: booking.dropoff_lng }
        );

        // Estimated time (assuming 40 km/h average speed)
        const estimatedMinutes = booking.estimated_duration_minutes || (distance / 40) * 60;

        // Base calculation
        let price = config.base_fare;
        price += distance * config.per_km_rate;
        price += estimatedMinutes * config.per_minute_rate;

        // Apply surge multiplier
        const surgeMultiplier = await this.getSurgeMultiplier();
        price *= surgeMultiplier;

        // Apply peak hour multiplier
        if (isPeakHour()) {
            price *= config.peak_hour_multiplier;
        }

        // Apply pool discount
        if (isPooled) {
            price *= (1 - config.pool_discount_percentage / 100);
        }

        return Math.round(price * 100) / 100; // Round to 2 decimal places
    }

    /**
     * Calculate surge multiplier based on demand
     * Surge = 1 + (Active Bookings / Available Cabs - 1)
     */
    private async getSurgeMultiplier(): Promise<number> {
        try {
            const bookingsResult = await db.query(
                "SELECT COUNT(*) as count FROM bookings WHERE status IN ('pending', 'matched')"
            );
            const cabsResult = await db.query(
                "SELECT COUNT(*) as count FROM cabs WHERE status = 'available'"
            );

            const activeBookings = parseInt(bookingsResult.rows[0].count);
            const availableCabs = parseInt(cabsResult.rows[0].count);

            if (availableCabs === 0) {
                return 2.0; // Max surge when no cabs available
            }

            const ratio = activeBookings / availableCabs;
            const surge = 1 + Math.max(0, ratio - 1) * 0.5; // 50% increase per unit over capacity

            // Cap surge at 2.5x
            return Math.min(surge, 2.5);
        } catch (error) {
            logger.error('Error calculating surge multiplier', error);
            return 1.0; // Default no surge on error
        }
    }

    /**
     * Recalculate prices for all participants in a pool
     */
    public async recalculatePoolPrices(poolId: number, bookingIds: number[]): Promise<Map<number, number>> {
        const prices = new Map<number, number>();

        for (const bookingId of bookingIds) {
            const result = await db.query('SELECT * FROM bookings WHERE id = $1', [bookingId]);
            if (result.rows.length > 0) {
                const booking: Booking = result.rows[0];
                const price = await this.calculatePrice(booking, true);
                prices.set(bookingId, price);
            }
        }

        return prices;
    }

    /**
     * Get current pricing configuration
     */
    public async getConfig(): Promise<PricingConfig> {
        if (!this.config) {
            await this.loadConfig();
        }
        return this.config!;
    }

    /**
     * Update pricing configuration
     */
    public async updateConfig(updates: Partial<PricingConfig>): Promise<void> {
        try {
            const fields = Object.keys(updates)
                .map((key, index) => `${key} = $${index + 1}`)
                .join(', ');
            const values = Object.values(updates);

            await db.query(
                `UPDATE pricing_config SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = 1`,
                values
            );

            // Reload config
            await this.loadConfig();
            logger.info('Pricing config updated', updates);
        } catch (error) {
            logger.error('Error updating pricing config', error);
            throw error;
        }
    }
}
