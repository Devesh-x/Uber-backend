import Redis from 'ioredis';
import dotenv from 'dotenv';
import { logger } from './logger';

dotenv.config();

class RedisClient {
    private client: Redis;
    private static instance: RedisClient;

    private constructor() {
        this.client = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD || undefined,
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
        });

        this.client.on('connect', () => {
            logger.info('Redis connected');
        });

        this.client.on('error', (err) => {
            logger.error('Redis error', err);
        });
    }

    public static getInstance(): RedisClient {
        if (!RedisClient.instance) {
            RedisClient.instance = new RedisClient();
        }
        return RedisClient.instance;
    }

    public getClient(): Redis {
        return this.client;
    }

    // Cache helpers
    public async setCache(key: string, value: any, ttl?: number): Promise<void> {
        const serialized = JSON.stringify(value);
        if (ttl) {
            await this.client.setex(key, ttl, serialized);
        } else {
            await this.client.set(key, serialized);
        }
    }

    public async getCache<T>(key: string): Promise<T | null> {
        const data = await this.client.get(key);
        if (!data) return null;
        return JSON.parse(data) as T;
    }

    public async deleteCache(key: string): Promise<void> {
        await this.client.del(key);
    }

    // Distributed lock
    public async acquireLock(key: string, ttl: number = 5000): Promise<boolean> {
        const result = await this.client.set(`lock:${key}`, '1', 'PX', ttl, 'NX');
        return result === 'OK';
    }

    public async releaseLock(key: string): Promise<void> {
        await this.client.del(`lock:${key}`);
    }

    // Queue operations
    public async enqueue(queueName: string, data: any): Promise<void> {
        await this.client.rpush(queueName, JSON.stringify(data));
    }

    public async dequeue(queueName: string): Promise<any | null> {
        const data = await this.client.lpop(queueName);
        if (!data) return null;
        return JSON.parse(data);
    }

    public async getQueueLength(queueName: string): Promise<number> {
        return await this.client.llen(queueName);
    }

    public async close(): Promise<void> {
        await this.client.quit();
        logger.info('Redis connection closed');
    }
}

export const redisClient = RedisClient.getInstance();
