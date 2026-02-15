import { RouteOptimizer } from '../../src/algorithms/RouteOptimizer';
import { Booking } from '../../src/models/types';

describe('RouteOptimizer', () => {
    let optimizer: RouteOptimizer;

    beforeEach(() => {
        optimizer = new RouteOptimizer();
    });

    describe('Single Booking Route', () => {
        it('should create simple route for single booking', () => {
            const booking: Booking = {
                id: 1,
                passenger_id: 1,
                pickup_lat: 40.7128,
                pickup_lng: -74.0060,
                dropoff_lat: 40.7580,
                dropoff_lng: -73.9855,
                seats_required: 1,
                luggage_count: 1,
                detour_tolerance_minutes: 15,
                status: 'pending',
            };

            const route = optimizer.optimize([booking]);

            expect(route.waypoints).toHaveLength(2);
            expect(route.waypoints[0].type).toBe('pickup');
            expect(route.waypoints[1].type).toBe('dropoff');
            expect(route.total_distance_km).toBeGreaterThan(0);
        });
    });

    describe('Multiple Bookings Route', () => {
        it('should optimize route for two bookings', () => {
            const booking1: Booking = {
                id: 1,
                passenger_id: 1,
                pickup_lat: 40.7128,
                pickup_lng: -74.0060,
                dropoff_lat: 40.7580,
                dropoff_lng: -73.9855,
                seats_required: 1,
                luggage_count: 1,
                detour_tolerance_minutes: 15,
                status: 'pending',
            };

            const booking2: Booking = {
                id: 2,
                passenger_id: 2,
                pickup_lat: 40.7140,
                pickup_lng: -74.0050,
                dropoff_lat: 40.7614,
                dropoff_lng: -73.9776,
                seats_required: 1,
                luggage_count: 1,
                detour_tolerance_minutes: 15,
                status: 'pending',
            };

            const route = optimizer.optimize([booking1, booking2]);

            // Should have 4 waypoints: 2 pickups + 2 dropoffs
            expect(route.waypoints).toHaveLength(4);

            // Verify all pickups come before their dropoffs
            const booking1Pickup = route.waypoints.findIndex(
                w => w.booking_id === 1 && w.type === 'pickup'
            );
            const booking1Dropoff = route.waypoints.findIndex(
                w => w.booking_id === 1 && w.type === 'dropoff'
            );
            expect(booking1Pickup).toBeLessThan(booking1Dropoff);

            const booking2Pickup = route.waypoints.findIndex(
                w => w.booking_id === 2 && w.type === 'pickup'
            );
            const booking2Dropoff = route.waypoints.findIndex(
                w => w.booking_id === 2 && w.type === 'dropoff'
            );
            expect(booking2Pickup).toBeLessThan(booking2Dropoff);
        });

        it('should calculate correct passenger distance', () => {
            const booking: Booking = {
                id: 1,
                passenger_id: 1,
                pickup_lat: 40.7128,
                pickup_lng: -74.0060,
                dropoff_lat: 40.7580,
                dropoff_lng: -73.9855,
                seats_required: 1,
                luggage_count: 1,
                detour_tolerance_minutes: 15,
                status: 'pending',
            };

            const route = optimizer.optimize([booking]);
            const { distance, duration } = optimizer.calculatePassengerDistance(
                route.waypoints,
                1
            );

            expect(distance).toBeGreaterThan(0);
            expect(duration).toBeGreaterThan(0);
            expect(distance).toBe(route.total_distance_km);
        });
    });

    describe('Error Handling', () => {
        it('should throw error for empty booking list', () => {
            expect(() => optimizer.optimize([])).toThrow();
        });
    });
});
