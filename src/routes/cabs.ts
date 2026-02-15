import { Router, Request, Response } from 'express';
import { db } from '../utils/database';
import { validate, createCabSchema } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

/**
 * Create a new cab
 * POST /api/cabs
 */
router.post(
    '/',
    validate(createCabSchema),
    asyncHandler(async (req: Request, res: Response) => {
        const { driver_name, driver_phone, license_plate, seat_capacity, luggage_capacity, current_lat, current_lng } = req.body;

        const result = await db.query(
            `INSERT INTO cabs (driver_name, driver_phone, license_plate, seat_capacity, luggage_capacity, current_lat, current_lng, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'available') RETURNING *`,
            [driver_name, driver_phone, license_plate, seat_capacity, luggage_capacity, current_lat || null, current_lng || null]
        );

        res.status(201).json({
            success: true,
            message: 'Cab created successfully',
            data: result.rows[0],
        });
    })
);

/**
 * Get all available cabs
 * GET /api/cabs/available
 */
router.get(
    '/available',
    asyncHandler(async (req: Request, res: Response) => {
        const result = await db.query("SELECT * FROM cabs WHERE status = 'available'");

        res.json({
            success: true,
            data: result.rows,
        });
    })
);

/**
 * Update cab status
 * PATCH /api/cabs/:id/status
 */
router.patch(
    '/:id/status',
    asyncHandler(async (req: Request, res: Response) => {
        const cabId = parseInt(req.params.id as string);
        const { status } = req.body;

        if (!['available', 'busy', 'offline'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status value',
            });
        }

        await db.query('UPDATE cabs SET status = $1 WHERE id = $2', [status, cabId]);

        res.json({
            success: true,
            message: 'Cab status updated',
        });
    })
);

/**
 * Get all cabs
 * GET /api/cabs
 */
router.get(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
        const result = await db.query('SELECT * FROM cabs ORDER BY created_at DESC');

        res.json({
            success: true,
            data: result.rows,
        });
    })
);

export default router;
