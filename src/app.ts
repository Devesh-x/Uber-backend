import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cluster from 'cluster';
import os from 'os';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import { db } from './utils/database';
import { redisClient } from './utils/redis';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { PoolMatcher } from './services/PoolMatcher';

// Routes
import bookingsRouter from './routes/bookings';
import passengersRouter from './routes/passengers';
import cabsRouter from './routes/cabs';
import poolsRouter from './routes/pools';

dotenv.config();

const numCPUs = os.cpus().length;
const poolMatcher = new PoolMatcher();

// Swagger documentation
const swaggerDocument = {
    openapi: '3.0.0',
    info: {
        title: 'Smart Airport Ride Pooling API',
        version: '1.0.0',
        description: 'Backend API for airport ride pooling system with intelligent matching',
    },
    servers: [
        {
            url: `http://localhost:${config.port}`,
            description: 'Development server',
        },
    ],
    paths: {
        '/api/bookings': {
            post: {
                summary: 'Create a new booking',
                tags: ['Bookings'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['passenger_id', 'pickup_lat', 'pickup_lng', 'dropoff_lat', 'dropoff_lng'],
                                properties: {
                                    passenger_id: { type: 'integer' },
                                    pickup_lat: { type: 'number' },
                                    pickup_lng: { type: 'number' },
                                    pickup_address: { type: 'string' },
                                    dropoff_lat: { type: 'number' },
                                    dropoff_lng: { type: 'number' },
                                    dropoff_address: { type: 'string' },
                                    seats_required: { type: 'integer', default: 1 },
                                    luggage_count: { type: 'integer', default: 0 },
                                    detour_tolerance_minutes: { type: 'integer', default: 15 },
                                },
                            },
                        },
                    },
                },
                responses: {
                    '201': { description: 'Booking created successfully' },
                    '400': { description: 'Validation error' },
                },
            },
        },
        '/api/bookings/{id}': {
            get: {
                summary: 'Get booking details',
                tags: ['Bookings'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'integer' },
                    },
                ],
                responses: {
                    '200': { description: 'Booking details' },
                    '404': { description: 'Booking not found' },
                },
            },
            delete: {
                summary: 'Cancel a booking',
                tags: ['Bookings'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'integer' },
                    },
                ],
                responses: {
                    '200': { description: 'Booking cancelled' },
                    '404': { description: 'Booking not found' },
                },
            },
        },
        '/api/pools/{id}': {
            get: {
                summary: 'Get pool details',
                tags: ['Pools'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'integer' },
                    },
                ],
                responses: {
                    '200': { description: 'Pool details' },
                    '404': { description: 'Pool not found' },
                },
            },
        },
        '/api/pools/match': {
            post: {
                summary: 'Manually trigger pool matching',
                tags: ['Pools'],
                responses: {
                    '200': { description: 'Matching completed' },
                },
            },
        },
        '/api/passengers': {
            post: {
                summary: 'Create a new passenger',
                tags: ['Passengers'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['name', 'phone'],
                                properties: {
                                    name: { type: 'string' },
                                    phone: { type: 'string' },
                                    email: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    '201': { description: 'Passenger created' },
                },
            },
        },
        '/api/cabs': {
            post: {
                summary: 'Register a new cab',
                tags: ['Cabs'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['driver_name', 'driver_phone', 'license_plate'],
                                properties: {
                                    driver_name: { type: 'string' },
                                    driver_phone: { type: 'string' },
                                    license_plate: { type: 'string' },
                                    seat_capacity: { type: 'integer', default: 4 },
                                    luggage_capacity: { type: 'integer', default: 3 },
                                },
                            },
                        },
                    },
                },
                responses: {
                    '201': { description: 'Cab registered' },
                },
            },
        },
    },
};

if (cluster.isPrimary && process.env.NODE_ENV === 'production') {
    // Master process - fork workers
    logger.info(`Master process ${process.pid} is running`);
    logger.info(`Forking ${numCPUs} workers...`);

    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        logger.warn(`Worker ${worker.process.pid} died. Forking new worker...`);
        cluster.fork();
    });

    // Run background matching worker in master process
    setInterval(async () => {
        try {
            await poolMatcher.runMatching();
        } catch (error) {
            logger.error('Error in background matching', error);
        }
    }, config.pooling.matchingIntervalMs);

} else {
    // Worker process - run Express server
    const app: Application = express();

    // Middleware
    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Health check
    app.get('/health', async (req, res) => {
        const dbHealthy = await db.testConnection();
        res.json({
            success: true,
            service: 'ride-pooling-backend',
            database: dbHealthy ? 'connected' : 'disconnected',
            timestamp: new Date().toISOString(),
        });
    });

    // API Documentation
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

    // API Routes
    app.use('/api/bookings', bookingsRouter);
    app.use('/api/passengers', passengersRouter);
    app.use('/api/cabs', cabsRouter);
    app.use('/api/pools', poolsRouter);

    // Error handlers
    app.use(notFoundHandler);
    app.use(errorHandler);

    // Start server
    const server = app.listen(config.port, async () => {
        logger.info(`Worker ${process.pid} started on port ${config.port}`);

        // Test database connection
        const dbHealthy = await db.testConnection();
        if (!dbHealthy) {
            logger.error('Failed to connect to database');
        }

        logger.info('API Documentation available at http://localhost:' + config.port + '/api-docs');
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
        logger.info('SIGTERM received, shutting down gracefully');
        server.close(async () => {
            await db.close();
            await redisClient.close();
            process.exit(0);
        });
    });

    // In development, run matching worker if not clustered
    if (process.env.NODE_ENV !== 'production') {
        setInterval(async () => {
            try {
                await poolMatcher.runMatching();
            } catch (error) {
                logger.error('Error in background matching', error);
            }
        }, config.pooling.matchingIntervalMs);
    }
}
