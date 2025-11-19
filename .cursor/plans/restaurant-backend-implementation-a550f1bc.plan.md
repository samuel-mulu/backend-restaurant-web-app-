<!-- a550f1bc-909e-41a1-bdce-f5db715deec8 1a18dfde-289c-4f1d-863f-72b02ad2c3aa -->
# Restaurant Management Backend Implementation Plan

## Overview

Extend the existing Express + TypeScript + MongoDB backend to support a full restaurant management system with three roles (Owner, Cashier, Waiter), following the established module-based architecture pattern.

## Architecture Pattern

Each module follows: `model.ts` → `service.ts` → `controller.ts` → `routes.ts`

---

## Phase 1: Core Infrastructure Updates

### 1.1 Update Role System

**File: `src/constants/roles.ts`**

- Add `owner` and `waiter` to Role type
- Update ROLES array: `["owner", "cashier", "waiter"]`
- Update ROLE_LABELS mapping
- Update ROLE_RANK for hierarchy (owner: 2, cashier: 1, waiter: 1)

**File: `src/common/middleware/authMiddleware.ts`**

- Update ROLE_RANK to include owner and waiter
- Add `requireOwner`, `requireWaiter` exports
- Update Request interface if needed

### 1.2 Update User Model

**File: `src/modules/auth/user.model.ts`**

- Add fields: `phone: string`, `salary?: number`, `status: "active" | "inactive"`
- Update role enum to include `"owner" | "waiter"`
- Add indexes for phone, status, role
- Keep existing security fields (failedLoginCount, lockUntil, etc.)

---

## Phase 2: Staff Management Module (Owner Only)

### 2.1 Create Staff Module

**Files to create:**

- `src/modules/staff/staff.model.ts` - Reference User model (or extend it)
- `src/modules/staff/staff.service.ts` - Business logic
- `src/modules/staff/staff.controller.ts` - Request handlers
- `src/modules/staff/staff.routes.ts` - Route definitions

**Features:**

- `GET /staff` - List all staff (with filters: role, status, search)
- `POST /staff` - Create new staff member (Owner only)
- `GET /staff/:id` - Get staff details
- `PATCH /staff/:id` - Update staff (role, salary, status, phone)
- `DELETE /staff/:id` - Soft delete (set status to inactive)
- `GET /staff/:id/attendance` - Optional: attendance tracking

**Validation (Joi):**

- Phone format validation
- Role validation (cashier/waiter only, owner created separately)
- Salary range validation
- Email uniqueness

---

## Phase 3: Salary Management Module (Owner Only)

### 3.1 Create Salary Module

**Files to create:**

- `src/modules/salary/salary.model.ts`
- `src/modules/salary/salary.service.ts`
- `src/modules/salary/salary.controller.ts`
- `src/modules/salary/salary.routes.ts`

**Salary Model Schema:**

```typescript
{
  staffId: ObjectId (ref: User),
  amount: Number,
  month: String (YYYY-MM),
  year: Number,
  paymentDate: Date,
  status: "pending" | "paid",
  remarks?: String,
  createdBy: ObjectId (ref: User, owner)
}
```

**Features:**

- `GET /salary` - List salaries (filters: staffId, month, year, status)
- `POST /salary` - Record salary payment
- `PATCH /salary/:id` - Update salary record
- `GET /salary/summary` - Monthly summary by staff
- `GET /salary/export` - Export to CSV/PDF (optional)
- `GET /salary/staff/:staffId` - Salary history for specific staff

**Validation:**

- Month format (YYYY-MM)
- Amount > 0
- Staff must exist and be active
- Prevent duplicate salary for same staff/month

---

## Phase 4: Product & Category Enhancements

### 4.1 Update Item Model

**File: `src/modules/items/item.model.ts`**

- Add `productType: "menu" | "inventory"` field (default: "menu")
- Add `stock?: number` field (for inventory products)
- Add `unit?: string` field (e.g., "kg", "liters", "pieces")
- Update indexes to include productType

### 4.2 Update Item Controller/Service

**Files: `src/modules/items/item.controller.ts`, `item.service.ts`**

- Filter products by type in list endpoint: `?type=menu|inventory`
- Validate stock updates for inventory products
- Prevent menu products from having stock (or set to null)

### 4.3 Category Updates

**File: `src/modules/categories/category.model.ts`**

- Consider adding `productType` field if categories should be type-specific
- Or keep categories generic and filter by product type in items

**Access Control:**

- Cashier can manage products and categories
- Owner can view all

---

## Phase 5: Order Management Enhancements

### 5.1 Update Order Model

**File: `src/modules/orders/order.model.ts`**

- Add `waiterId: ObjectId` (ref: User, role: waiter)
- Add `cashierId: ObjectId` (ref: User, role: cashier)
- Update `status` enum: `"pending" | "preparing" | "ready" | "served" | "completed"`
- Add `orderNumber: string` (auto-generated, unique)
- Add `discount?: number` (percentage or fixed amount)
- Add `notes?: string` (order modifications, special requests)
- Add `offlineId?: string` (for offline-created orders)
- Keep existing fields (tableNumber, items, totalAmount, etc.)

### 5.2 Update Order Service

**File: `src/modules/orders/order.service.ts`**

- Generate unique orderNumber (format: ORD-YYYYMMDD-XXXX)
- Auto-assign cashierId from req.user
- Validate waiterId exists and has waiter role
- Calculate total with discount
- Support status transitions (pending → preparing → ready → served → completed)

### 5.3 Update Order Controller

**File: `src/modules/orders/order.controller.ts`**

- `POST /orders` - Create order (Cashier only, requires waiterId)
- `GET /orders` - List orders (filters: status, waiterId, cashierId, date)
- `GET /orders/waiter/:waiterId` - Get orders assigned to waiter
- `GET /orders/:id` - Get order details
- `PATCH /orders/:id/status` - Update order status (Waiter can update to served/completed)
- `PATCH /orders/:id` - Update order (discount, notes, items) - Cashier only
- `DELETE /orders/:id` - Cancel order (soft delete or status change)

**Access Control:**

- Cashier: Create, update, assign orders
- Waiter: View assigned orders, update status (served/completed)
- Owner: View all orders

---

## Phase 6: Inventory Management Module

### 6.1 Create Inventory Module

**Files to create:**

- `src/modules/inventory/inventory.model.ts`
- `src/modules/inventory/inventory.service.ts`
- `src/modules/inventory/inventory.controller.ts`
- `src/modules/inventory/inventory.routes.ts`

**Inventory Model Schema:**

```typescript
{
  productId: ObjectId (ref: Item, productType: "inventory"),
  quantity: Number,
  unit: String,
  minThreshold?: Number,
  lastPurchaseDate?: Date,
  purchaseHistory: [{
    quantity: Number,
    purchaseDate: Date,
    cost: Number,
    purchasedBy: ObjectId (ref: User)
  }]
}
```

**Features:**

- `GET /inventory` - List inventory items (with low stock alerts)
- `POST /inventory` - Add inventory item (link to product)
- `PATCH /inventory/:id` - Update quantity, threshold
- `POST /inventory/:id/purchase` - Record purchase (updates quantity, adds to history)
- `GET /inventory/low-stock` - Get items below threshold
- `GET /inventory/:id/history` - Purchase history for item

**Access Control:**

- Cashier: Manage inventory
- Owner: View and approve purchases

---

## Phase 7: Statistics & Analytics Module (Owner Only)

### 7.1 Create Statistics Module

**Files to create:**

- `src/modules/statistics/statistics.service.ts`
- `src/modules/statistics/statistics.controller.ts`
- `src/modules/statistics/statistics.routes.ts`

**Features:**

- `GET /statistics/dashboard` - Overview metrics
  - Total sales (today/week/month)
  - Total orders (today/week/month)
  - Active staff count
  - Low stock items count
- `GET /statistics/sales` - Sales analytics
  - Sales by day/week/month
  - Sales by cashier
  - Sales trends
- `GET /statistics/products` - Product analytics
  - Best selling items (top N)
  - Revenue by product
  - Product performance over time
- `GET /statistics/staff` - Staff performance
  - Orders handled by waiter
  - Orders processed by cashier
  - Performance metrics
- `GET /statistics/inventory` - Inventory analytics
  - Consumption trends
  - Purchase costs
  - Stock levels over time

**Implementation Notes:**

- Use MongoDB aggregation pipelines
- Cache frequently accessed stats (optional)
- Support date range filters

---

## Phase 8: Route Integration

### 8.1 Update Main Routes

**File: `src/modules/routes.ts`**

- Add staff routes: `router.use("/staff", staffRoutes)`
- Add salary routes: `router.use("/salary", salaryRoutes)`
- Add inventory routes: `router.use("/inventory", inventoryRoutes)`
- Add statistics routes: `router.use("/statistics", statisticsRoutes)`
- Ensure all routes use `requireAuth` middleware
- Apply role-based middleware (`requireOwner`, `requireCashier`, etc.)

---

## Phase 9: Validation & Security

### 9.1 Create Validation Schemas

**Files to create/update:**

- `src/modules/staff/staff.validation.ts` - Joi schemas for staff
- `src/modules/salary/salary.validation.ts` - Joi schemas for salary
- `src/modules/inventory/inventory.validation.ts` - Joi schemas for inventory
- Update existing validation files as needed

### 9.2 Security Enhancements

- Rate limiting on sensitive endpoints (salary, staff creation)
- Input sanitization for all user inputs
- Validate ObjectId formats
- Ensure soft deletes where appropriate
- Audit logs for critical operations (optional)

---

## Phase 10: Socket.io Integration (Real-time Updates)

### 10.1 Update Socket Events

**File: `src/sockets/events.ts`**

- Add order status change events
- Add new order assignment notifications (for waiters)
- Add inventory low stock alerts (for owner/cashier)
- Add real-time statistics updates (optional)

**File: `src/sockets/changeStreams.ts`**

- Watch Order collection for status changes
- Emit events to relevant users (waiter, cashier, owner)

---

## Phase 11: Testing & Documentation

### 11.1 API Documentation

- Document all endpoints with request/response examples
- Include authentication requirements
- Document role-based access

### 11.2 Error Handling

- Ensure consistent error response format
- Add proper HTTP status codes
- Include error messages for validation failures

---

## Implementation Order

1. **Phase 1** - Core infrastructure (roles, user model)
2. **Phase 2** - Staff management
3. **Phase 3** - Salary management
4. **Phase 4** - Product enhancements
5. **Phase 5** - Order enhancements
6. **Phase 6** - Inventory management
7. **Phase 7** - Statistics module
8. **Phase 8** - Route integration
9. **Phase 9** - Validation & security
10. **Phase 10** - Socket.io updates
11. **Phase 11** - Testing & documentation

---

## Key Files to Modify/Create

### Modify Existing:

- `src/constants/roles.ts`
- `src/common/middleware/authMiddleware.ts`
- `src/modules/auth/user.model.ts`
- `src/modules/items/item.model.ts`
- `src/modules/orders/order.model.ts`
- `src/modules/orders/order.service.ts`
- `src/modules/orders/order.controller.ts`
- `src/modules/routes.ts`

### Create New Modules:

- `src/modules/staff/` (4 files)
- `src/modules/salary/` (4 files)
- `src/modules/inventory/` (4 files)
- `src/modules/statistics/` (3 files)

---

## Dependencies to Add (if needed)

- `mongoose` (already used)
- `joi` (already used)
- Consider: `date-fns` for date handling in statistics
- Consider: `csv-writer` or `pdfkit` for export features

---

## Notes

- Follow existing code patterns (service layer, error handling)
- Use TypeScript interfaces for type safety
- Maintain consistency with existing module structure
- All endpoints should return consistent JSON responses
- Use MongoDB transactions for critical operations (salary, inventory updates)

### To-dos

- [ ] Update role system: Add owner and waiter roles to constants, update middleware and role hierarchy
- [ ] Update User model: Add phone, salary, and status fields, update role enum
- [ ] Create Staff management module: model, service, controller, routes with CRUD operations (Owner only)
- [ ] Create Salary management module: model, service, controller, routes with payment tracking and summaries (Owner only)
- [ ] Enhance Item model: Add productType (menu/inventory), stock, unit fields. Update controllers to filter by type
- [ ] Update Order model and service: Add waiterId, cashierId, orderNumber, discount, status flow. Update controllers for role-based access
- [ ] Create Inventory management module: model, service, controller, routes with stock tracking and purchase history (Cashier)
- [ ] Create Statistics module: service, controller, routes with dashboard, sales, products, staff, and inventory analytics (Owner only)
- [ ] Integrate all new modules into main routes file with proper middleware and role protection
- [ ] Create Joi validation schemas for all new modules and enhance security with rate limiting and input sanitization
- [ ] Update Socket.io events for real-time order updates, waiter notifications, and inventory alerts