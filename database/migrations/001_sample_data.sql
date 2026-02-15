-- Migration script to insert sample data for testing

-- Insert passengers
INSERT INTO passengers (id, name, phone, email) VALUES
(1, 'Alice Johnson', '1234567890', 'alice@example.com'),
(2, 'Bob Smith', '1234567891', 'bob@example.com'),
(3, 'Charlie Brown', '1234567892', 'charlie@example.com'),
(4, 'Diana Prince', '1234567893', 'diana@example all.com'),
(5, 'Eve Davis', '1234567894', 'eve@example.com')
ON CONFLICT (phone) DO NOTHING;

-- Reset passenger sequence
SELECT setval('passengers_id_seq', (SELECT MAX(id) FROM passengers));

-- Insert cabs
INSERT INTO cabs (id, driver_name, driver_phone, license_plate, seat_capacity, luggage_capacity, status, current_lat, current_lng) VALUES
(1, 'John Driver', '9876543210', 'ABC-1234', 4, 3, 'available', 40.7128, -74.0060),
(2, 'Mary Cabby', '9876543211', 'XYZ-5678', 4, 3, 'available', 40.7580, -73.9855),
(3, 'Sam Wheeler', '9876543212', 'LMN-9012', 6, 4, 'available', 40.7489, -73.9680)
ON CONFLICT (driver_phone) DO NOTHING;

-- Reset cab sequence
SELECT setval('cabs_id_seq', (SELECT MAX(id) FROM cabs));

-- Note: Bookings should be created via API to trigger matching
