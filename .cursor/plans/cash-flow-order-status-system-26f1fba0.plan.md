<!-- 26f1fba0-e2e4-4c63-9a51-e25d958802e8 b23b5864-197b-4ed1-890e-84eae541094c -->
# Cash Flow Order Status System Implementation

## Overview

Implement order status tracking for cash-based payment flow with professional accounting-friendly status names, dispute handling, and chain of custody timestamp tracking:

- Cashier creates order (status: "OPEN", sets `placedAt`)
- Cashier can cancel before accepting money (status: "VOIDED", sets `cancelledAt`) - soft delete via status
- Cashier marks cash received from waiter (status: "PAID_TO_CASHIER", sets `paymentReceivedAt`)
- Cashier marks cash delivered to owner (status: "TRANSFERRED_TO_OWNER", sets `paymentDeliveredAt`)
- Owner confirms receipt of cash (status: "OWNER_CONFIRMED", sets `completedAt`)
- Owner can reject/dispute (status: "DISPUTED", sends back to cashier for correction)

## Implementation Details

### 1. Update Order Model

**File: `src/modules/orders/order.model.ts`**

- Update `OrderStatus` type to: `"OPEN" | "VOIDED" | "PAID_TO_CASHIER" | "TRANSFERRED_TO_OWNER" | "OWNER_CONFIRMED" | "DISPUTED"`
- Update schema enum to match new statuses
- Set default status to `"OPEN"` (replacing current "ordered")
- Remove old status types that don't match cash flow
- Add chain of custody timestamp fields to `OrderDoc` interface:
- `placedAt: Date` - when order is created (OPEN status) - required
- `cancelledAt?: Date` - when status changes to VOIDED - optional
- `paymentReceivedAt?: Date` - when status changes to PAID_TO_CASHIER (waiter gives cash to cashier) - optional
- `paymentDeliveredAt?: Date` - when status changes to TRANSFERRED_TO_OWNER (cashier gives cash to owner) - optional
- `completedAt?: Date` - when status changes to OWNER_CONFIRMED - optional
- Add timestamp fields to schema with appropriate types (Date, optional except placedAt)

### 2. Update Order Service

**File: `src/modules/orders/order.service.ts`**

- Update `createOrder`: 
- Set initial status to `"OPEN"` instead of `"ordered"`
- Set `placedAt` to current date when order is created
- Update `validStatusTransitions`:
- `OPEN` → `["VOIDED", "PAID_TO_CASHIER"]`
- `VOIDED` → `[]` (terminal)
- `PAID_TO_CASHIER` → `["TRANSFERRED_TO_OWNER", "DISPUTED"]`
- `TRANSFERRED_TO_OWNER` → `["OWNER_CONFIRMED", "DISPUTED"]`
- `DISPUTED` → `["PAID_TO_CASHIER", "TRANSFERRED_TO_OWNER"]` (owner rejects, cashier fixes)
- `OWNER_CONFIRMED` → `[]` (terminal)
- Update `updateOrderStatus` permissions and timestamp tracking:
- Cashier: Can transition `OPEN` → `VOIDED` or `PAID_TO_CASHIER`; can transition `PAID_TO_CASHIER` → `TRANSFERRED_TO_OWNER`; can transition `DISPUTED` → `PAID_TO_CASHIER` or `TRANSFERRED_TO_OWNER`
- Owner: Can transition `TRANSFERRED_TO_OWNER` → `OWNER_CONFIRMED` or `DISPUTED`
- Waiter: No status update permissions (manual cash collection only)
- When status changes, automatically set corresponding timestamp:
- `VOIDED` → set `cancelledAt` to current date
- `PAID_TO_CASHIER` → set `paymentReceivedAt` to current date
- `TRANSFERRED_TO_OWNER` → set `paymentDeliveredAt` to current date
- `OWNER_CONFIRMED` → set `completedAt` to current date
- `DISPUTED` → do not set timestamp (status change only, no timestamp)
- Add `cancelOrder` function (soft delete via status update):
- Only cashier who created order can cancel
- Only allowed when status is `"OPEN"`
- Sets status to `"VOIDED"` and `cancelledAt` to current date
- Order remains in database for reporting purposes

### 3. Update Order Validation

**File: `src/modules/orders/order.validation.ts`**

- Update `updateOrderStatusSchema`: Change valid values to new statuses: `"OPEN" | "VOIDED" | "PAID_TO_CASHIER" | "TRANSFERRED_TO_OWNER" | "OWNER_CONFIRMED" | "DISPUTED"`
- Add `cancelOrderSchema` if needed for cancel endpoint validation

### 4. Update Order Controller

**File: `src/modules/orders/order.controller.ts`**

- Update `updateStatus`: Handle new status transitions with role-based validation including DISPUTED flow
- Add `cancel` function:
- Verify user is cashier
- Verify order belongs to cashier
- Call `cancelOrder` service
- Return cancelled order (soft delete - order still in database)

### 5. Update Order Routes

**File: `src/modules/orders/order.routes.ts`**

- Add PATCH `/orders/:id/cancel` route for canceling orders (soft delete via status update)
- Alternatively use POST `/orders/:id/cancel` if preferred
- Restrict to cashier role only
- Ensure status update route allows cashier and owner roles (including DISPUTED status)

### 6. Update API Documentation

**File: `API_DOCUMENTATION.md`**

- Update order status documentation with new professional status flow
- Document status transitions: 
- `OPEN` → `PAID_TO_CASHIER` → `TRANSFERRED_TO_OWNER` → `OWNER_CONFIRMED`
- `OPEN` → `VOIDED` (cancellation)
- `TRANSFERRED_TO_OWNER` → `DISPUTED` → `PAID_TO_CASHIER` or `TRANSFERRED_TO_OWNER` (dispute flow)
- Document cancel endpoint: PATCH `/orders/:id/cancel` (soft delete - keeps order in database)
- Document chain of custody timestamp fields: `placedAt`, `cancelledAt`, `paymentReceivedAt`, `paymentDeliveredAt`, `completedAt`
- Document role-based permissions:
- Cashier: create (OPEN), cancel/void (OPEN), mark PAID_TO_CASHIER, mark TRANSFERRED_TO_OWNER, resolve DISPUTED
- Owner: mark OWNER_CONFIRMED, reject/dispute (DISPUTED)
- Waiter: view assigned orders only
- Explain professional naming benefits: accounting-friendly, clear responsibility, audit trail, fraud prevention
- Document that cancelled orders remain in database for monthly reporting purposes

### To-dos

- [ ] Update OrderStatus type and schema enum in order.model.ts to use cash flow statuses
- [ ] Update createOrder, validStatusTransitions, and updateOrderStatus in order.service.ts with new status flow and role permissions
- [ ] Add cancelOrder function in order.service.ts for cashier to cancel orders before accepting money
- [ ] Update updateOrderStatusSchema in order.validation.ts to validate new status values
- [ ] Add cancel function in order.controller.ts to handle order cancellation requests
- [ ] Add DELETE /orders/:id route in order.routes.ts for order cancellation (cashier only)
- [ ] Update API_DOCUMENTATION.md with new status flow, transitions, and cancel endpoint documentation