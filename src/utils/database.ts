import { Pool, PoolClient, QueryResult } from 'pg';
import dotenv from 'dotenv';
import { logger } from './logger';

dotenv.config();

class Database {
    private pool: Pool;
    private static instance: Database;

    private constructor() {
        this.pool = new Pool({
            host: process.env.DATABASE_HOST || 'localhost',
            port: parseInt(process.env.DATABASE_PORT || '5432'),
            database: process.env.DATABASE_NAME || 'ride_pooling',
            user: process.env.DATABASE_USER || 'postgres',
            password: process.env.DATABASE_PASSWORD || '',
            max: 20, // Maximum number of connections in the pool
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        this.pool.on('error', (err: Error) => {
            logger.error('Unexpected database error', err);
        });

        logger.info('Database connection pool created');
    }

    public static getInstance(): Database {
        if (!Database.instance) {
            Database.instance = new Database();
        }
        return Database.instance;
    }

    public async query(text: string, params?: any[]): Promise<QueryResult> {
        const start = Date.now();
        try {
            const result = await this.pool.query(text, params);
            const duration = Date.now() - start;
            logger.debug('Executed query', { text, duration, rows: result.rowCount });
            return result;
        } catch (error) {
            logger.error('Database query error', { text, error });
            throw error;
        }
    }

    public async getClient(): Promise<PoolClient> {
        const client = await this.pool.connect();
        const query = client.query;
        const release = client.release;

        // Set a timeout of 5 seconds
        const timeout = setTimeout(() => {
            logger.error('Client has been checked out for more than 5 seconds!');
        }, 5000);

        // Monkey patch the release method
        client.release = () => {
            clearTimeout(timeout);
            client.query = query;
            client.release = release;
            return release.apply(client);
        };

        return client;
    }

    public async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
        const client = await this.getClient();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Transaction error', error);
            throw error;
        } finally {
            client.release();
        }
    }

    public async testConnection(): Promise<boolean> {
        try {
            const result = await this.query('SELECT NOW()');
            logger.info('Database connection test successful', { time: result.rows[0].now });
            return true;
        } catch (error) {
            logger.error('Database connection test failed', error);
            return false;
        }
    }

    public async close(): Promise<void> {
        await this.pool.end();
        logger.info('Database connection pool closed');
    }
}

export const db = Database.getInstance();
