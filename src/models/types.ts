export interface Passenger {
    id?: number;
    name: string;
    phone: string;
    email?: string;
    created_at?: Date;
    updated_at?: Date;
}

export interface Cab {
    id?: number;
    driver_name: string;
    driver_phone: string;
    license_plate: string;
    seat_capacity: number;
    luggage_capacity: number;
    status: 'available' | 'busy' | 'offline';
    current_lat?: number;
    current_lng?: number;
    created_at?: Date;
    updated_at?: Date;
}

export interface Booking {
    id?: number;
    passenger_id: number;
    pickup_lat: number;
    pickup_lng: number;
    pickup_address?: string;
    dropoff_lat: number;
    dropoff_lng: number;
    dropoff_address?: string;
    seats_required: number;
    luggage_count: number;
    detour_tolerance_minutes: number;
    status: 'pending' | 'matched' | 'in_progress' | 'completed' | 'cancelled';
    estimated_distance_km?: number;
    estimated_duration_minutes?: number;
    base_price?: number;
    final_price?: number;
    created_at?: Date;
    updated_at?: Date;
    requested_pickup_time?: Date;
}

export interface RidePool {
    id?: number;
    pool_code: string;
    cab_id?: number;
    status: 'forming' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
    total_seats_used: number;
    total_luggage: number;
    total_distance_km?: number;
    total_duration_minutes?: number;
    optimized_route_json?: string;
    departure_time?: Date;
    completed_at?: Date;
    created_at?: Date;
    updated_at?: Date;
}

export interface PoolParticipant {
    id?: number;
    pool_id: number;
    booking_id: number;
    pickup_sequence: number;
    dropoff_sequence: number;
    individual_distance_km?: number;
    individual_duration_minutes?: number;
    detour_minutes?: number;
    discount_percentage: number;
    joined_at?: Date;
}

export interface PricingConfig {
    id?: number;
    base_fare: number;
    per_km_rate: number;
    per_minute_rate: number;
    pool_discount_percentage: number;
    surge_multiplier: number;
    peak_hour_multiplier: number;
    updated_at?: Date;
}

export interface Location {
    lat: number;
    lng: number;
}

export interface RouteSegment {
    type: 'pickup' | 'dropoff';
    booking_id: number;
    location: Location;
    sequence: number;
}

export interface OptimizedRoute {
    waypoints: RouteSegment[];
    total_distance_km: number;
    total_duration_minutes: number;
}
