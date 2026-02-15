import { Router, Request, Response } from 'express';
import { db } from '../utils/database';
import { validate, createPassengerSchema } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

/**
 * Create a new passenger
 * POST /api/passengers
 */
router.post(
    '/',
    validate(createPassengerSchema),
    asyncHandler(async (req: Request, res: Response) => {
        const { name, phone, email } = req.body;

        const result = await db.query(
            'INSERT INTO passengers (name, phone, email) VALUES ($1, $2, $3) RETURNING *',
            [name, phone, email || null]
        );

        res.status(201).json({
            success: true,
            message: 'Passenger created successfully',
            data: result.rows[0],
        });
    })
);

/**
 * Get passenger by ID
 * GET /api/passengers/:id
 */
router.get(
    '/:id',
    asyncHandler(async (req: Request, res: Response) => {
        const passengerId = parseInt(req.params.id as string);
        const result = await db.query('SELECT * FROM passengers WHERE id = $1', [passengerId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Passenger not found',
            });
        }

        res.json({
            success: true,
            data: result.rows[0],
        });
    })
);

/**
 * Get all passengers
 * GET /api/passengers
 */
router.get(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
        const result = await db.query('SELECT * FROM passengers ORDER BY created_at DESC');

        res.json({
            success: true,
            data: result.rows,
        });
    })
);

export default router;
