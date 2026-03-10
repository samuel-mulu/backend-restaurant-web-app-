const axios = require('axios');

const URL = process.env.API_URL || 'https://restaurant-menu-backend.onrender.com/health';
const INTERVAL = 10 * 60 * 1000; // 10 minutes

console.log(`Starting warmup script for ${URL}...`);

async function warmup() {
  try {
    const response = await axios.get(URL);
    console.log(`[${new Date().toISOString()}] Warmup ping successful: ${response.status}`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Warmup ping failed: ${error.message}`);
  }
}

// Ping immediately on start
warmup();

// Then every 10 minutes
setInterval(warmup, INTERVAL);
