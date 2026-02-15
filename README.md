# Smart Airport Ride Pooling Backend System

A production-ready backend system for intelligent airport ride pooling that optimizes passenger grouping while respecting capacity, luggage, and detour constraints.

## 🚀 Features

- **Intelligent Matching Algorithm**: Modified greedy matching with constraint satisfaction (O(n log n) complexity)
- **Dynamic Pricing**: Real-time surge pricing based on demand/supply ratio
- **Concurrency Support**: Node.js clustering for 10,000+ concurrent users
- **Real-time Cancellation**: Automatic pool rebalancing on cancellations
- **Optimized Routes**: TSP-based route optimization for minimal detours
- **RESTful APIs**: Complete CRUD operations with Swagger documentation
- **Distributed Locking**: Redis-based concurrency control
- **Database Optimization**: PostgreSQL with strategic indexing

## 📋 Table of Contents

- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Algorithm Documentation](#algorithm-documentation)
- [Performance Metrics](#performance-metrics)
- [Project Structure](#project-structure)

## 🛠 Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL 14+
- **Cache/Queue**: Redis 7+
- **Validation**: Joi
- **Logging**: Winston
- **Testing**: Jest + Supertest
- **Documentation**: Swagger/OpenAPI

## 🏗 System Architecture

```
┌─────────────────┐
│  Load Balancer  │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼──┐  ┌──▼───┐
│Worker│  │Worker│  (Node.js Clustering)
└───┬──┘  └──┬───┘
    │        │
    └────┬───┘
         │
    ┌────▼────────────┐
    │  Express Server │
    └────┬────────────┘
         │
    ┌────┴─────────────┐
    │                  │
┌───▼──────┐    ┌──────▼────┐
│PostgreSQL│    │   Redis   │
└──────────┘    └───────────┘
```

### Key Components

1. **API Gateway**: Express.js with rate limiting
2. **Service Layer**: Business logic (BookingService, PoolMatcher, PricingEngine)
3. **Algorithm Layer**: RidePoolingAlgorithm, RouteOptimizer
4. **Data Layer**: PostgreSQL + Redis
5. **Background Worker**: Automatic matching every 5 seconds

## ✅ Prerequisites

- Node.js >= 18.0.0
- PostgreSQL >= 14.0
- Redis >= 7.0
- npm or yarn

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd uber
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Copy environment file**
   ```bash
   copy .env.example .env
   ```

4. **Configure environment variables** (see [Configuration](#configuration))

## ⚙️ Configuration

Edit the `.env` file with your configuration:

```env
# Server
NODE_ENV=development
PORT=3000

# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=ride_pooling
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Application Settings
MAX_POOL_SIZE=4
DETOUR_TOLERANCE_MINUTES=15
MATCHING_INTERVAL_MS=5000

# Logging
LOG_LEVEL=info
```

## 🗄 Database Setup

### 1. Create PostgreSQL Database

```bash
# Windows (PowerShell)
psql -U postgres
CREATE DATABASE ride_pooling;
\q
```

### 2. Run Schema Migration

```bash
psql -U postgres -d ride_pooling -f database/schema.sql
```

This creates:
- All tables (passengers, cabs, bookings, ride_pools, pool_participants, pricing_config)
- Optimized indexes (B-tree, GiST spatial indexes)
- Triggers for `updated_at` timestamps
- Views for common queries

### 3. Verify Installation

```bash
psql -U postgres -d ride_pooling
\dt  # List tables
\di  # List indexes
```

## 🚀 Running the Application

### Development Mode

```bash
npm run dev
```

Server starts on `http://localhost:3000` with:
- Hot reloading (nodemon)
- Single worker process
- Console logging

### Production Mode

```bash
npm run build
npm start
```

Features:
- Clustered mode (one worker per CPU core)
- Optimized performance
- File-based logging

### Health Check

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "success": true,
  "service": "ride-pooling-backend",
  "database": "connected",
  "timestamp": "2026-02-15T12:00:00.000Z"
}
```

## 📚 API Documentation

Interactive Swagger documentation available at:
```
http://localhost:3000/api-docs
```

### Key Endpoints

#### Bookings

- `POST /api/bookings` - Create new booking
- `GET /api/bookings/:id` - Get booking details
- `GET /api/bookings/:id/status` - Get real-time status
- `DELETE /api/bookings/:id` - Cancel booking
- `GET /api/bookings/passenger/:passengerId` - Get passenger's bookings

#### Passengers

- `POST /api/passengers` - Register passenger
- `GET /api/passengers/:id` - Get passenger details
- `GET /api/passengers` - List all passengers

#### Cabs

- `POST /api/cabs` - Register cab
- `GET /api/cabs` - List all cabs
- `GET /api/cabs/available` - Get available cabs
- `PATCH /api/cabs/:id/status` - Update cab status

#### Pools

- `GET /api/pools/:id` - Get pool details
- `POST /api/pools/match` - Trigger manual matching

### Example: Create Booking

```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "passenger_id": 1,
    "pickup_lat": 40.7128,
    "pickup_lng": -74.0060,
    "pickup_address": "JFK Airport Terminal 1",
    "dropoff_lat": 40.7580,
    "dropoff_lng": -73.9855,
    "dropoff_address": "Times Square",
    "seats_required": 1,
    "luggage_count": 1,
    "detour_tolerance_minutes": 15
  }'
```

## 🧪 Testing

### Run All Tests

```bash
npm test
```

### Run with Coverage

```bash
npm run test:coverage
```

### Watch Mode

```bash
npm run test:watch
```

## 📊 Algorithm Documentation

### Ride Pooling Algorithm

**Approach**: Modified Greedy Matching with Constraint Satisfaction

**Complexity Analysis**:
- **Time**: O(n log n + n\*k²) where k ≤ 4
  - Sorting: O(n log n)
  - Matching: O(n\*k²) with k = max pool size
- **Space**: O(n + m) where m = number of pools

**Constraints Checked**:
1. **Seat Capacity**: Σ(seats_required) ≤ cab_capacity
2. **Luggage**: Σ(luggage) ≤ luggage_capacity
3. **Proximity**: All pickups within 5km radius
4. **Detour Tolerance**: detour ≤ passenger's tolerance

### Route Optimization

**Algorithm**: Greedy Nearest Neighbor with pickup-before-dropoff constraint

**Process**:
1. Start from first pickup
2. Select nearest valid waypoint (respecting pickup/dropoff order)
3. Continue until all waypoints visited

### Dynamic Pricing

**Formula**:
```
Final Price = (Base + Distance×Rate + Time×Rate) × Surge × Peak × Pool Discount

Where:
- Base = $5.00
- Distance Rate = $2.00/km
- Time Rate = $0.50/min
- Surge = 1 + max(0, (Active Bookings / Available Cabs - 1) × 0.5)
- Peak Multiplier = 1.5 (6-9 AM, 5-8 PM)
- Pool Discount = 30%
```

## 📈 Performance Metrics

### Target Performance

- **Concurrent Users**: 10,000+
- **Requests per Second**: 100 RPS
- **Latency (p95)**: < 300ms
- **Matching Interval**: 5 seconds

### Optimization Strategies

1. **Database**:
   - B-tree indexes on status columns
   - GiST spatial indexes for location queries
   - Connection pooling (20 connections)

2. **Caching**:
   - Redis for route calculations (5 min TTL)
   - Hash maps for cab availability

3. **Concurrency**:
   - Node.js clustering (CPU cores)
   - Distributed locking (Redis)
   - Optimistic locking (version field)

## 📁 Project Structure

```
uber/
├── src/
│   ├── algorithms/
│   │   ├── RidePoolingAlgorithm.ts    # Core matching logic
│   │   └── RouteOptimizer.ts          # Route optimization
│   ├── models/
│   │   └── types.ts                   # TypeScript interfaces
│   ├── services/
│   │   ├── BookingService.ts          # Booking CRUD
│   │   ├── PricingEngine.ts           # Dynamic pricing
│   │   └── PoolMatcher.ts             # Pool orchestration
│   ├── routes/
│   │   ├── bookings.ts                # Booking endpoints
│   │   ├── passengers.ts              # Passenger endpoints
│   │   ├── cabs.ts                    # Cab endpoints
│   │   └── pools.ts                   # Pool endpoints
│   ├── middleware/
│   │   ├── validation.ts              # Joi validation
│   │   └── errorHandler.ts            # Error handling
│   ├── utils/
│   │   ├── database.ts                # PostgreSQL client
│   │   ├── redis.ts                   # Redis client
│   │   ├── logger.ts                  # Winston logger
│   │   └── helpers.ts                 # Utility functions
│   ├── config/
│   │   └── index.ts                   # Configuration
│   └── app.ts                         # Express app entry
├── database/
│   ├── schema.sql                     # Database schema
│   └── migrations/                    # Migration scripts
├── docs/
│   ├── architecture-diagram.md        # HLD
│   └── class-diagram.md               # LLD
├── tests/
│   ├── unit/                          # Unit tests
│   ├── integration/                   # API tests
│   └── performance/                   # Load tests
├── test-data/
│   └── test-data.json                 # Sample data
├── .env.example                       # Environment template
├── package.json                       # Dependencies
├── tsconfig.json                      # TypeScript config
└── README.md                          # This file
```

## 🔐 Concurrency Handling

### Strategies Implemented

1. **Distributed Locking** (Redis):
   ```typescript
   const lockAcquired = await redisClient.acquireLock('pool_matching', 10000);
   ```

2. **Optimistic Locking** (PostgreSQL):
   ```sql
   UPDATE bookings SET status = 'matched', version = version + 1
   WHERE id = ? AND version = ? AND status = 'pending'
   ```

3. **Connection Pooling**:
   - PostgreSQL: 20 connections/instance
   - Redis: 50 connections/instance

4. **Node.js Clustering**:
   - Spawn workers = CPU cores
   - Round-robin load balancing

## 🎯 Key Design Patterns

1. **Singleton**: Database & Redis connections
2. **Strategy**: Multiple pricing strategies
3. **Factory**: Pool creation
4. **Repository**: Data access abstraction
5. **Observer**: Real-time status updates

## 📝 Assumptions

- All rides are airport-related (pickup or dropoff at airport)
- Maximum 4 passengers per pool
- Detour tolerance: 5-30 minutes
- Average city speed: 40 km/h
- Peak hours: 6-9 AM, 5-8 PM

## 🐛 Troubleshooting

### Database Connection Failed

```bash
# Check PostgreSQL is running
net start postgresql-x64-14

# Verify credentials in .env
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password
```

### Redis Connection Error

```bash
# Start Redis server
redis-server

# Or use Windows Service
net start Redis
```

### Port Already in Use

```bash
# Change port in .env
PORT=3001
```

## 📄 License

MIT

## 👨‍💻 Author

Built for Backend Engineering Internship Assignment

## 🙏 Acknowledgments

- PostgreSQL for robust ACID compliance
- Redis for distributed locking
- Express.js for minimal overhead
- TypeScript for type safety
