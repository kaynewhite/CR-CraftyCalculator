require('dotenv').config();
const { Pool } = require('pg');

// NEON_DATABASE_URL takes priority; DATABASE_URL is the fallback.
// In development: set NEON_DATABASE_URL in your environment secrets to point
// to your Neon database so the app never touches any platform-injected DB.
// In production (Render): set NEON_DATABASE_URL (or DATABASE_URL) to your
// Neon connection string in the Render service environment variables.
const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('[DB] No database connection string found. Set NEON_DATABASE_URL in your environment.');
  process.exit(1);
}

const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

const pool = new Pool({
  connectionString,
  ssl: isLocalhost ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => {
  const host = new URL(connectionString).hostname;
  console.log(`[DB] Connected → ${host}`);
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

module.exports = pool;
