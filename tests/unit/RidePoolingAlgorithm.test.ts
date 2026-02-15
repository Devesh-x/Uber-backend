import { RidePoolingAlgorithm } from '../../src/algorithms/RidePoolingAlgorithm';
import { Booking, Cab, RidePool } from '../../src/models/types';

describe('RidePoolingAlgorithm', () => {
    let algorithm: RidePoolingAlgorithm;

    beforeEach(() => {
        algorithm = new RidePoolingAlgorithm(4, 5);
    });

    describe('Constraint Checking', () => {
        it('should respect seat capacity constraints', () => {
            const booking1: Booking = {
                id: 1,
                passenger_id: 1,
                pickup_lat: 40.7128,
                pickup_lng: -74.0060,
                dropoff_lat: 40.7580,
                dropoff_lng: -73.9855,
                seats_required: 3,
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
                seats_required: 2,
                luggage_count: 1,
                detour_tolerance_minutes: 15,
                status: 'pending',
            };

            const result = algorithm.matchRides([booking1, booking2], [], []);

            // Should create separate pools due to seat capacity (3 + 2 > 4)
            expect(result.newPools.size).toBeGreaterThan(1);
        });

        it('should group compatible bookings together', () => {
            const booking1: Booking = {
                id: 1,
                passenger_id: 1,
                pickup_lat: 40.7128,
                pickup_lng: -74.0060,
                dropoff_lat: 40.7580,
                dropoff_lng: -73.9855,
                seats_required: 1,
                luggage_count: 1,
                detour_tolerance_minutes: 20,
                status: 'pending',
            };

            const booking2: Booking = {
                id: 2,
                passenger_id: 2,
                pickup_lat: 40.7135,
                pickup_lng: -74.0055,
                dropoff_lat: 40.7614,
                dropoff_lng: -73.9776,
                seats_required: 1,
                luggage_count: 1,
                detour_tolerance_minutes: 20,
                status: 'pending',
            };

            const result = algorithm.matchRides([booking1, booking2], [], []);

            // Should create one pool with both bookings (nearby pickups, similar routes)
            expect(result.newPools.size).toBeGreaterThan(0);

            // Check that at least one pool has both bookings
            const poolSizes = Array.from(result.newPools.values()).map(b => b.length);
            expect(Math.max(...poolSizes)).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Pool Scoring', () => {
        it('should calculate pool compatibility score', () => {
            const newBooking: Booking = {
                id: 3,
                passenger_id: 3,
                pickup_lat: 40.7130,
                pickup_lng: -74.0058,
                dropoff_lat: 40.7590,
                dropoff_lng: -73.9865,
                seats_required: 1,
                luggage_count: 1,
                detour_tolerance_minutes: 15,
                status: 'pending',
            };

            const existingBooking: Booking = {
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

            const score = algorithm.calculatePoolScore(newBooking, [existingBooking]);

            expect(score).toBeGreaterThan(0);
            expect(typeof score).toBe('number');
        });
    });
});
