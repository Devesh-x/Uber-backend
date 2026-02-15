import { Router, Request, Response } from 'express';
import { PoolMatcher } from '../services/PoolMatcher';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
const poolMatcher = new PoolMatcher();

/**
 * Get pool details
 * GET /api/pools/:id
 */
router.get(
    '/:id',
    asyncHandler(async (req: Request, res: Response) => {
        const poolId = parseInt(req.params.id as string);
        const poolDetails = await poolMatcher.getPoolDetails(poolId);

        if (!poolDetails) {
            return res.status(404).json({
                success: false,
                message: 'Pool not found',
            });
        }

        res.json({
            success: true,
            data: poolDetails,
        });
    })
);

/**
 * Manually trigger pool matching
 * POST /api/pools/match
 */
router.post(
    '/match',
    asyncHandler(async (req: Request, res: Response) => {
        await poolMatcher.runMatching();

        res.json({
            success: true,
            message: 'Pool matching completed',
        });
    })
);

export default router;
