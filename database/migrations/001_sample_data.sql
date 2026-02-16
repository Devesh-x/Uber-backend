-- Migration script to insert sample data for testing

-- Insert passengers
INSERT INTO passengers (id, name, phone, email) VALUES
(1, 'Alice Johnson', '1234567890', 'alice@example.com'),
(2, 'Bob Smith', '1234567891', 'bob@example.com'),
(3, 'Charlie Brown', '1234567892', 'charlie@example.com'),
(4, 'Diana Prince', '1234567893', 'diana@example.com'),
(5, 'Eve Davis', '1234567894', 'eve@example.com')
ON CONFLICT (phone) DO UPDATE SET 
    name = EXCLUDED.name,
    email = EXCLUDED.email;

-- Reset passenger sequence
SELECT setval('passengers_id_seq', (SELECT MAX(id) FROM passengers));

-- Insert cabs
INSERT INTO cabs (id, driver_name, driver_phone, license_plate, seat_capacity, luggage_capacity, status, current_lat, current_lng) VALUES
(1, 'John Driver', '9876543210', 'ABC-1234', 4, 3, 'available', 40.7128, -74.0060),
(2, 'Mary Cabby', '9876543211', 'XYZ-5678', 4, 3, 'available', 40.7580, -73.9855),
(3, 'Sam Wheeler', '9876543212', 'LMN-9012', 6, 4, 'available', 40.7489, -73.9680)
ON CONFLICT (driver_phone) DO UPDATE SET
    driver_name = EXCLUDED.driver_name,
    license_plate = EXCLUDED.license_plate,
    seat_capacity = EXCLUDED.seat_capacity,
    luggage_capacity = EXCLUDED.luggage_capacity,
    current_lat = EXCLUDED.current_lat,
    current_lng = EXCLUDED.current_lng;

-- Reset cab sequence
SELECT setval('cabs_id_seq', (SELECT MAX(id) FROM cabs));

-- Insert some initial completed bookings for history (optional)
INSERT INTO bookings (passenger_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, status, base_price, final_price, created_at) VALUES
(1, 40.7128, -74.0060, 40.7580, -73.9855, 'completed', 25.00, 25.00, NOW() - INTERVAL '1 day'),
(2, 40.7140, -74.0050, 40.7614, -73.9776, 'cancelled', 22.50, 0.00, NOW() - INTERVAL '2 days');
