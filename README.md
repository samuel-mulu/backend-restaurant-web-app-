# Restaurant Management System Backend

A comprehensive, production-ready backend system for restaurant management built with Express.js, TypeScript, and MongoDB. This system supports multi-role access control (Owner, Cashier, Waiter), real-time order management, inventory tracking, staff management, salary processing, and comprehensive analytics.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Authentication & Authorization](#authentication--authorization)
- [Modules Overview](#modules-overview)
- [Real-time Features](#real-time-features)
- [Database Schema](#database-schema)
- [Security Features](#security-features)
- [Development](#development)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## ✨ Features {#features}

### Core Features

- **Multi-Role Access Control**: Three distinct roles (Owner, Cashier, Waiter) with granular permissions
- **Order Management**: Complete order lifecycle from placement to completion with status tracking
- **Menu & Inventory Management**: Dual product types (menu items and inventory items) with stock tracking
- **Staff Management**: Comprehensive staff CRUD operations with role assignment and status management
- **Salary Management**: Monthly salary tracking, payment status, and financial summaries
- **Inventory Tracking**: Real-time stock monitoring with low-stock alerts and purchase history
- **Statistics & Analytics**: Dashboard with sales analytics, product performance, staff metrics, and inventory insights
- **Real-time Updates**: Socket.io integration for live order updates, notifications, and inventory alerts
- **Audit Logging**: Complete audit trail for critical operations
- **File Uploads**: Cloudinary integration for image management
- **Offline Support**: Client-side synchronization with offline order creation

### Advanced Features

- JWT-based authentication with refresh tokens
- Rate limiting for API protection
- Input validation using Joi schemas
- MongoDB change streams for real-time database events
- Soft delete functionality
- Pagination and filtering
- Search capabilities across multiple fields
- Health check endpoints
- Comprehensive error handling

## 🛠 Tech Stack {#tech-stack}

### Core Technologies

- **Runtime**: Node.js
- **Framework**: Express.js 5.x
- **Language**: TypeScript
- **Database**: MongoDB with Mongoose ODM
- **Real-time**: Socket.io
- **Authentication**: JWT (JSON Web Tokens)

### Key Dependencies

- **express**: Web framework
- **mongoose**: MongoDB object modeling
- **socket.io**: Real-time bidirectional communication
- **joi**: Schema validation
- **bcryptjs**: Password hashing
- **cloudinary**: Image upload and management
- **helmet**: Security headers
- **cors**: Cross-origin resource sharing
- **express-rate-limit**: Rate limiting
- **compression**: Response compression
- **cookie-parser**: Cookie parsing

## 🏗 Architecture {#architecture}

### Project Structure

```
restuarant_backend/
├── src/
│   ├── app.ts                 # Express app configuration
│   ├── server.ts              # Server entry point
│   ├── config/                # Configuration files
│   │   ├── database.ts        # MongoDB connection
│   │   ├── env.ts            # Environment variables
│   │   ├── corsOptions.ts    # CORS configuration
│   │   └── cloudinary.ts     # Cloudinary setup
│   ├── constants/             # Application constants
│   │   ├── roles.ts          # Role definitions
│   │   └── cookiesName.ts    # Cookie names
│   ├── common/               # Shared utilities
│   │   ├── middleware/       # Express middlewares
│   │   │   ├── authMiddleware.ts    # Authentication
│   │   │   ├── errorHandler.ts     # Error handling
│   │   │   ├── validate.ts         # Request validation
│   │   │   ├── rateLimiter.ts      # Rate limiting
│   │   │   ├── requireRole.ts      # Role-based access
│   │   │   └── upload.ts           # File upload
│   │   └── utils/            # Utility functions
│   │       ├── jwt.ts        # JWT operations
│   │       ├── password.ts   # Password hashing
│   │       ├── getToken.ts  # Token extraction
│   │       └── auditLogger.ts # Audit logging
│   ├── modules/               # Feature modules
│   │   ├── auth/             # Authentication module
│   │   ├── orders/           # Order management
│   │   ├── items/            # Menu/inventory items
│   │   ├── categories/       # Category management
│   │   ├── staff/            # Staff management
│   │   ├── salary/           # Salary management
│   │   ├── inventory/        # Inventory tracking
│   │   ├── statistics/       # Analytics & statistics
│   │   ├── audit/            # Audit logging
│   │   ├── shifts/           # Shift management
│   │   ├── sync/             # Data synchronization
│   │   ├── notification/     # Notifications
│   │   └── routes.ts         # Main router
│   └── sockets/              # Socket.io setup
│       ├── socket.ts         # Socket initialization
│       ├── events.ts         # Event handlers
│       └── changeStreams.ts  # MongoDB change streams
├── dist/                      # Compiled JavaScript (generated)
├── logs/                      # Application logs
├── package.json
├── tsconfig.json
├── env.example               # Environment variables template
└── README.md
```

### Module Architecture Pattern

Each module follows a consistent structure:

```
module-name/
├── module-name.model.ts      # Mongoose schema and model
├── module-name.service.ts    # Business logic
├── module-name.controller.ts # Request handlers
├── module-name.routes.ts    # Route definitions
└── module-name.validation.ts # Joi validation schemas (optional)
```

**Data Flow**: `routes.ts` → `controller.ts` → `service.ts` → `model.ts`

## 📦 Prerequisites {#prerequisites}

Before you begin, ensure you have the following installed:

- **Node.js**: v18.x or higher
- **MongoDB**: v6.x or higher (local or cloud instance)
- **npm** or **yarn**: Package manager
- **TypeScript**: v5.x (installed as dev dependency)

## 🚀 Installation {#installation}

1. **Clone the repository**

```bash
git clone <repository-url>
cd restuarant_backend
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

Copy the example environment file and configure it:

```bash
cp env.example .env
```

Edit `.env` with your configuration (see [Configuration](#configuration) section).

4. **Build the project**

```bash
npm run build
```

## ⚙️ Configuration {#configuration}

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
NODE_ENV=development
PORT=5000

# Database
MONGO_URI=mongodb://localhost:27017/restaurant-app

# JWT Configuration
JWT_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-key-here
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=30d

# Cloudinary (Optional - for image uploads)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
CLOUDINARY_URL=cloudinary://key:secret@name

# CORS and Cookies
CORS_ORIGIN=http://localhost:3000
COOKIE_DOMAIN=localhost
SECURE_COOKIES=false

# Email Configuration (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM_NAME=Restaurant App
SMTP_FROM_EMAIL=your-email@gmail.com
```

### MongoDB Setup

1. **Local MongoDB**: Install and run MongoDB locally
2. **MongoDB Atlas**: Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
3. Update `MONGO_URI` in `.env` with your connection string

### Cloudinary Setup (Optional)

1. Sign up at [Cloudinary](https://cloudinary.com/)
2. Get your cloud name, API key, and API secret
3. Add them to your `.env` file

## 🏃 Running the Application {#running-the-application}

### Development Mode

Run the application with hot-reload:

```bash
npm run dev
```

The server will start on `http://localhost:5000` (or the port specified in `.env`).

### Production Mode

1. Build the project:

```bash
npm run build
```

2. Start the server:

```bash
npm start
```

### Health Check

Verify the server is running:

```bash
curl http://localhost:5000/health
```

Expected response:

```json
{
  "status": "ok",
  "mongo": {
    "status": "connected",
    "readyState": 1
  },
  "uptime": 123.456,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 📚 API Documentation {#api-documentation}

### Base URL

All API endpoints are prefixed with `/api/v1`:

```
http://localhost:5000/api/v1
```

### Complete API Documentation

For detailed API documentation including all endpoints, request/response formats, and examples, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).

### Quick Reference

#### Authentication Endpoints

- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout

#### Order Management

- `GET /api/v1/orders` - List orders (with filters)
- `POST /api/v1/orders` - Create new order
- `GET /api/v1/orders/:id` - Get order details
- `PATCH /api/v1/orders/:id/status` - Update order status
- `PATCH /api/v1/orders/:id` - Update order

#### Staff Management (Owner Only)

- `GET /api/v1/staff` - List staff
- `POST /api/v1/staff` - Create staff member
- `GET /api/v1/staff/:id` - Get staff details
- `PATCH /api/v1/staff/:id` - Update staff
- `DELETE /api/v1/staff/:id` - Soft delete staff

#### Salary Management (Owner Only)

- `GET /api/v1/salary` - List salaries
- `POST /api/v1/salary` - Create salary record
- `GET /api/v1/salary/summary` - Get salary summary
- `GET /api/v1/salary/staff/:staffId` - Staff salary history

#### Inventory Management

- `GET /api/v1/inventory` - List inventory items
- `POST /api/v1/inventory` - Create inventory record
- `POST /api/v1/inventory/:id/purchase` - Record purchase
- `GET /api/v1/inventory/low-stock` - Get low stock items

#### Statistics (Owner Only)

- `GET /api/v1/statistics/dashboard` - Dashboard overview
- `GET /api/v1/statistics/sales` - Sales analytics
- `GET /api/v1/statistics/products` - Product analytics
- `GET /api/v1/statistics/staff` - Staff performance

## 🔐 Authentication & Authorization {#authentication--authorization}

<a id="authentication--authorization"></a>

### Authentication

The API uses JWT (JSON Web Tokens) for authentication:

1. **Access Token**: Short-lived (15 minutes by default), sent in Authorization header
2. **Refresh Token**: Long-lived (30 days by default), stored in HTTP-only cookie

#### Request Format

```http
Authorization: Bearer <access-token>
```

### Authorization Roles

The system supports three roles with hierarchical permissions:

#### Owner (Rank: 3)

- Full system access
- Staff management (create, update, delete)
- Salary management
- View all statistics and analytics
- Access to all orders and inventory

#### Cashier (Rank: 2)

- Order management (create, update)
- Item and category management
- Inventory management
- View assigned orders
- Cannot access staff/salary management

#### Waiter (Rank: 1)

- View assigned orders only
- Update order status (served, completed)
- Limited read access to items and categories
- Cannot create or modify orders

### Role-Based Middleware

```typescript
// Require specific role
requireRole("owner", "cashier");

// Require minimum role rank
requireMinRole("cashier"); // Allows cashier and owner

// Convenience exports
requireOwner;
requireCashier;
requireWaiter;
```

## 📦 Modules Overview {#modules-overview}

### Authentication Module (`/auth`)

- User registration and login (phone number based)
- JWT token generation and refresh
- Password hashing and validation
- Session management

### Order Management (`/orders`)

- Order creation with item snapshots
- Order status workflow: `placed` → `served` → `completed`
- Waiter and cashier assignment
- Order number generation (format: `ORD-YYYYMMDD-XXXX`)
- Offline order support with client synchronization
- Real-time status updates via Socket.io

### Items Module (`/items`)

- Dual product types: `menu` and `inventory`
- Menu items: Customer-facing products with prices
- Inventory items: Raw materials with stock tracking
- Image upload via Cloudinary
- Category association
- Availability management

### Categories Module (`/categories`)

- Food and beverage categories
- Category hierarchy support
- Active/inactive status
- Association with items

### Staff Management (`/staff`)

- CRUD operations for staff members
- Role assignment (cashier, waiter)
- Status management (active, inactive)
- Salary configuration
- Phone and email validation
- Soft delete functionality

### Salary Management (`/salary`)

- Monthly salary tracking
- Payment status (pending, paid)
- Salary summaries by staff and period
- Duplicate prevention (one salary per staff per month)
- Financial reporting

### Inventory Management (`/inventory`)

- Stock quantity tracking
- Minimum threshold alerts
- Purchase history recording
- Unit management (kg, liters, pieces, etc.)
- Low stock notifications
- Cost tracking

### Statistics Module (`/statistics`)

- **Dashboard**: Overview metrics (sales, orders, staff, inventory)
- **Sales Analytics**: Sales by day/week/month, trends, cashier performance
- **Product Analytics**: Best-selling items, revenue by product
- **Staff Performance**: Orders handled, efficiency metrics
- **Inventory Analytics**: Consumption trends, purchase costs

### Audit Module (`/audit`)

- Complete audit trail for critical operations
- User action tracking
- Timestamp and IP logging
- Query and filter capabilities

### Shifts Module (`/shifts`)

- Staff shift management
- Shift scheduling
- Attendance tracking

### Sync Module (`/sync`)

- Client-side data synchronization
- Offline order handling
- Conflict resolution

### Notification Module (`/notifications`)

- In-app notifications
- Notification preferences
- Read/unread status

## 🔄 Real-time Features {#real-time-features}

### Socket.io Integration

The application uses Socket.io for real-time bidirectional communication.

### Connection Setup

```javascript
import io from "socket.io-client";

const socket = io("http://localhost:5000", {
  transports: ["websocket", "polling"],
});
```

### Room Subscriptions

#### Owner

```javascript
socket.emit("join-owner");
// Subscribes to: owner:inventory, owner:dashboard, admin:orders
```

#### Cashier

```javascript
socket.emit("join-cashier");
// Subscribes to: cashier:orders, cashier:inventory
```

#### Waiter

```javascript
socket.emit("join-waiter", waiterId);
// Subscribes to: waiter:{waiterId}
```

#### Customer

```javascript
socket.emit("join-customer", channelId);
// Subscribes to: customer:{channelId}
```

### Real-time Events

#### Order Events

- `newOrder` - New order created
- `orderUpdated` - Order updated
- `order:status:changed` - Order status changed
- `order:assigned:waiter` - Order assigned to waiter

#### Inventory Events

- `inventory:low:stock` - Inventory item below threshold

#### Statistics Events

- `statistics:updated` - Dashboard statistics updated

#### Item Events

- `itemCreated` - New item created
- `itemUpdated` - Item updated
- `itemDeleted` - Item deleted
- `itemAvailabilityChanged` - Item availability changed

#### Category Events

- `categoryCreated` - New category created
- `categoryUpdated` - Category updated
- `categoryDeleted` - Category deleted

### MongoDB Change Streams

The application uses MongoDB change streams to automatically detect database changes and emit Socket.io events:

- Order collection changes → Real-time order notifications
- Inventory collection changes → Low stock alerts

## 🗄 Database Schema {#database-schema}

### User Model

```typescript
{
  name: string;
  email?: string (optional, unique if provided);
  password: string (hashed);
  role: "owner" | "cashier" | "waiter";
  phone: string (unique, required);
  salary?: number;
  status: "active" | "inactive";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Order Model

```typescript
{
  orderCode: string (unique);
  orderNumber: string (unique);
  tableNumber: string;
  items: [{
    itemId: ObjectId;
    itemCodeSnapshot: string;
    typeSnapshot: "food" | "beverage";
    nameSnapshot: string;
    priceSnapshot: number;
    qty: number;
  }];
  note?: string;
  totalAmount: number;
  status: "placed" | "served" | "completed";
  waiterId?: ObjectId (ref: User);
  cashierId?: ObjectId (ref: User);
  offlineId?: string;
  clientId?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Item Model

```typescript
{
  type: "food" | "beverage";
  categoryId: ObjectId (ref: Category);
  itemCode: string (unique);
  sku?: string (unique);
  name: string;
  description?: string;
  price?: number;
  images?: [{
    url: string;
    publicId: string;
  }];
  productType: "menu" | "inventory";
  stock?: number;
  unit?: string;
  isAvailable: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  clientId?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Salary Model

```typescript
{
  staffId: ObjectId (ref: User);
  amount: number;
  month: string (YYYY-MM);
  year: number;
  paymentDate: Date;
  status: "pending" | "paid";
  remarks?: string;
  createdBy: ObjectId (ref: User);
  createdAt: Date;
  updatedAt: Date;
}
```

### Inventory Model

```typescript
{
  productId: ObjectId (ref: Item, productType: "inventory");
  quantity: number;
  unit: string;
  minThreshold?: number;
  lastPurchaseDate?: Date;
  purchaseHistory: [{
    quantity: number;
    purchaseDate: Date;
    cost: number;
    purchasedBy: ObjectId (ref: User);
  }];
  createdAt: Date;
  updatedAt: Date;
}
```

## 🔒 Security Features {#security-features}

### Authentication Security

- **Password Hashing**: bcryptjs with salt rounds
- **JWT Tokens**: Secure token generation with expiration
- **HTTP-only Cookies**: Refresh tokens stored securely
- **Phone Number Authentication**: Login using phone number as primary identifier

### API Security

- **Helmet.js**: Security headers (XSS protection, content security policy)
- **CORS**: Configurable cross-origin resource sharing
- **Rate Limiting**:
  - General API: 400 requests per 15 minutes
  - Authentication: 5 login attempts per 15 minutes
  - Sensitive endpoints: 10 requests per 15 minutes
- **Input Validation**: Joi schema validation for all inputs
- **ObjectId Validation**: MongoDB ObjectId format validation
- **SQL Injection Prevention**: Mongoose parameterized queries

### Data Security

- **Soft Deletes**: Data retention with soft delete pattern
- **Audit Logging**: Complete audit trail for sensitive operations
- **Environment Variables**: Sensitive data in environment variables
- **Error Handling**: No sensitive data in error messages

## 💻 Development {#development}

### Scripts

```bash
# Development with hot-reload
npm run dev

# Build TypeScript
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

### Code Style

- TypeScript strict mode enabled
- ESLint for code quality
- Consistent module structure
- Service layer for business logic
- Controller layer for request handling

### Adding a New Module

1. Create module directory: `src/modules/your-module/`
2. Create files following the pattern:
   - `your-module.model.ts`
   - `your-module.service.ts`
   - `your-module.controller.ts`
   - `your-module.routes.ts`
   - `your-module.validation.ts` (optional)
3. Register routes in `src/modules/routes.ts`
4. Add validation schemas if needed
5. Implement proper error handling
6. Add role-based access control

### Testing

Currently, the project doesn't include test suites. Consider adding:

- Unit tests for services
- Integration tests for API endpoints
- Socket.io event testing
- Database transaction testing

## 🚢 Deployment {#deployment}

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong JWT secrets (generate secure random strings)
- [ ] Enable `SECURE_COOKIES=true` for HTTPS
- [ ] Configure proper CORS origins
- [ ] Set up MongoDB connection pooling
- [ ] Configure Cloudinary for production
- [ ] Set up logging and monitoring
- [ ] Configure rate limiting appropriately
- [ ] Enable compression
- [ ] Set up health check monitoring
- [ ] Configure backup strategy for MongoDB

### Environment-Specific Configuration

#### Development

- Auto-index MongoDB
- Verbose logging
- Relaxed CORS
- HTTP cookies

#### Production

- Disable auto-indexing
- Structured logging
- Strict CORS
- HTTPS-only cookies
- Connection pooling
- Error tracking

### Docker Deployment (Optional)

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 5000
CMD ["node", "dist/server.js"]
```

### Process Management

Use PM2 or similar for process management:

```bash
npm install -g pm2
pm2 start dist/server.js --name restaurant-backend
pm2 save
pm2 startup
```

## 🤝 Contributing {#contributing}

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Contribution Guidelines

- Follow the existing code structure and patterns
- Write clear commit messages
- Add validation for new endpoints
- Implement proper error handling
- Update API documentation
- Test your changes thoroughly

## 📝 License {#license}

This project is licensed under the ISC License.

## 📞 Support

For issues, questions, or contributions, please open an issue on the repository.

## 🙏 Acknowledgments

- Express.js community
- MongoDB and Mongoose teams
- Socket.io for real-time capabilities
- All contributors and users of this project

---

**Built with ❤️ for modern restaurant management**
