# Simple Setup Guide - No IP Configuration Needed

## Overview

This setup is designed to be **super simple** - each cashier PC runs everything locally. No IP addresses to configure!

## Architecture

```
Each Cashier PC:
├── Backend Server (port 5000)
│   └── Automatically prints to → localhost:7777
└── POS Printer Service (port 7777)
    └── Connects to → Physical Printer
```

**Key Point:** Everything runs on the same PC - no network configuration needed!

## Setup Steps (Per Cashier PC)

### 1. Install Backend on Cashier PC

```bash
# Copy backend folder to cashier PC
cd restaurant-menu-backend
npm install
```

### 2. Configure Backend `.env`

Create `.env` file (or use defaults):

```env
# Database (can be local or remote)
MONGO_URI=mongodb://localhost:27017/restaurant-app

# POS Printer Service (uses defaults - no need to change!)
# POS_PRINTER_URL=http://localhost:7777  (default)
# POS_PRINTER_KEY=dev-key-12345          (default)
```

**That's it!** Backend will automatically use `localhost:7777` for printing.

### 3. Install POS Printer Service on Same PC

```bash
# Copy POS Printer Service folder to cashier PC
cd "POS Printer Service"
npm install
```

### 4. Configure POS Service `.env`

Create `.env` file:

```env
PORT=7777
PRINTER_INTERFACE=usb          # or "serial" or "mock"
PRINTER_USB_NAME=Your-Printer-Name
PRINT_KEY=dev-key-12345        # Must match backend (or use default)
```

### 5. Start Both Services

**Terminal 1 - Backend:**

```bash
cd restaurant-menu-backend
npm run dev
```

**Terminal 2 - POS Service:**

```bash
cd "POS Printer Service"
npm run dev
```

### 6. Done! 🎉

- Backend runs on `http://localhost:5000`
- POS Service runs on `http://localhost:7777`
- Backend automatically prints to `localhost:7777`
- **No IP addresses needed!**

## Production Setup (PM2)

### Start Backend as Service

```bash
cd restaurant-menu-backend
npm run build
pm2 start dist/server.js --name "restaurant-backend"
pm2 save
pm2 startup
```

### Start POS Service as Service

```bash
cd "POS Printer Service"
npm run build
npm run pm2:start
npm run pm2:save
npm run pm2:startup
```

## How It Works

1. **Order Created** → Backend formats receipt
2. **Backend sends print request** → `http://localhost:7777/print`
3. **POS Service receives** → Validates key and prints
4. **Printer prints receipt** → Done!

## Benefits

✅ **No IP Configuration** - Everything uses localhost  
✅ **Works on Any PC** - Just copy folders and run  
✅ **No Network Setup** - No firewall rules needed  
✅ **Simple Deployment** - Same setup for every cashier PC  
✅ **Default Keys** - Works out of the box

## Troubleshooting

### Print Not Working?

1. **Check POS Service is running:**

   ```bash
   curl http://localhost:7777/health
   ```

2. **Check both services are on same PC:**

   - Backend must be on same PC as POS Service
   - Both use `localhost`

3. **Check print key matches:**
   - Backend: `POS_PRINTER_KEY=dev-key-12345`
   - POS Service: `PRINT_KEY=dev-key-12345`

### Multiple Cashier PCs?

Each cashier PC needs:

- Its own backend instance (or shared backend)
- Its own POS Service instance
- Its own printer

**If using shared backend:**

- Backend can be on server
- Each cashier PC runs POS Service locally
- Backend needs to route prints to correct PC (advanced)

**Recommended:** Each PC runs both services locally (simplest!)
