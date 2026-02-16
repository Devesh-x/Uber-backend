# Low Level Design  Class Diagrams

## Design Patterns Used

1. **Singleton**: Database, Redis connections
2. **Strategy**: Pricing strategies
3. **Factory**: Pool creation
4. **Repository**: Data access layer
5. **Observer**: Realtime status updates

## Core Class Diagram

```mermaid
classDiagram
    class Booking {
        +number id
        +number passenger_id
        +number pickup_lat
        +number pickup_lng
        +number dropoff_lat
        +number dropoff_lng
        +number seats_required
        +number luggage_count
        +number detour_tolerance_minutes
        +string status
        +number final_price
    }
    
    class RidePool {
        +number id
        +string pool_code
        +number cab_id
        +string status
        +number total_seats_used
        +number total_luggage
        +string optimized_route_json
    }
    
    class PoolParticipant {
        +number pool_id
        +number booking_id
        +number pickup_sequence
        +number dropoff_sequence
        +number detour_minutes
    }
    
    class Cab {
        +number id
        +string driver_name
        +string license_plate
        +number seat_capacity
        +number luggage_capacity
        +string status
    }
    
    class Passenger {
        +number id
        +string name
        +string phone
        +string email
    }
    
    Booking "*" > "1" Passenger
    Booking "*" > "0..1" RidePool
    RidePool "*" > "1" Cab
    RidePool "1" > "*" PoolParticipant
    PoolParticipant "*" > "1" Booking
```

## Service Layer Architecture

```mermaid
classDiagram
    class BookingService {
        PricingEngine pricingEngine
        +createBooking(data) Booking
        +getBooking(id) Booking
        +getPendingBookings() Booking[]
        +updateBookingStatus(id, status) void
        +cancelBooking(id) void
    }
    
    class PoolMatcher {
        RidePoolingAlgorithm algorithm
        RouteOptimizer routeOptimizer
        PricingEngine pricingEngine
        +runMatching() void
        +createPool(poolCode, bookings) void
        +updatePool(poolId, bookings) void
        +handleCancellation(bookingId) void
        +getPoolDetails(poolId) Object
    }
    
    class PricingEngine {
        PricingConfig config
        +calculatePrice(booking, isPooled) number
        +getSurgeMultiplier() number
        +recalculatePoolPrices(poolId, bookingIds) Map
        +getConfig() PricingConfig
        +updateConfig(updates) void
    }
    
    class RidePoolingAlgorithm {
        RouteOptimizer routeOptimizer
        number maxPoolSize
        number proximityRadiusKm
        +matchRides(bookings, pools, cabs) MatchResult
        canAddToPool(booking, poolBookings, pool) boolean
        checkRouteConstraints(bookings) boolean
        +calculatePoolScore(booking, poolBookings) number
    }
    
    class RouteOptimizer {
        +optimize(bookings) OptimizedRoute
        findOptimalSequence(waypoints, bookings) RouteSegment[]
        calculateRouteMetrics(waypoints) Metrics
        +calculatePassengerDistance(waypoints, bookingId) Distance
    }
    
    BookingService > PricingEngine
    PoolMatcher > RidePoolingAlgorithm
    PoolMatcher > RouteOptimizer
    PoolMatcher > PricingEngine
    PoolMatcher > BookingService
    RidePoolingAlgorithm > RouteOptimizer
```

## Database Access Layer

```mermaid
classDiagram
    class Database {
        Pool pool
        static Database instance
        +static getInstance() Database
        +query(text, params) QueryResult
        +getClient() PoolClient
        +transaction(callback) T
        +testConnection() boolean
        +close() void
    }
    
    class RedisClient {
        Redis client
        static RedisClient instance
        +static getInstance() RedisClient
        +getClient() Redis
        +setCache(key, value, ttl) void
        +getCache(key) T
        +acquireLock(key, ttl) boolean
        +releaseLock(key) void
        +enqueue(queueName, data) void
        +dequeue(queueName) any
    }
    
    BookingService > Database
    PoolMatcher > Database
    PoolMatcher > RedisClient
```

## API Layer Architecture

```mermaid
classDiagram
    class BookingRouter {
        BookingService bookingService
        PoolMatcher poolMatcher
        +POST_create(req, res) void
        +GET_byId(req, res) void
        +GET_status(req, res) void
        +DELETE_cancel(req, res) void
    }
    
    class PassengerRouter {
        +POST_create(req, res) void
        +GET_byId(req, res) void
        +GET_all(req, res) void
    }
    
    class CabRouter {
        +POST_create(req, res) void
        +GET_all(req, res) void
        +GET_available(req, res) void
        +PATCH_status(req, res) void
    }
    
    class PoolRouter {
        PoolMatcher poolMatcher
        +GET_details(req, res) void
        +POST_match(req, res) void
    }
    
    class ValidationMiddleware {
        +validate(schema) Function
        +createBookingSchema JoiSchema
        +createPassengerSchema JoiSchema
        +createCabSchema JoiSchema
    }
    
    class ErrorHandler {
        +errorHandler(err, req, res, next) void
        +notFoundHandler(req, res) void
        +asyncHandler(fn) Function
    }
    
    BookingRouter > ValidationMiddleware
    BookingRouter > ErrorHandler
    PassengerRouter > ValidationMiddleware
    CabRouter > ValidationMiddleware
```

## Algorithm Components

```mermaid
classDiagram
    class Location {
        +number lat
        +number lng
    }
    
    class RouteSegment {
        +string type
        +number booking_id
        +Location location
        +number sequence
    }
    
    class OptimizedRoute {
        +RouteSegment[] waypoints
        +number total_distance_km
        +number total_duration_minutes
    }
    
    class MatchResult {
        +Map~number, Booking[]~ updatedPools
        +Map~string, Booking[]~ newPools
    }
    
    RouteSegment > Location
    OptimizedRoute > RouteSegment
```

## Concurrency Control

```mermaid
classDiagram
    class ConcurrencyManager {
        +acquireDistributedLock(key, ttl) boolean
        +releaseDistributedLock(key) void
        +withOptimisticLock(query, version) QueryResult
    }
    
    class ConnectionPool {
        number maxConnections
        Connection[] connections
        +getConnection() Connection
        +releaseConnection(conn) void
    }
    
    PoolMatcher > ConcurrencyManager
    Database > ConnectionPool
```

## Key Relationships

### 1toMany
 **Passenger → Bookings**: One passenger can have multiple bookings
 **Cab → RidePools**: One cab can serve multiple pools over time
 **RidePool → PoolParticipants**: One pool has multiple participants

### ManytoMany
 **Bookings ↔ RidePools**: Implemented via `pool_participants` junction table

### Dependencies
 **PoolMatcher → RidePoolingAlgorithm**: Uses algorithm for matching
 **RidePoolingAlgorithm → RouteOptimizer**: Uses optimizer for route calculations
 **All Services → Database/Redis**: Data access layer

## Design Principles Applied

1. **Single Responsibility**: Each class has one primary responsibility
2. **Open/Closed**: Extensible via interfaces (e.g., PricingStrategy)
3. **Dependency Inversion**: Services depend on abstractions (Database interface)
4. **Interface Segregation**: Focused interfaces for each service
5. **DRY**: Helper utilities for common operations

## Thread Safety Mechanisms

1. **Distributed Locks**: Redisbased locks for critical sections
2. **Optimistic Locking**: Version fields in database
3. **Connection Pooling**: Threadsafe connection management
4. **Immutable Data**: TypeScript readonly properties where applicable

