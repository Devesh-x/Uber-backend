# Project Deliverables Checklist

This document maps the project requirements to the specific files and implementations in the codebase.

## 1. DSA Approach with Complexity Analysis
- **Implementation:** `src/algorithms/RidePoolingAlgorithm.ts`
- **Complexity Analysis:** Documented in class comments and `interview-prep-guide.md`
- **Algorithm:** Modified Greedy Matching with Constraint Satisfaction
- **Time Complexity:** O(n log n) - Sorting + Linear Scan
- **Space Complexity:** O(n)

## 2. Low Level Design (LLD)
- **Class Diagram:** `docs/class-diagram.md`
- **Design Patterns:**
  - **Singleton:** `src/utils/database.ts` (DB Connection), `src/utils/redis.ts` (Redis Client)
  - **Strategy:** `src/services/PricingEngine.ts` (Pricing logic)
  - **Repository Pattern:** `src/services/BookingService.ts`
  - **Factory Pattern:** `src/services/PoolMatcher.ts` (Pool creation)

## 3. High Level Architecture (HLD)
- **System Diagram:** `docs/architecture-diagram.md`
- **Components:** Express (API), Redis (Cache/Locks), PostgreSQL (DB), Background Workers

## 4. Concurrency Handling Strategy
- **Distributed Locking:** `src/services/PoolMatcher.ts` (uses Redis locks for matching)
- **Clustering:** `src/app.ts` (Node.js native clustering for multi-core support)
- **Database Transactions:** ACID transactions used in `PoolMatcher.ts` for atomic updates

## 5. Database Schema and Indexing
- **Schema Definition:** `database/schema.sql`
- **Tables:** `bookings`, `passengers`, `cabs`, `ride_pools`, `pool_participants`
- **Indexing Strategy:**
  - **GiST Index:** For fast geospatial queries (`pickup_location`)
  - **B-Tree Index:** For status and timestamp lookups
  - **Unique Constraints:** For data integrity

## 6. Dynamic Pricing Formula
- **Implementation:** `src/services/PricingEngine.ts`
- **Formula:**
  ```typescript
  Price = (Base + Distance*Rate + Time*Rate) * SurgeMultiplier * PeakMultiplier * PoolDiscount
  ```
- **Surge Logic:** Demand/Supply ratio calculation implemented in `getSurgeMultiplier()`
