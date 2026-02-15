# High Level Architecture

## System Overview

The Smart Airport Ride Pooling Backend System is designed as a **Microservices-Ready Monolith** that can handle 10,000+ concurrent users with sub-300ms latency.

## Architecture Diagram

```mermaid
graph TD
    A[Client Applications] -->|HTTP| B[Load Balancer/Nginx]
    B --> C1[Node.js Worker 1]
    B --> C2[Node.js Worker 2]
    B --> C3[Node.js Worker N]
    
    C1 --> D[Express API Gateway]
    C2 --> D
    C3 --> D
    
    D --> E[Service Layer]
    E --> E1[BookingService]
    E --> E2[PoolMatcher]
    E --> E3[PricingEngine]
    
    E1 --> F[Data Layer]
    E2 --> F
    E3 --> F
    
    F --> G[(PostgreSQL)]
    F --> H[(Redis)]
    
    I[Background Worker] -->|Every 5s| E2
    
    G -.->|Replication| J[(PostgreSQL Replica)]
```

## Component Breakdown

### 1. Client Layer
- **Mobile Apps**: iOS, Android applications
- **Web Dashboard**: Admin portal for monitoring
- **Third-party Integrations**: Partner APIs

### 2. API Gateway
- **Framework**: Express.js with TypeScript
- **Responsibilities**:
  - Request routing
  - Input validation (Joi)
  - Rate limiting (100 RPS per IP)
  - Error handling
  - CORS management

### 3. Service Layer

#### BookingService
- CRUD operations for bookings
- Price calculation integration
- Status management

#### PoolMatcher
- Orchestrates ride pooling process
- Distributed locking (Redis)
- Pool creation and updates
- Cancellation handling with rebalancing

#### PricingEngine
- Dynamic surge pricing
- Demand/supply ratio calculation
- Peak hour multipliers
- Pool discount application

### 4. Algorithm Layer

#### RidePoolingAlgorithm
- Modified greedy matching
- Constraint satisfaction
- O(n log n) complexity
- Handles seat, luggage, proximity, detour constraints

#### RouteOptimizer
- TSP-based optimization
- Greedy nearest neighbor
- Pickup-before-dropoff enforcement

### 5. Data Layer

#### PostgreSQL
- **Purpose**: Persistent storage, ACID compliance
- **Tables**: passengers, cabs, bookings, ride_pools, pool_participants
- **Optimization**: 
  - B-tree indexes on status columns
  - GiST spatial indexes for location queries
  - Connection pooling (20 connections)

#### Redis
- **Purpose**: Caching, distributed locking, job queues
- **Usage**:
  - Distributed locks for concurrency control
  - Route calculation cache (5 min TTL)
  - Cab availability cache
  - Job queue for async matching

### 6. Background Workers

#### Matching Worker
- **Interval**: 5 seconds
- **Process**: Fetches pending bookings → Runs matching → Creates/updates pools
- **Locking**: Prevents concurrent matching conflicts

## Data Flow

### 1. Booking Creation Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant API as API Gateway
    participant BS as BookingService
    participant PE as PricingEngine
    participant DB as PostgreSQL
    participant R as Redis
    
    C->>API: POST /api/bookings
    API->>API: Validate request
    API->>BS: createBooking()
    BS->>PE: calculatePrice()
    PE->>DB: Get pricing config
    PE->>DB: Get surge data
    PE-->>BS: Return price
    BS->>DB: Insert booking
    DB-->>BS: Return booking
    BS->>R: Enqueue for matching
    BS-->>API: Return booking
    API-->>C: 201 Created
```

### 2. Pool Matching Flow

```mermaid
sequenceDiagram
    participant BW as Background Worker
    participant PM as PoolMatcher
    participant RA as RidePoolingAlgorithm
    participant RO as RouteOptimizer
    participant DB as PostgreSQL
    participant R as Redis
    
    BW->>PM: runMatching()
    PM->>R: Acquire lock
    PM->>DB: Get pending bookings
    PM->>DB: Get forming pools
    PM->>DB: Get available cabs
    PM->>RA: matchRides()
    RA->>RA: Filter compatible
    RA->>RO: optimize route
    RO-->>RA: Optimized route
    RA-->>PM: Matched pools
    PM->>DB: Create/update pools
    PM->>DB: Update booking prices
    PM->>R: Release lock
```

### 3. Cancellation Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant API as API Gateway
    participant PM as PoolMatcher
    participant DB as PostgreSQL
    participant R as Redis
    
    C->>API: DELETE /api/bookings/:id
    API->>PM: handleCancellation()
    PM->>R: Acquire lock
    PM->>DB: Get pool association
    PM->>DB: Remove from pool
    PM->>DB: Get remaining bookings
    PM->>PM: Rebalance pool
    PM->>DB: Update pool route
    PM->>DB: Update prices
    PM->>R: Release lock
    PM-->>API: Success
    API-->>C: 200 OK
```

## Scalability Strategy

### Horizontal Scaling
- **Node.js Clustering**: One worker per CPU core
- **Database Read Replicas**: Route read queries to replicas
- **Redis Cluster**: Shard cache across nodes

### Vertical Scaling
- **Database**: Increase PostgreSQL memory, connections
- **Cache**: Expand Redis memory

### Performance Optimizations
1. **Connection Pooling**: Reuse database connections
2. **Query Optimization**: Strategic indexing
3. **Caching**: Route calculations, cab availability
4. **Async Processing**: Background matching workers
5. **Distributed Locking**: Prevent race conditions

## Monitoring & Observability

### Metrics
- Request latency (p50, p95, p99)
- Request throughput (RPS)
- Error rates
- Database query time
- Pool matching duration

### Logging
- Winston for structured logging
- Levels: error, warn, info, debug
- File-based in production
- Console in development

### Health Checks
- `/health` endpoint
- Database connectivity
- Redis connectivity

## Security Considerations

### Current Implementation
- Input validation (Joi)
- SQL injection prevention (parameterized queries)
- CORS configuration

### Future Enhancements
- JWT authentication
- Rate limiting per user
- API key management
- Data encryption
