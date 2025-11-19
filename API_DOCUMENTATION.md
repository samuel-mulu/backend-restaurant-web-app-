# Restaurant Backend API Documentation

## Overview

This document provides comprehensive API documentation for the Restaurant Backend system. All endpoints require authentication unless otherwise specified.

## Base URL

```
/api/v1
```

## Authentication

Most endpoints require authentication via JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer <token>
```

## Roles

- **owner**: Full system access
- **cashier**: Can manage orders, items, inventory
- **waiter**: Can view and update assigned orders

---

## Staff Management

### List Staff
**GET** `/staff`

**Access**: Owner (all staff), Cashier/Waiter (active only)

**Query Parameters**:
- `role` (optional): Filter by role (cashier, waiter)
- `status` (optional): Filter by status (active, inactive)
- `search` (optional): Search by name, email, or phone
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50, max: 100)

**Response**:
```json
{
  "success": true,
  "data": {
    "staff": [...],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 10,
      "pages": 1
    }
  }
}
```

### Get Staff by ID
**GET** `/staff/:id`

**Access**: Owner (all), Cashier/Waiter (active only)

**Response**:
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "role": "cashier",
    "salary": 3000,
    "status": "active"
  }
}
```

### Create Staff
**POST** `/staff`

**Access**: Owner only

**Rate Limit**: 10 requests per 15 minutes

**Request Body**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "phone": "+1234567890",
  "role": "cashier",
  "salary": 3000
}
```

**Response**: 201 Created

### Update Staff
**PATCH** `/staff/:id`

**Access**: Owner only

**Request Body**:
```json
{
  "phone": "+1234567890",
  "salary": 3500,
  "status": "active",
  "role": "waiter"
}
```

### Delete Staff (Soft Delete)
**DELETE** `/staff/:id`

**Access**: Owner only

---

## Salary Management

### List Salaries
**GET** `/salary`

**Access**: Owner only

**Query Parameters**:
- `staffId` (optional): Filter by staff ID
- `month` (optional): Filter by month (YYYY-MM format)
- `year` (optional): Filter by year
- `status` (optional): Filter by status (pending, paid)
- `page` (optional): Page number
- `limit` (optional): Items per page

### Get Salary by ID
**GET** `/salary/:id`

**Access**: Owner only

### Create Salary Record
**POST** `/salary`

**Access**: Owner only

**Rate Limit**: 10 requests per 15 minutes

**Request Body**:
```json
{
  "staffId": "...",
  "amount": 3000,
  "month": "2024-12",
  "year": 2024,
  "paymentDate": "2024-12-01T00:00:00.000Z",
  "status": "pending",
  "remarks": "Monthly salary"
}
```

### Update Salary
**PATCH** `/salary/:id`

**Access**: Owner only

**Request Body**:
```json
{
  "amount": 3500,
  "status": "paid",
  "paymentDate": "2024-12-01T00:00:00.000Z"
}
```

### Get Salary Summary
**GET** `/salary/summary`

**Access**: Owner only

**Query Parameters**:
- `month` (optional): Filter by month (YYYY-MM)
- `year` (optional): Filter by year

**Response**:
```json
{
  "success": true,
  "data": {
    "summary": [
      {
        "staffId": "...",
        "staffName": "John Doe",
        "totalAmount": 3000,
        "count": 1,
        "paidCount": 0,
        "pendingCount": 1
      }
    ],
    "totals": {
      "totalAmount": 3000,
      "totalCount": 1,
      "totalPaid": 0,
      "totalPending": 3000
    }
  }
}
```

### Get Staff Salary History
**GET** `/salary/staff/:staffId`

**Access**: Owner only

---

## Order Management

### List Orders
**GET** `/orders`

**Access**: Authenticated users

**Query Parameters**:
- `status` (optional): Filter by status (pending, preparing, ready, served, completed)
- `waiterId` (optional): Filter by waiter ID
- `cashierId` (optional): Filter by cashier ID
- `startDate` (optional): Start date filter
- `endDate` (optional): End date filter

**Note**: Waiters automatically see only their assigned orders

### Get Order by ID
**GET** `/orders/:id`

**Access**: Authenticated users

### Create Order
**POST** `/orders`

**Access**: Public (customers) or Cashier

**Request Body**:
```json
{
  "tableNumber": "5",
  "peopleCount": 2,
  "items": [
    {
      "itemId": "...",
      "itemCodeSnapshot": "FOOD001",
      "typeSnapshot": "food",
      "qty": 2,
      "nameSnapshot": "Pizza",
      "priceSnapshot": 15.99
    }
  ],
  "waiterId": "...",
  "discount": 10,
  "notes": "No onions",
  "customerChannel": "web"
}
```

**Note**: Cashier ID is auto-assigned if user is cashier

### Update Order Status
**PATCH** `/orders/:id/status`

**Access**: Waiter, Cashier, Owner

**Request Body**:
```json
{
  "status": "preparing"
}
```

**Valid Status Transitions**:
- pending → preparing
- preparing → ready
- ready → served
- served → completed

**Note**: Waiters can only update to "served" or "completed"

### Update Order
**PATCH** `/orders/:id`

**Access**: Cashier, Owner

**Request Body**:
```json
{
  "discount": 15,
  "notes": "Updated notes",
  "items": [...]
}
```

### Get Orders by Waiter
**GET** `/orders/waiter/:waiterId`

**Access**: Authenticated users

### Get Orders by Cashier
**GET** `/orders/cashier/:cashierId`

**Access**: Authenticated users

---

## Inventory Management

### List Inventory
**GET** `/inventory`

**Access**: Cashier, Owner

**Query Parameters**:
- `lowStock` (optional): Filter low stock items (true/false)

### Get Inventory by ID
**GET** `/inventory/:id`

**Access**: Cashier, Owner

### Create Inventory Record
**POST** `/inventory`

**Access**: Cashier only

**Request Body**:
```json
{
  "productId": "...",
  "quantity": 100,
  "unit": "kg",
  "minThreshold": 20
}
```

### Update Inventory
**PATCH** `/inventory/:id`

**Access**: Cashier only

**Request Body**:
```json
{
  "quantity": 150,
  "minThreshold": 25
}
```

### Record Purchase
**POST** `/inventory/:id/purchase`

**Access**: Cashier only

**Request Body**:
```json
{
  "quantity": 50,
  "cost": 500,
  "purchaseDate": "2024-12-01T00:00:00.000Z"
}
```

### Get Low Stock Items
**GET** `/inventory/low-stock`

**Access**: Cashier, Owner

### Get Purchase History
**GET** `/inventory/:id/history`

**Access**: Cashier, Owner

---

## Statistics & Analytics

### Dashboard Stats
**GET** `/statistics/dashboard`

**Access**: Owner only

**Query Parameters**:
- `startDate` (optional): Start date
- `endDate` (optional): End date

**Response**:
```json
{
  "success": true,
  "data": {
    "totalSales": {
      "today": 1500,
      "week": 10000,
      "month": 45000
    },
    "totalOrders": {
      "today": 25,
      "week": 150,
      "month": 600
    },
    "activeStaffCount": 5,
    "lowStockItemsCount": 3
  }
}
```

### Sales Analytics
**GET** `/statistics/sales`

**Access**: Owner only

**Query Parameters**:
- `startDate` (optional)
- `endDate` (optional)
- `cashierId` (optional)

**Response**:
```json
{
  "success": true,
  "data": {
    "salesByDay": [...],
    "salesByCashier": [...],
    "trends": [...]
  }
}
```

### Product Analytics
**GET** `/statistics/products`

**Access**: Owner only

**Query Parameters**:
- `startDate` (optional)
- `endDate` (optional)
- `limit` (optional): Number of top items (default: 10)

### Staff Performance
**GET** `/statistics/staff`

**Access**: Owner only

**Query Parameters**:
- `startDate` (optional)
- `endDate` (optional)

### Inventory Analytics
**GET** `/statistics/inventory`

**Access**: Owner only

**Query Parameters**:
- `startDate` (optional)
- `endDate` (optional)

---

## Socket.io Events

### Client Events (Emit)

- `join-admin`: Join admin rooms
- `join-cashier`: Join cashier rooms
- `join-waiter`: Join waiter room (requires waiterId)
- `join-owner`: Join owner rooms
- `join-customer`: Join customer channel (requires channel ID)
- `subscribe-orders`: Subscribe to general order events

### Server Events (Listen)

#### Order Events
- `newOrder`: New order created
- `orderUpdated`: Order updated
- `order:status:changed`: Order status changed
- `order:assigned:waiter`: Order assigned to waiter

#### Inventory Events
- `inventory:low:stock`: Inventory item below threshold

#### Statistics Events
- `statistics:updated`: Dashboard statistics updated

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "message": "Error message",
  "details": [
    {
      "field": "fieldName",
      "message": "Field-specific error"
    }
  ]
}
```

### Common HTTP Status Codes

- `200`: Success
- `201`: Created
- `400`: Bad Request (validation error)
- `401`: Unauthorized (authentication required)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `409`: Conflict (duplicate resource)
- `429`: Too Many Requests (rate limit exceeded)
- `500`: Internal Server Error

---

## Rate Limiting

- **General API**: 400 requests per 15 minutes
- **Authentication**: 5 login attempts per 15 minutes
- **Sensitive Endpoints** (staff creation, salary creation): 10 requests per 15 minutes

---

## Notes

- All dates should be in ISO 8601 format
- All monetary values are in the base currency unit
- ObjectId fields should be valid MongoDB ObjectIds
- Phone numbers should follow international format
- Order numbers are auto-generated in format: `ORD-YYYYMMDD-XXXX`

