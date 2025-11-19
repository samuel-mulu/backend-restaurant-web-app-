<!-- 574eb78b-7bbe-4cb7-95af-921b9aa0fa25 87b69d08-4381-4ea5-a2a2-8c560757d3dc -->
# Restaurant Backend Implementation - Detailed Phase Plan

## Phase 1: Core Infrastructure Updates

### 1.1 Update Role System

**File: `src/constants/roles.ts`**

- Change Role type from `"admin" | "cashier"` to `"owner" | "cashier" | "waiter"`
- Update ROLES array to `["owner", "cashier", "waiter"]`
- Update ROLE_LABELS: `{ owner: "Owner", cashier: "Cashier", waiter: "Waiter" }`
- Remove "admin" references

**File: `src/common/middleware/authMiddleware.ts`**

- Update ROLE_RANK: `{ owner: 2, cashier: 1, waiter: 1 }`
- Add `requireOwner` export: `export const requireOwner = requireRole("owner")`
- Add `requireWaiter` export: `export const requireWaiter = requireRole("waiter")`
- Update Request interface user.role type to new Role type
- Update requireAuth middleware to select new fields (phone, status) if needed

**Files to update:**

- `src/modules/auth/user.model.ts` - Update Role type import
- `src/modules/auth/auth.service.ts` - Update role type references

### 1.2 Update User Model

**File: `src/modules/auth/user.model.ts`**

- Update Role type import from constants
- Add to UserDoc interface:
- `phone: string` (required, unique, indexed)
- `salary?: number` (optional, min: 0)
- `status: "active" | "inactive"` (default: "active", indexed)
- Update role enum in schema: `["owner", "cashier", "waiter"]`
- Add schema fields:
- `phone: { type: String, required: true, unique: true, index: true }`
- `salary: { type: Number, min: 0 }`
- `status: { type: String, enum: ["active", "inactive"], default: "active", index: true }`
- Add compound index: `{ role: 1, status: 1 }` for efficient queries
- Update isActive field logic or replace with status field (decide: keep both or migrate)

**Migration consideration:** Existing users need default values for new fields

---

## Phase 2: Staff Management Module (Owner Only)

### 2.1 Create Staff Model

**File: `src/modules/staff/staff.model.ts`**

- Create StaffDoc interface extending UserDoc or reference User model
- Decision: Use User model directly or create separate Staff collection
- If separate: Create StaffSchema with reference to User
- If using User: Create StaffService that queries User with role filter

**Recommended approach:** Use User model directly, create StaffService for business logic

### 2.2 Create Staff Service

**File: `src/modules/staff/staff.service.ts`**

- `listStaff(filters: { role?, status?, search? })` - Query User with filters
- `getStaffById(id: string)` - Find user by ID, validate role is cashier/waiter
- `createStaff(data: CreateStaffInput)` - Create user with role cashier/waiter
- `updateStaff(id: string, data: UpdateStaffInput)` - Update phone, salary, status, role
- `deleteStaff(id: string)` - Soft delete: set status to "inactive"
- `getStaffAttendance(id: string)` - Optional: return attendance records

**Business rules:**

- Only owner can create staff
- Cannot create owner role via staff endpoint
- Email must be unique
- Phone must be unique
- Validate role is cashier or waiter

### 2.3 Create Staff Controller

**File: `src/modules/staff/staff.controller.ts`**

- `GET /staff` - List all staff with filters (role, status, search query)
- `POST /staff` - Create staff (Owner only, validate role)
- `GET /staff/:id` - Get staff details
- `PATCH /staff/:id` - Update staff (Owner only)
- `DELETE /staff/:id` - Soft delete staff (Owner only)
- `GET /staff/:id/attendance` - Optional: get attendance

**Response format:** Follow existing pattern with success/error structure

### 2.4 Create Staff Routes

**File: `src/modules/staff/staff.routes.ts`**

- Import Router, requireAuth, requireOwner
- Apply requireAuth to all routes
- Apply requireOwner to POST, PATCH, DELETE
- GET routes: Owner can see all, Cashier/Waiter can see active only

### 2.5 Create Staff Validation

**File: `src/modules/staff/staff.validation.ts`**

- Joi schemas:
- `createStaffSchema`: name, email, password, phone, role (cashier/waiter), salary?
- `updateStaffSchema`: phone?, salary?, status?, role?
- `listStaffSchema`: role?, status?, search?, page?, limit?
- Phone validation: regex for valid phone format
- Email validation: Joi.email()
- Role validation: Joi.string().valid("cashier", "waiter")
- Salary validation: Joi.number().min(0)

---

## Phase 3: Salary Management Module (Owner Only)

### 3.1 Create Salary Model

**File: `src/modules/salary/salary.model.ts`**

- SalaryDoc interface:
- `staffId: ObjectId` (ref: User, required, indexed)
- `amount: number` (required, min: 0)
- `month: string` (YYYY-MM format, required, indexed)
- `year: number` (required, indexed)
- `paymentDate: Date` (required)
- `status: "pending" | "paid"` (default: "pending", indexed)
- `remarks?: string`
- `createdBy: ObjectId` (ref: User, owner, required)
- Schema with timestamps
- Compound unique index: `{ staffId: 1, month: 1, year: 1 }` - prevent duplicates
- Indexes: `{ staffId: 1 }`, `{ month: 1, year: 1 }`, `{ status: 1 }`

### 3.2 Create Salary Service

**File: `src/modules/salary/salary.service.ts`**

- `listSalaries(filters: { staffId?, month?, year?, status? })` - Query with filters
- `getSalaryById(id: string)` - Find by ID
- `createSalary(data: CreateSalaryInput, createdBy: string)` - Create salary record
- `updateSalary(id: string, data: UpdateSalaryInput)` - Update amount, status, paymentDate
- `getSalarySummary(filters: { month?, year? })` - Aggregate by staff, return monthly totals
- `getStaffSalaryHistory(staffId: string)` - Get all salaries for staff
- `exportSalaries(filters, format: "csv" | "pdf")` - Optional: generate export

**Business rules:**

- Validate staff exists and is active
- Prevent duplicate salary for same staff/month/year
- Validate month format (YYYY-MM)
- Validate amount > 0
- Only owner can create/update

### 3.3 Create Salary Controller

**File: `src/modules/salary/salary.controller.ts`**

- `GET /salary` - List salaries with filters
- `POST /salary` - Create salary record (Owner only)
- `PATCH /salary/:id` - Update salary (Owner only)
- `GET /salary/summary` - Monthly summary by staff
- `GET /salary/staff/:staffId` - Salary history for staff
- `GET /salary/export` - Export to CSV/PDF (optional)

### 3.4 Create Salary Routes

**File: `src/modules/salary/salary.routes.ts`**

- Apply requireAuth to all routes
- Apply requireOwner to POST, PATCH
- GET routes: Owner only

### 3.5 Create Salary Validation

**File: `src/modules/salary/salary.validation.ts`**

- `createSalarySchema`: staffId (ObjectId), amount (min: 0), month (YYYY-MM), year, paymentDate, status?, remarks?
- `updateSalarySchema`: amount?, status?, paymentDate?, remarks?
- `listSalarySchema`: staffId?, month?, year?, status?, page?, limit?
- Month validation: regex `/^\d{4}-\d{2}$/`
- Year validation: reasonable range (e.g., 2020-2100)

---

## Phase 4: Product & Category Enhancements

### 4.1 Update Item Model

**File: `src/modules/items/item.model.ts`**

- Add to ItemDoc interface:
- `productType: "menu" | "inventory"` (default: "menu")
- `stock?: number` (optional, for inventory products)
- `unit?: string` (e.g., "kg", "liters", "pieces")
- Update schema:
- `productType: { type: String, enum: ["menu", "inventory"], default: "menu", index: true }`
- `stock: { type: Number, min: 0 }`
- `unit: { type: String }`
- Add index: `{ productType: 1, isAvailable: 1 }`
- Update existing indexes if needed

### 4.2 Update Item Service

**File: `src/modules/items/item.service.ts`** (if exists, or create)

- Update listItems to accept `type` filter (menu/inventory)
- Add validateStockUpdate for inventory products
- Add business rule: menu products cannot have stock (set to null)
- Update create/update logic to handle productType

### 4.3 Update Item Controller

**File: `src/modules/items/item.controller.ts`**

- Update list controller to accept `?type=menu|inventory` query param
- Filter by productType in list query
- Validate stock updates only for inventory products
- Prevent menu products from having stock field set

### 4.4 Update Category Model (Optional)

**File: `src/modules/categories/category.model.ts`**

- Consider adding `productType` field if categories should be type-specific
- Or keep categories generic and filter by product type in items
- Decision: Keep categories generic (recommended)

**Access Control:**

- Cashier: Can manage products and categories
- Owner: Can view all
- Update middleware in item.routes.ts if needed

---

## Phase 5: Order Management Enhancements

### 5.1 Update Order Model

**File: `src/modules/orders/order.model.ts`**

- Update OrderDoc interface:
- `waiterId?: ObjectId` (ref: User, role: waiter, indexed)
- `cashierId?: ObjectId` (ref: User, role: cashier, indexed)
- Update `status` enum: `"pending" | "preparing" | "ready" | "served" | "completed"`
- `orderNumber: string` (unique, indexed, auto-generated)
- `discount?: number` (percentage 0-100 or fixed amount)
- `notes?: string` (order modifications)
- `offlineId?: string` (for offline-created orders, optional)
- Update schema with new fields
- Add indexes: `{ waiterId: 1 }`, `{ cashierId: 1 }`, `{ orderNumber: 1 }`, `{ status: 1 }`
- Keep existing fields: tableNumber, items, totalAmount, etc.

### 5.2 Update Order Service

**File: `src/modules/orders/order.service.ts`**

- Update `genCode` or create `generateOrderNumber()`: Format `ORD-YYYYMMDD-XXXX` (e.g., ORD-20241201-0001)
- Implement order number generation with date prefix and sequential number
- Update `createOrder`:
- Auto-assign `cashierId` from req.user (if cashier role)
- Validate `waiterId` exists and has waiter role
- Generate `orderNumber`
- Calculate total with discount (if percentage: `total * (1 - discount/100)`, if fixed: `total - discount`)
- Add `updateOrderStatus(id: string, status: OrderStatus, userId: string)`:
- Validate status transitions (pending → preparing → ready → served → completed)
- Validate user has permission (waiter can update to served/completed)
- Add `updateOrder(id: string, data: UpdateOrderInput)`:
- Update discount, notes, items
- Recalculate totalAmount
- Add `getOrdersByWaiter(waiterId: string)` - Filter by waiterId
- Add `getOrdersByCashier(cashierId: string)` - Filter by cashierId

### 5.3 Update Order Controller

**File: `src/modules/orders/order.controller.ts`**

- Update `create`: Extract cashierId from req.user, require waiterId
- Add `list`: Accept filters (status, waiterId, cashierId, date range)
- Add `getById`: Get order details
- Add `updateStatus`: PATCH `/orders/:id/status` - Update status (Waiter/Cashier)
- Add `update`: PATCH `/orders/:id` - Update order (Cashier only)
- Add `getByWaiter`: GET `/orders/waiter/:waiterId` - Get orders for waiter
- Add `cancel`: DELETE `/orders/:id` - Cancel order (soft delete or status change)

**Access Control:**

- Cashier: Create, update, assign orders
- Waiter: View assigned orders, update status (served/completed)
- Owner: View all orders

### 5.4 Update Order Routes

**File: `src/modules/orders/order.routes.ts`**

- Update route handlers
- Apply requireCashier to POST, PATCH (update)
- Apply requireRole("waiter", "cashier") to PATCH status
- Apply requireAuth to all routes

---

## Phase 6: Inventory Management Module

### 6.1 Create Inventory Model

**File: `src/modules/inventory/inventory.model.ts`**

- InventoryDoc interface:
- `productId: ObjectId` (ref: Item, productType: "inventory", required, unique, indexed)
- `quantity: number` (required, min: 0)
- `unit: string` (required, e.g., "kg", "liters")
- `minThreshold?: number` (optional, min: 0)
- `lastPurchaseDate?: Date`
- `purchaseHistory: Array<{ quantity: number, purchaseDate: Date, cost: number, purchasedBy: ObjectId }>`
- Schema with timestamps
- Index: `{ productId: 1 }` (unique)
- Index: `{ quantity: 1 }` for low stock queries

### 6.2 Create Inventory Service

**File: `src/modules/inventory/inventory.service.ts`**

- `listInventory(filters: { lowStock?: boolean })` - List items, filter low stock
- `getInventoryById(id: string)` - Find by ID
- `createInventory(data: CreateInventoryInput)` - Create inventory item, link to product
- `updateInventory(id: string, data: UpdateInventoryInput)` - Update quantity, threshold
- `recordPurchase(id: string, data: PurchaseInput, purchasedBy: string)` - Update quantity, add to history
- `getLowStockItems()` - Find items where quantity < minThreshold
- `getPurchaseHistory(id: string)` - Get purchase history for item

**Business rules:**

- Validate productId exists and has productType: "inventory"
- Validate quantity >= 0
- Validate minThreshold >= 0
- Update lastPurchaseDate on purchase

### 6.3 Create Inventory Controller

**File: `src/modules/inventory/inventory.controller.ts`**

- `GET /inventory` - List inventory items (with low stock filter)
- `POST /inventory` - Create inventory item (Cashier)
- `PATCH /inventory/:id` - Update quantity, threshold (Cashier)
- `POST /inventory/:id/purchase` - Record purchase (Cashier)
- `GET /inventory/low-stock` - Get items below threshold
- `GET /inventory/:id/history` - Get purchase history

### 6.4 Create Inventory Routes

**File: `src/modules/inventory/inventory.routes.ts`**

- Apply requireAuth to all routes
- Apply requireCashier to POST, PATCH
- GET routes: Cashier and Owner can access

### 6.5 Create Inventory Validation

**File: `src/modules/inventory/inventory.validation.ts`**

- `createInventorySchema`: productId (ObjectId), quantity (min: 0), unit, minThreshold?
- `updateInventorySchema`: quantity?, minThreshold?
- `purchaseSchema`: quantity (min: 0), cost (min: 0), purchaseDate?

---

## Phase 7: Statistics & Analytics Module (Owner Only)

### 7.1 Create Statistics Service

**File: `src/modules/statistics/statistics.service.ts`**

- `getDashboardStats(dateRange?: { start?, end? })`:
- Total sales (today/week/month) - Aggregate Order.totalAmount by date
- Total orders (today/week/month) - Count orders by date
- Active staff count - Count User with status: "active"
- Low stock items count - Count Inventory where quantity < minThreshold
- `getSalesAnalytics(filters: { startDate?, endDate?, cashierId? })`:
- Sales by day/week/month - Group by date, sum totalAmount
- Sales by cashier - Group by cashierId, sum totalAmount
- Sales trends - Time series data
- `getProductAnalytics(filters: { startDate?, endDate?, limit? })`:
- Best selling items - Aggregate Order.items, group by itemId, sum qty, sort desc
- Revenue by product - Group by itemId, sum (priceSnapshot * qty)
- Product performance over time - Time series by product
- `getStaffPerformance(filters: { startDate?, endDate? })`:
- Orders handled by waiter - Count/group by waiterId
- Orders processed by cashier - Count/group by cashierId
- Performance metrics - Average order value, orders per day
- `getInventoryAnalytics(filters: { startDate?, endDate? })`:
- Consumption trends - Analyze purchase history
- Purchase costs - Sum costs from purchase history
- Stock levels over time - Time series of quantity

**Implementation:**

- Use MongoDB aggregation pipelines
- Support date range filters
- Consider caching for frequently accessed stats (optional)

### 7.2 Create Statistics Controller

**File: `src/modules/statistics/statistics.controller.ts`**

- `GET /statistics/dashboard` - Overview metrics
- `GET /statistics/sales` - Sales analytics
- `GET /statistics/products` - Product analytics
- `GET /statistics/staff` - Staff performance
- `GET /statistics/inventory` - Inventory analytics

### 7.3 Create Statistics Routes

**File: `src/modules/statistics/statistics.routes.ts`**

- Apply requireAuth to all routes
- Apply requireOwner to all routes

---

## Phase 8: Route Integration

### 8.1 Update Main Routes

**File: `src/modules/routes.ts`**

- Import new route modules:
- `import staffRoutes from "./staff/staff.routes"`
- `import salaryRoutes from "./salary/salary.routes"`
- `import inventoryRoutes from "./inventory/inventory.routes"`
- `import statisticsRoutes from "./statistics/statistics.routes"`
- Add route mounts:
- `router.use("/staff", staffRoutes)`
- `router.use("/salary", salaryRoutes)`
- `router.use("/inventory", inventoryRoutes)`
- `router.use("/statistics", statisticsRoutes)`
- Ensure all routes use requireAuth middleware (should be in individual route files)
- Verify role-based middleware is applied correctly

---

## Phase 9: Validation & Security

### 9.1 Create/Update Validation Schemas

**Files to create:**

- `src/modules/staff/staff.validation.ts` - Joi schemas (see Phase 2.5)
- `src/modules/salary/salary.validation.ts` - Joi schemas (see Phase 3.5)
- `src/modules/inventory/inventory.validation.ts` - Joi schemas (see Phase 6.5)
- `src/modules/orders/order.validation.ts` - Update existing or create new for order updates

**Update existing:**

- `src/modules/items/item.validation.ts` - Add productType, stock, unit validation

### 9.2 Security Enhancements

**Files to update:**

- `src/common/middleware/rateLimiter.ts` (create if doesn't exist):
- Add rate limiting for sensitive endpoints (salary, staff creation)
- Use express-rate-limit
- `src/common/middleware/sanitize.ts` (create if doesn't exist):
- Input sanitization for all user inputs
- Use express-validator or similar
- Update controllers to validate ObjectId formats
- Ensure soft deletes where appropriate (staff, orders)
- Consider audit logs for critical operations (optional)

---

## Phase 10: Socket.io Integration (Real-time Updates)

### 10.1 Update Socket Events

**File: `src/sockets/events.ts`**

- Add order status change events:
- `order:status:changed` - Emit when order status updates
- Payload: { orderId, status, updatedBy }
- Add new order assignment notifications:
- `order:assigned:waiter` - Emit to specific waiter when order assigned
- Payload: { orderId, waiterId, orderNumber }
- Add inventory low stock alerts:
- `inventory:low:stock` - Emit to owner/cashier when stock below threshold
- Payload: { productId, productName, quantity, minThreshold }
- Add real-time statistics updates (optional):
- `statistics:updated` - Emit dashboard updates

### 10.2 Update Change Streams

**File: `src/sockets/changeStreams.ts`** (create if doesn't exist)

- Watch Order collection for status changes
- Watch Inventory collection for quantity changes
- Emit events to relevant users based on role
- Use MongoDB change streams API

**File: `src/sockets/socket.ts`**

- Update socket connection handling
- Add room management for role-based events
- Join users to rooms based on role (owner, cashier, waiter)

---

## Phase 11: Testing & Documentation

### 11.1 API Documentation

**File: `API_DOCUMENTATION.md`** (create)

- Document all endpoints with:
- HTTP method and path
- Authentication requirements
- Role-based access control
- Request body/query parameters
- Response format
- Example requests/responses
- Group by module (Staff, Salary, Inventory, Statistics, Orders, Items)

### 11.2 Error Handling

**File: `src/common/middleware/errorHandler.ts`**

- Ensure consistent error response format (already exists, verify)
- Add proper HTTP status codes for new endpoints
- Include error messages for validation failures
- Test error scenarios

### 11.3 Testing Considerations

- Unit tests for services (optional)
- Integration tests for API endpoints (optional)
- Test role-based access control
- Test validation schemas
- Test business rules (duplicate prevention, status transitions)

---

## Implementation Notes

- Follow existing code patterns (service layer, error handling)
- Use TypeScript interfaces for type safety
- Maintain consistency with existing module structure
- All endpoints should return consistent JSON responses: `{ success: boolean, message?: string, data?: any, details?: any }`
- Use MongoDB transactions for critical operations (salary creation, inventory updates)
- Consider migration script for existing users to add phone, status fields
- Order number generation: Use date-based prefix with sequential counter (consider Redis for counter or database sequence)

### To-dos

- [ ] Phase 1.1: Update role system - Update roles.ts to add owner/waiter, update authMiddleware with new role ranks and middleware exports
- [ ] Phase 1.2: Update User model - Add phone, salary, status fields to user.model.ts with proper schema and indexes
- [ ] Phase 2.1: Create Staff model/service - Use User model directly, create staff.service.ts with business logic for staff management
- [ ] Phase 2.2-2.4: Create Staff controller, routes, and validation - Implement CRUD endpoints with Owner-only access control and Joi validation schemas
- [ ] Phase 3: Create Salary management module - Model, service, controller, routes, validation for salary tracking with duplicate prevention and monthly summaries
- [ ] Phase 4: Enhance Item model - Add productType (menu/inventory), stock, unit fields. Update controllers to filter by type and validate stock updates
- [ ] Phase 5: Enhance Order management - Add waiterId, cashierId, orderNumber, discount, new status flow. Update service with order number generation and status transitions
- [ ] Phase 6: Create Inventory management module - Model with purchase history, service for stock tracking, controller/routes with Cashier access, validation schemas
- [ ] Phase 7: Create Statistics module - Service with MongoDB aggregations for dashboard, sales, products, staff, inventory analytics. Owner-only routes
- [ ] Phase 8: Integrate all modules - Add staff, salary, inventory, statistics routes to main routes.ts file with proper middleware
- [ ] Phase 9: Validation and security - Create all Joi validation schemas, add rate limiting for sensitive endpoints, implement input sanitization
- [ ] Phase 10: Socket.io integration - Add real-time events for order status changes, waiter assignments, inventory alerts. Implement change streams
- [ ] Phase 11: Documentation and testing - Create API documentation, verify error handling, add test considerations for all new endpoints