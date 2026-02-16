# System Design Documents

## 1. High-Level Design (HLD) - System Architecture

This diagram illustrates the high-level architecture of the Smart Airport Ride Pooling System, showing how different components interact to handle ride requests, matching, and data persistence.

![High Level Design - System Architecture](docs/assets/hld-architecture.png)

*Note: This diagram illustrates the high-level architecture of the Smart Airport Ride Pooling System.*

### **Component Description:**

*   **Client App:** Sends booking requests and polls for status updates.
*   **Load Balancer:** Distributes incoming traffic across Node.js verify instances.
*   **Node.js API Cluster:** Handles concurrent requests using multiple processes.
*   **Service Layer:** Contains business logic for bookings, pricing, and matching.
*   **Algorithm Core:** Implements the ride pooling and route optimization logic.
*   **PostgreSQL:** Stores persistent data (users, bookings, rides).
*   **Redis:** Handles caching and distributed locking for concurrency control.
*   **Matching Worker:** Background process that periodically matches pending bookings.

---

## 2. Low-Level Design (LLD) - Class Diagram

This diagram details the core classes, their attributes, and relationships, following the Repository and Strategy patterns.

```mermaid
classDiagram
    %% Core Entities
    class Booking {
        +int id
        +int passenger_id
        +float pickup_lat
        +float pickup_lng
        +float dropoff_lat
        +float dropoff_lng
        +int seats_required
        +int luggage_count
        +float base_price
        +float final_price
        +string status
    }

    class RidePool {
        +int id
        +string pool_code
        +int cab_id
        +string status
        +float total_distance
        +json optimized_route
    }
    
    class Cab {
        +int id
        +string driver_name
        +string license_plate
        +int capacity
        +float current_lat
        +float current_lng
        +string status
    }

    %% Services
    class BookingService {
        -PricingEngine pricingEngine
        +createBooking(data) Booking
        +cancelBooking(id) void
        +getPendingBookings() Booking[]
    }

    class PoolMatcher {
        -RidePoolingAlgorithm algorithm
        -RouteOptimizer optimizer
        -BookingService bookingService
        +runMatching() void
        +handleCancellation(bookingId) void
    }

    class PricingEngine {
        +calculatePrice(booking, isPooled) float
        -getSurgeMultiplier() float
        -isPeakHour() bool
    }

    %% Algorithms
    class RidePoolingAlgorithm {
        +matchRides(bookings, pools, cabs) Result
        -canAddToPool(booking, pool) bool
        -checkConstraints(booking, pool) bool
    }

    class RouteOptimizer {
        +optimize(bookings) Route
        +calculateDistance(loc1, loc2) float
        -findOptimalSequence(waypoints) Waypoint[]
    }

    %% Relationships
    PoolMatcher --> RidePoolingAlgorithm : uses
    PoolMatcher --> BookingService : uses
    RidePoolingAlgorithm --> RouteOptimizer : uses
    BookingService --> PricingEngine : uses
    RidePool "1" -- "*" Booking : contains
    RidePool "1" -- "1" Cab : assigned_to
```

### **Design Patterns Used:**

*   **Singleton:** Applied to Database and Redis connections to ensure a single shared instance.
*   **Strategy:** Used in `PricingEngine` to allow flexible pricing strategies (e.g., surge, flat rate).
*   **Repository:** abstracted data access logic within Service classes.
*   **Factory:** Implicitly used in `PoolMatcher` to create new `RidePool` instances.
