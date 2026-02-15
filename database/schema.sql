-- Smart Airport Ride Pooling Database Schema
-- PostgreSQL Database

-- Enable PostGIS extension for geospatial queries (optional but recommended)
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================================
-- TABLES
-- ============================================================================

-- Passengers table
CREATE TABLE IF NOT EXISTS passengers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cabs table
CREATE TABLE IF NOT EXISTS cabs (
    id SERIAL PRIMARY KEY,
    driver_name VARCHAR(255) NOT NULL,
    driver_phone VARCHAR(20) UNIQUE NOT NULL,
    license_plate VARCHAR(20) UNIQUE NOT NULL,
    seat_capacity INTEGER NOT NULL DEFAULT 4,
    luggage_capacity INTEGER NOT NULL DEFAULT 3,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'busy', 'offline')),
    current_lat DECIMAL(10, 8),
    current_lng DECIMAL(11, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    passenger_id INTEGER NOT NULL REFERENCES passengers(id) ON DELETE CASCADE,
    pickup_lat DECIMAL(10, 8) NOT NULL,
    pickup_lng DECIMAL(11, 8) NOT NULL,
    pickup_address VARCHAR(500),
    dropoff_lat DECIMAL(10, 8) NOT NULL,
    dropoff_lng DECIMAL(11, 8) NOT NULL,
    dropoff_address VARCHAR(500),
    seats_required INTEGER NOT NULL DEFAULT 1,
    luggage_count INTEGER NOT NULL DEFAULT 0,
    detour_tolerance_minutes INTEGER NOT NULL DEFAULT 15,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'in_progress', 'completed', 'cancelled')),
    estimated_distance_km DECIMAL(10, 2),
    estimated_duration_minutes INTEGER,
    base_price DECIMAL(10, 2),
    final_price DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    requested_pickup_time TIMESTAMP
);

-- Ride pools table
CREATE TABLE IF NOT EXISTS ride_pools (
    id SERIAL PRIMARY KEY,
    pool_code VARCHAR(50) UNIQUE NOT NULL,
    cab_id INTEGER REFERENCES cabs(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'forming' CHECK (status IN ('forming', 'confirmed', 'in_progress', 'completed', 'cancelled')),
    total_seats_used INTEGER DEFAULT 0,
    total_luggage INTEGER DEFAULT 0,
    total_distance_km DECIMAL(10, 2),
    total_duration_minutes INTEGER,
    optimized_route_json TEXT, -- JSON array of waypoints
    departure_time TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pool participants junction table
CREATE TABLE IF NOT EXISTS pool_participants (
    id SERIAL PRIMARY KEY,
    pool_id INTEGER NOT NULL REFERENCES ride_pools(id) ON DELETE CASCADE,
    booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    pickup_sequence INTEGER NOT NULL, -- Order in which passenger is picked up
    dropoff_sequence INTEGER NOT NULL, -- Order in which passenger is dropped off
    individual_distance_km DECIMAL(10, 2),
    individual_duration_minutes INTEGER,
    detour_minutes INTEGER, -- Actual detour experienced
    discount_percentage DECIMAL(5, 2) DEFAULT 30.00,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pool_id, booking_id)
);

-- Pricing configuration table
CREATE TABLE IF NOT EXISTS pricing_config (
    id SERIAL PRIMARY KEY,
    base_fare DECIMAL(10, 2) DEFAULT 5.00,
    per_km_rate DECIMAL(10, 2) DEFAULT 2.00,
    per_minute_rate DECIMAL(10, 2) DEFAULT 0.50,
    pool_discount_percentage DECIMAL(5, 2) DEFAULT 30.00,
    surge_multiplier DECIMAL(5, 2) DEFAULT 1.00,
    peak_hour_multiplier DECIMAL(5, 2) DEFAULT 1.50,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default pricing config
INSERT INTO pricing_config (id, base_fare, per_km_rate, per_minute_rate, pool_discount_percentage, surge_multiplier, peak_hour_multiplier)
VALUES (1, 5.00, 2.00, 0.50, 30.00, 1.00, 1.50)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Booking indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at);
CREATE INDEX IF NOT EXISTS idx_active_bookings ON bookings(status, created_at) WHERE status IN ('pending', 'matched');
CREATE INDEX IF NOT EXISTS idx_bookings_passenger ON bookings(passenger_id);

-- Geospatial indexes for location-based queries
CREATE INDEX IF NOT EXISTS idx_bookings_pickup_location ON bookings(pickup_lat, pickup_lng);
CREATE INDEX IF NOT EXISTS idx_bookings_dropoff_location ON bookings(dropoff_lat, dropoff_lng);
CREATE INDEX IF NOT EXISTS idx_cabs_current_location ON cabs(current_lat, current_lng);

-- Pool indexes
CREATE INDEX IF NOT EXISTS idx_pools_status ON ride_pools(status);
CREATE INDEX IF NOT EXISTS idx_pools_departure_time ON ride_pools(departure_time);
CREATE INDEX IF NOT EXISTS idx_pools_status_departure ON ride_pools(status, departure_time) WHERE status = 'forming';

-- Pool participants indexes
CREATE INDEX IF NOT EXISTS idx_pool_participants_pool ON pool_participants(pool_id);
CREATE INDEX IF NOT EXISTS idx_pool_participants_booking ON pool_participants(booking_id);

-- Cab status index
CREATE INDEX IF NOT EXISTS idx_cabs_status ON cabs(status) WHERE status = 'available';

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for all tables
CREATE TRIGGER update_passengers_updated_at BEFORE UPDATE ON passengers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cabs_updated_at BEFORE UPDATE ON cabs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ride_pools_updated_at BEFORE UPDATE ON ride_pools
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Active bookings view
CREATE OR REPLACE VIEW active_bookings AS
SELECT b.*, p.name AS passenger_name, p.phone AS passenger_phone
FROM bookings b
JOIN passengers p ON b.passenger_id = p.id
WHERE b.status IN ('pending', 'matched', 'in_progress');

-- Available cabs view
CREATE OR REPLACE VIEW available_cabs AS
SELECT * FROM cabs
WHERE status = 'available';

-- Active pools view
CREATE OR REPLACE VIEW active_pools AS
SELECT 
    rp.*,
    c.driver_name,
    c.license_plate,
    COUNT(pp.id) AS participant_count
FROM ride_pools rp
LEFT JOIN cabs c ON rp.cab_id = c.id
LEFT JOIN pool_participants pp ON rp.id = pp.pool_id
WHERE rp.status IN ('forming', 'confirmed', 'in_progress')
GROUP BY rp.id, c.driver_name, c.license_plate;
