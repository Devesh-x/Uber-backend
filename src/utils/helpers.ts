import { Location } from '../models/types';

/**
 * Calculate Haversine distance between two coordinates
 * @param loc1 First location
 * @param loc2 Second location
 * @returns Distance in kilometers
 */
export function calculateDistance(loc1: Location, loc2: Location): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = toRad(loc2.lat - loc1.lat);
    const dLon = toRad(loc2.lng - loc1.lng);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(loc1.lat)) * Math.cos(toRad(loc2.lat)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

/**
 * Convert degrees to radians
 */
function toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
}

/**
 * Calculate estimated travel time based on distance
 * Assumes average speed of 40 km/h in city traffic
 */
export function calculateTravelTime(distanceKm: number): number {
    const averageSpeedKmh = 40;
    const timeInMinutes = (distanceKm / averageSpeedKmh) * 60;
    return Math.round(timeInMinutes);
}

/**
 * Calculate detour for a passenger in a shared route
 * @param directDistance Direct distance from pickup to dropoff
 * @param sharedRouteDistance Distance via shared route
 * @returns Detour in minutes
 */
export function calculateDetour(directDistance: number, sharedRouteDistance: number): number {
    const directTime = calculateTravelTime(directDistance);
    const sharedTime = calculateTravelTime(sharedRouteDistance);
    return sharedTime - directTime;
}

/**
 * Check if a location is within a radius of another location
 */
export function isWithinRadius(loc1: Location, loc2: Location, radiusKm: number): boolean {
    return calculateDistance(loc1, loc2) <= radiusKm;
}

/**
 * Generate a unique pool code
 */
export function generatePoolCode(): string {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 7);
    return `POOL-${timestamp}-${randomStr}`.toUpperCase();
}

/**
 * Check if current time is peak hour
 */
export function isPeakHour(): boolean {
    const hour = new Date().getHours();
    // Peak hours: 6-9 AM and 5-8 PM
    return (hour >= 6 && hour <= 9) || (hour >= 17 && hour <= 20);
}
