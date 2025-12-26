# Architecture Review: Home OS Energy Monitoring System

## Executive Summary

This is a Next.js 16 application for real-time energy monitoring with MQTT integration. The codebase demonstrates good foundational patterns (TypeScript, Prisma, component-based UI) but has several architectural issues that could impact maintainability and scalability.

---

## 1. Overall Structure and Patterns

### Strengths

✅ **Modern Tech Stack**
- Next.js 16 with App Router provides good routing and SSR capabilities
- TypeScript throughout ensures type safety
- Prisma ORM with PostgreSQL for reliable database management
- Server-Sent Events (SSE) for real-time data streaming

✅ **Clean Separation of Concerns (Partial)**
- Database layer (`lib/db.ts`) separated from API routes
- Type definitions centralized in `types/energy.ts`
- UI components isolated in `components/`

✅ **Testing Infrastructure**
- Unit tests with Vitest
- E2E tests with Playwright
- Testing setup properly configured

✅ **Database Design**
- Proper use of indexes on frequently queried fields (`timestamp`, `created_at`, `start_date`, `end_date`)
- Effective use of relations (EnergySettings ↔ ConsumingPricePeriod)
- Temporal data modeling with start_date/end_date pattern

---

## 2. Architectural Issues

### 🔴 Critical Issues

#### 2.1 Code Duplication (High Priority)

**Location:** `app/api/energy/aggregated/{route.ts, car/route.ts, solar/route.ts}`

**Problem:** The following functions are duplicated across three files:
- `getTimeframeBounds()` - ~50 lines duplicated
- `aggregateByHour()` - ~70 lines duplicated  
- `aggregateByDay()` - ~80 lines duplicated
- `calculateTotalEnergy()` - ~30 lines duplicated

**Impact:**
- Bug fixes must be applied in multiple places
- Inconsistent behavior risk (e.g., car route only processes positive values, but logic differs slightly)
- Maintenance burden increases exponentially

**Recommendation:**
```typescript
// Create lib/energy-aggregation.ts
export function getTimeframeBounds(timeframe: string): { start: number; end: number }
export function aggregateByHour<T>(readings: T[], extractor: (r: T) => number): AggregatedDataPoint[]
export function aggregateByDay<T>(readings: T[], extractor: (r: T) => number): AggregatedDataPoint[]
export function calculateTotalEnergy<T>(readings: T[], extractor: (r: T) => number): number
```

#### 2.2 MQTT Client Management (High Priority)

**Location:** `app/api/energy/route.ts`

**Problem:**
- MQTT client initialized in API route handler (singleton at module level)
- Client state (`currentEnergyData`, `lastHistoryTimestamp`) stored in module scope
- No graceful shutdown handling
- Hard to test (requires real MQTT broker)
- Hardcoded MQTT topics: `'go-eController/916791/ccp'` and `'go-eController/916791/utc'`

**Impact:**
- Testing requires external dependencies
- Multiple serverless instances could create multiple connections
- Configuration changes require code changes

**Recommendation:**
```typescript
// Create lib/mqtt-client.ts or lib/services/mqtt-service.ts
export class MqttService {
  private client: mqtt.MqttClient | null = null;
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();
  
  async connect(): Promise<void>
  subscribe(topic: string, callback: (data: any) => void): () => void
  async disconnect(): Promise<void>
}

// Use environment variables for topics
const MQTT_CCP_TOPIC = process.env.MQTT_CCP_TOPIC || 'go-eController/916791/ccp';
```

#### 2.3 Missing Service Layer (High Priority)

**Location:** Throughout `app/api/`

**Problem:** Business logic is scattered between:
- API route handlers (validation, transformation)
- Database layer (`lib/db.ts` - contains price calculation logic)
- Components (cost calculations in `energy-dashboard.tsx`)

**Example:** `calculateConsumptionCost` exists in `components/energy-dashboard.tsx`, but similar logic exists in `lib/db.ts` as `getConsumingPriceAt`.

**Recommendation:**
```typescript
// Create lib/services/energy-service.ts
export class EnergyService {
  calculateConsumptionCost(kwh: number, timestamp: number, settings: EnergySettings): number
  calculateFeedInCost(kwh: number, settings: EnergySettings): number
  aggregateEnergyData(readings: EnergyReading[], timeframe: string, type: 'grid' | 'car' | 'solar'): AggregatedResponse
}

// Create lib/services/energy-settings-service.ts
export class EnergySettingsService {
  getActiveSettings(timestamp?: number): Promise<EnergySettings | null>
  updateSettings(data: SettingsInput): Promise<EnergySettings>
  calculatePriceAt(timestamp: number, type: 'consuming' | 'producing'): Promise<number>
}
```

#### 2.4 Type Duplication

**Location:** `lib/db.ts` and `types/energy.ts`

**Problem:** `EnergyReading` interface is defined in both files with slight variations.

**Recommendation:** Remove from `lib/db.ts` and import from `types/energy.ts`. Use Prisma-generated types where possible.

### 🟡 Medium Priority Issues

#### 2.5 Large Component Files

**Location:** `components/energy-dashboard.tsx` (592 lines)

**Problem:**
- Multiple responsibilities (data fetching, state management, UI rendering, cost calculations)
- 8+ useState hooks managing related state
- Complex useEffect dependencies

**Recommendation:**
```typescript
// Extract custom hooks
// hooks/useEnergyData.ts
export function useEnergyData(timeframe: Timeframe) {
  // Consolidate grid, car, solar data fetching
}

// hooks/useEnergySettings.ts
export function useEnergySettings() {
  // Settings fetching logic
}

// Extract components
// components/energy-dashboard/EnergyCard.tsx
// components/energy-dashboard/EnergyChart.tsx
// components/energy-dashboard/TimeframeSelector.tsx
```

#### 2.6 Inconsistent Error Handling

**Location:** Throughout API routes

**Problem:**
- Some routes return generic errors: `{ error: 'Failed to...' }`
- Some routes include error details in development but not production
- No structured error response format
- Database errors are sometimes swallowed (e.g., `insertEnergyReading`)

**Recommendation:**
```typescript
// Create lib/errors.ts
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) { super(message); }
}

// Create lib/middleware/error-handler.ts
export function handleApiError(error: unknown): NextResponse
```

#### 2.7 Database Query Performance

**Location:** `lib/db.ts` - `getEnergyReadingsForRange`

**Problem:**
- Fetches all readings for a range into memory
- No pagination for large date ranges (e.g., monthly queries)
- Could return thousands of rows

**Recommendation:**
- Implement pagination or chunked processing
- Consider materialized views for aggregated data
- Add database query logging to identify slow queries

#### 2.8 SSE Connection Management

**Location:** `app/api/energy/route.ts` - GET handler

**Problem:**
- Interval continues running if client disconnects (potential memory leak)
- Fetches full history (100 entries) on every interval (1 second)
- No connection pooling or limits

**Recommendation:**
```typescript
// Add proper cleanup
request.signal.addEventListener('abort', () => {
  clearInterval(interval);
  controller.close();
  // Also cleanup any other resources
});

// Consider fetching history less frequently
// Only send updates when data actually changes
```

### 🟢 Low Priority Issues

#### 2.9 Missing Input Validation Layer

**Location:** API routes

**Problem:** Validation logic is inline in route handlers.

**Recommendation:** Use a validation library (Zod, Yup) with shared schemas:
```typescript
// lib/validators/energy-settings.schema.ts
export const energySettingsSchema = z.object({
  producing_price: z.number().nonnegative(),
  consuming_periods: z.array(consumingPeriodSchema).min(1),
  start_date: z.number().int().optional()
});
```

#### 2.10 Hardcoded Values

**Location:** Multiple files

**Problem:**
- Timezone handling uses local time without configuration
- Date formatting locales hardcoded ('en-US')
- Magic numbers (100 history entries, 1 second intervals)

**Recommendation:** Move to configuration:
```typescript
// lib/config.ts
export const config = {
  history: {
    defaultLimit: parseInt(process.env.HISTORY_LIMIT || '100'),
    maxLimit: 1000
  },
  sse: {
    updateInterval: parseInt(process.env.SSE_INTERVAL || '1000')
  },
  locale: process.env.LOCALE || 'en-US'
};
```

---

## 3. Scalability Concerns

### 3.1 Current Limitations

1. **Stateful MQTT Connection**: Module-level singleton won't work well in serverless environments (Vercel, AWS Lambda)
   - **Solution**: Move to external service or use managed MQTT with webhook integration

2. **SSE Memory Usage**: Each SSE connection holds state and runs intervals
   - **Solution**: Limit concurrent connections, use Redis for shared state

3. **Database Growth**: Energy readings accumulate indefinitely
   - **Solution**: Implement data retention policies, archive old data

4. **Synchronous Aggregation**: Large date ranges processed synchronously
   - **Solution**: Move to background jobs, cache aggregated results

### 3.2 Recommendations for Scale

**Immediate:**
- Add connection limits to SSE endpoint
- Implement caching for frequently accessed aggregated data (Redis)
- Add database query timeouts

**Medium-term:**
- Extract MQTT service to separate microservice or use managed service
- Implement background jobs for expensive aggregations
- Add database read replicas for analytics queries

**Long-term:**
- Consider time-series database (InfluxDB, TimescaleDB) for energy readings
- Implement event sourcing for energy data
- Add horizontal scaling with load balancer

---

## 4. Best Practices Already Followed

✅ **Type Safety**
- Comprehensive TypeScript usage
- Shared type definitions
- Type-safe API responses

✅ **Database Practices**
- Proper indexing strategy
- Relation modeling with Prisma
- Migration management

✅ **Testing**
- Unit tests for business logic
- E2E tests for critical user flows
- Test utilities and helpers

✅ **Code Organization**
- Clear separation between app/, components/, lib/
- Modular component structure
- Consistent naming conventions

✅ **React Patterns**
- Proper use of hooks (useState, useEffect)
- Client component isolation where needed
- Performance optimizations (useDeferredValue, startTransition)

✅ **Error Handling (Partial)**
- Try-catch blocks in async functions
- Error logging
- Graceful degradation in some areas

---

## 5. Recommended Refactoring Priority

### Phase 1: Reduce Duplication (Week 1-2)
1. Extract aggregation functions to shared module
2. Consolidate type definitions
3. Create shared validation schemas

### Phase 2: Service Layer (Week 3-4)
1. Extract business logic to service classes
2. Move cost calculations to services
3. Refactor API routes to use services

### Phase 3: Component Refactoring (Week 5-6)
1. Extract custom hooks from dashboard component
2. Split large components into smaller ones
3. Extract reusable UI components

### Phase 4: Infrastructure (Week 7-8)
1. Refactor MQTT client management
2. Improve error handling consistency
3. Add caching layer

---

## 6. Architecture Diagram Recommendation

Consider creating an architecture diagram showing:
- **Data Flow**: MQTT → API → Database → Frontend
- **Layer Separation**: Presentation → API → Service → Data
- **Component Boundaries**: Clear module responsibilities

---

## 7. Code Quality Metrics

**Current State:**
- **Lines of Code**: ~3,000 (excluding tests)
- **Average File Size**: ~150 lines (good, but dashboard.tsx is outlier)
- **Test Coverage**: Unknown (recommend adding coverage reporting)
- **Cyclomatic Complexity**: Moderate (aggregation functions are complex)

**Target Metrics:**
- File size < 300 lines
- Test coverage > 80%
- Cyclomatic complexity < 10 per function

---

## 8. Security Considerations

⚠️ **Issues Identified:**
1. No rate limiting on API endpoints
2. MQTT credentials in environment (good), but no credential rotation strategy
3. No input sanitization beyond basic validation
4. SSE endpoint has no authentication

**Recommendations:**
- Add rate limiting middleware
- Implement API authentication/authorization
- Add input sanitization for user-provided data
- Consider CORS configuration

---

## Conclusion

The codebase demonstrates solid fundamentals with modern technologies and good patterns. The primary concerns are **code duplication** and **missing service layer abstraction**, which should be addressed to improve maintainability. The architecture is suitable for current scale but will need refactoring for production deployments with high concurrency.

**Priority Actions:**
1. ✅ Extract duplicated aggregation logic
2. ✅ Create service layer for business logic
3. ✅ Refactor MQTT client management
4. ✅ Improve error handling consistency
5. ✅ Add rate limiting and security hardening
