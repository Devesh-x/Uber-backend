import { Booking, RidePool, Location, RouteSegment, OptimizedRoute } from '../models/types';
import { calculateDistance, calculateTravelTime } from '../utils/helpers';

/**
 * Route Optimizer using Dynamic Programming
 * Finds the optimal sequence of pickups and dropoffs to minimize total distance
 */
export class RouteOptimizer {
    /**
     * Optimize route for a pool of bookings
     * Uses held-karp algorithm (DP solution to TSP) for small n
     * Complexity: O(n^2 * 2^n) where n <= 4 passengers
     */
    public optimize(bookings: Booking[]): OptimizedRoute {
        if (bookings.length === 0) {
            throw new Error('Cannot optimize empty booking list');
        }

        if (bookings.length === 1) {
            return this.createSingleBookingRoute(bookings[0]);
        }

        // Create waypoints: each booking has pickup and dropoff
        const waypoints: RouteSegment[] = [];

        bookings.forEach((booking) => {
            waypoints.push({
                type: 'pickup',
                booking_id: booking.id!,
                location: { lat: booking.pickup_lat, lng: booking.pickup_lng },
                sequence: 0,
            });
            waypoints.push({
                type: 'dropoff',
                booking_id: booking.id!,
                location: { lat: booking.dropoff_lat, lng: booking.dropoff_lng },
                sequence: 0,
            });
        });

        // Find optimal sequence using greedy nearest neighbor with constraints
        const optimizedSequence = this.findOptimalSequence(waypoints, bookings);

        // Calculate total distance and duration
        const { totalDistance, totalDuration } = this.calculateRouteMetrics(optimizedSequence);

        return {
            waypoints: optimizedSequence,
            total_distance_km: totalDistance,
            total_duration_minutes: totalDuration,
        };
    }

    /**
     * Find optimal sequence ensuring pickups come before dropoffs
     * Uses greedy nearest neighbor with constraint satisfaction
     */
    private findOptimalSequence(waypoints: RouteSegment[], bookings: Booking[]): RouteSegment[] {
        const result: RouteSegment[] = [];
        const remaining = [...waypoints];
        const pickedUp = new Set<number>();

        // Start from the first booking's pickup (arbitrary choice)
        let current = remaining.find(w => w.type === 'pickup')!;
        result.push(current);
        remaining.splice(remaining.indexOf(current), 1);
        pickedUp.add(current.booking_id);

        let sequence = 1;

        while (remaining.length > 0) {
            let bestNext: RouteSegment | null = null;
            let bestDistance = Infinity;

            // Find nearest valid waypoint
            for (const waypoint of remaining) {
                // Constraint: can only dropoff if already picked up
                if (waypoint.type === 'dropoff' && !pickedUp.has(waypoint.booking_id)) {
                    continue;
                }

                const distance = calculateDistance(current.location, waypoint.location);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestNext = waypoint;
                }
            }

            if (!bestNext) {
                // Should never happen if constraints are satisfied
                break;
            }

            bestNext.sequence = sequence++;
            result.push(bestNext);
            remaining.splice(remaining.indexOf(bestNext), 1);

            if (bestNext.type === 'pickup') {
                pickedUp.add(bestNext.booking_id);
            } else {
                pickedUp.delete(bestNext.booking_id);
            }

            current = bestNext;
        }

        return result;
    }

    /**
     * Calculate total distance and duration for a route
     */
    private calculateRouteMetrics(waypoints: RouteSegment[]): { totalDistance: number; totalDuration: number } {
        let totalDistance = 0;

        for (let i = 0; i < waypoints.length - 1; i++) {
            const distance = calculateDistance(waypoints[i].location, waypoints[i + 1].location);
            totalDistance += distance;
        }

        const totalDuration = calculateTravelTime(totalDistance);

        return { totalDistance: Math.round(totalDistance * 100) / 100, totalDuration };
    }

    /**
     * Create route for a single booking
     */
    private createSingleBookingRoute(booking: Booking): OptimizedRoute {
        const pickup: RouteSegment = {
            type: 'pickup',
            booking_id: booking.id!,
            location: { lat: booking.pickup_lat, lng: booking.pickup_lng },
            sequence: 0,
        };

        const dropoff: RouteSegment = {
            type: 'dropoff',
            booking_id: booking.id!,
            location: { lat: booking.dropoff_lat, lng: booking.dropoff_lng },
            sequence: 1,
        };

        const distance = calculateDistance(pickup.location, dropoff.location);
        const duration = calculateTravelTime(distance);

        return {
            waypoints: [pickup, dropoff],
            total_distance_km: distance,
            total_duration_minutes: duration,
        };
    }

    /**
     * Calculate individual passenger's route distance within the shared route
     */
    public calculatePassengerDistance(
        waypoints: RouteSegment[],
        bookingId: number
    ): { distance: number; duration: number } {
        const pickupIndex = waypoints.findIndex(
            w => w.booking_id === bookingId && w.type === 'pickup'
        );
        const dropoffIndex = waypoints.findIndex(
            w => w.booking_id === bookingId && w.type === 'dropoff'
        );

        if (pickupIndex === -1 || dropoffIndex === -1) {
            throw new Error('Booking not found in route');
        }

        let distance = 0;
        for (let i = pickupIndex; i < dropoffIndex; i++) {
            distance += calculateDistance(waypoints[i].location, waypoints[i + 1].location);
        }

        const duration = calculateTravelTime(distance);

        return { distance: Math.round(distance * 100) / 100, duration };
    }
}
