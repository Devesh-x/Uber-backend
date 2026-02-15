import { Router, Request, Response } from 'express';
import { BookingService } from '../services/BookingService';
import { PoolMatcher } from '../services/PoolMatcher';
import { validate, createBookingSchema } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();
const bookingService = new BookingService();
const poolMatcher = new PoolMatcher();

/**
 * Create a new booking
 * POST /api/bookings
 */
router.post(
    '/',
    validate(createBookingSchema),
    asyncHandler(async (req: Request, res: Response) => {
        const booking = await bookingService.createBooking(req.body);

        logger.info(`Booking created: ${booking.id}`);

        res.status(201).json({
            success: true,
            message: 'Booking created successfully',
            data: booking,
        });
    })
);

/**
 * Get booking by ID
 * GET /api/bookings/:id
 */
router.get(
    '/:id',
    asyncHandler(async (req: Request, res: Response) => {
        const bookingId = parseInt(req.params.id as string);
        const booking = await bookingService.getBooking(bookingId);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found',
            });
        }

        // Get pool details if matched
        let poolDetails = null;
        if (booking.status === 'matched' || booking.status === 'in_progress') {
            const poolResult = await poolMatcher.getPoolDetails(bookingId);
            poolDetails = poolResult;
        }

        res.json({
            success: true,
            data: {
                booking,
                pool: poolDetails,
            },
        });
    })
);

/**
 * Get booking status (for real-time updates)
 * GET /api/bookings/:id/status
 */
router.get(
    '/:id/status',
    asyncHandler(async (req: Request, res: Response) => {
        const bookingId = parseInt(req.params.id as string);
        const booking = await bookingService.getBooking(bookingId);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found',
            });
        }

        res.json({
            success: true,
            data: {
                id: booking.id,
                status: booking.status,
                final_price: booking.final_price,
                updated_at: booking.updated_at,
            },
        });
    })
);

/**
 * Cancel a booking
 * DELETE /api/bookings/:id
 */
router.delete(
    '/:id',
    asyncHandler(async (req: Request, res: Response) => {
        const bookingId = parseInt(req.params.id as string);

        await poolMatcher.handleCancellation(bookingId);

        res.json({
            success: true,
            message: 'Booking cancelled successfully',
        });
    })
);

/**
 * Get bookings for a passenger
 * GET /api/bookings/passenger/:passengerId
 */
router.get(
    '/passenger/:passengerId',
    asyncHandler(async (req: Request, res: Response) => {
        const passengerId = parseInt(req.params.passengerId as string);
        const bookings = await bookingService.getPassengerBookings(passengerId);

        res.json({
            success: true,
            data: bookings,
        });
    })
);

export default router;
