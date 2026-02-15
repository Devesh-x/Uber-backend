export const config = {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',

    database: {
        host: process.env.DATABASE_HOST || 'localhost',
        port: parseInt(process.env.DATABASE_PORT || '5432'),
        name: process.env.DATABASE_NAME || 'ride_pooling',
        user: process.env.DATABASE_USER || 'postgres',
        password: process.env.DATABASE_PASSWORD || '',
    },

    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
    },

    pooling: {
        maxPoolSize: parseInt(process.env.MAX_POOL_SIZE || '4'),
        detourToleranceMinutes: parseInt(process.env.DETOUR_TOLERANCE_MINUTES || '15'),
        matchingIntervalMs: parseInt(process.env.MATCHING_INTERVAL_MS || '5000'),
    },

    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    },
};
