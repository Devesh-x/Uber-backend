import { calculateDistance, calculateTravelTime, calculateDetour, generatePoolCode, isPeakHour } from '../../src/utils/helpers';

describe('Helper Functions', () => {
    describe('calculateDistance', () => {
        it('should calculate correct distance between two points', () => {
            // JFK to Times Square (approximately 26 km)
            const jfk = { lat: 40.6413, lng: -73.7781 };
            const timesSquare = { lat: 40.7580, lng: -73.9855 };

            const distance = calculateDistance(jfk, timesSquare);
            expect(distance).toBeGreaterThan(20);
            expect(distance).toBeLessThan(30);
        });

        it('should return 0 for same location', () => {
            const loc = { lat: 40.7128, lng: -74.0060 };
            const distance = calculateDistance(loc, loc);
            expect(distance).toBe(0);
        });
    });

    describe('calculateTravelTime', () => {
        it('should calculate travel time correctly', () => {
            const distance = 40; // km
            const time = calculateTravelTime(distance);
            expect(time).toBe(60); // 40km at 40km/h = 60 minutes
        });

        it('should round to nearest minute', () => {
            const distance = 10; // km
            const time = calculateTravelTime(distance);
            expect(Number.isInteger(time)).toBe(true);
        });
    });

    describe('calculateDetour', () => {
        it('should calculate positive detour for longer route', () => {
            const directDistance = 20;
            const sharedDistance = 30;
            const detour = calculateDetour(directDistance, sharedDistance);
            expect(detour).toBeGreaterThan(0);
        });

        it('should calculate zero detour for same distance', () => {
            const distance = 20;
            const detour = calculateDetour(distance, distance);
            expect(detour).toBe(0);
        });
    });

    describe('generatePoolCode', () => {
        it('should generate unique pool codes', () => {
            const code1 = generatePoolCode();
            const code2 = generatePoolCode();
            expect(code1).not.toBe(code2);
        });

        it('should start with POOL-', () => {
            const code = generatePoolCode();
            expect(code).toContain('POOL-');
        });
    });

    describe('isPeakHour', () => {
        it('should return boolean', () => {
            const result = isPeakHour();
            expect(typeof result).toBe('boolean');
        });
    });
});
