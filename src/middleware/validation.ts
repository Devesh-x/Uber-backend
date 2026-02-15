import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '../utils/logger';

/**
 * Validation middleware factory
 */
export const validate = (schema: Joi.ObjectSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true,
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
            }));

            logger.warn('Validation error', { errors });
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors,
            });
        }

        req.body = value;
        next();
    };
};

/**
 * Booking creation schema
 */
export const createBookingSchema = Joi.object({
    passenger_id: Joi.number().integer().positive().required(),
    pickup_lat: Joi.number().min(-90).max(90).required(),
    pickup_lng: Joi.number().min(-180).max(180).required(),
    pickup_address: Joi.string().max(500).optional(),
    dropoff_lat: Joi.number().min(-90).max(90).required(),
    dropoff_lng: Joi.number().min(-180).max(180).required(),
    dropoff_address: Joi.string().max(500).optional(),
    seats_required: Joi.number().integer().min(1).max(4).default(1),
    luggage_count: Joi.number().integer().min(0).max(3).default(0),
    detour_tolerance_minutes: Joi.number().integer().min(5).max(30).default(15),
    requested_pickup_time: Joi.date().iso().optional(),
});

/**
 * Passenger creation schema
 */
export const createPassengerSchema = Joi.object({
    name: Joi.string().min(2).max(255).required(),
    phone: Joi.string().pattern(/^[0-9]{10,15}$/).required(),
    email: Joi.string().email().optional(),
});

/**
 * Cab creation schema
 */
export const createCabSchema = Joi.object({
    driver_name: Joi.string().min(2).max(255).required(),
    driver_phone: Joi.string().pattern(/^[0-9]{10,15}$/).required(),
    license_plate: Joi.string().min(3).max(20).required(),
    seat_capacity: Joi.number().integer().min(2).max(8).default(4),
    luggage_capacity: Joi.number().integer().min(1).max(6).default(3),
    current_lat: Joi.number().min(-90).max(90).optional(),
    current_lng: Joi.number().min(-180).max(180).optional(),
});
