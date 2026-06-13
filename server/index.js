require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const migrate = require('./db/migrate');
const seed = require('./db/seed');

const app = express();
const PORT = process.env.PORT || 5000;
const DIST_DIR = path.join(__dirname, '..', 'dist', 'crafty-rachel', 'browser');

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['*'];

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/auth',          require('./routes/auth'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/materials',     require('./routes/materials'));
app.use('/api/calculations',  require('./routes/calculations'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/payments',      require('./routes/payments'));
app.use('/api/admin',         require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('/*path', (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
} else {
  app.get('/*path', (req, res) => {
    res.status(503).send('App is still building, please wait a moment and refresh...');
  });
}

app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

async function start() {
  if (!process.env.DATABASE_URL && !process.env.NEON_DATABASE_URL) {
    console.error('[Server] Missing database connection. Set DATABASE_URL or NEON_DATABASE_URL and restart.');
    console.error('[Server] Example: postgresql://user:pass@host/dbname?sslmode=require');
    process.exit(1);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Crafty Rachel running on port ${PORT}`);
  });

  try {
    await migrate();
    await seed();
  } catch (err) {
    console.error('[Server] DB init error:', err.message);
  }
}

start();
