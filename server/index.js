require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const migrate = require('./db/migrate');

const app = express();
const PORT = process.env.API_PORT || 3001;

// ── Middleware ──
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || '*',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Routes ──
app.use('/api/users',         require('./routes/users'));
app.use('/api/materials',     require('./routes/materials'));
app.use('/api/calculations',  require('./routes/calculations'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/payments',      require('./routes/payments'));
app.use('/api/admin',         require('./routes/admin'));

// ── Health check ──
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── 404 ──
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Error handler ──
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ── Bootstrap ──
async function start() {
  try {
    await migrate();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] Crafty Rachel API running on port ${PORT}`);
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err.message);
    process.exit(1);
  }
}

start();
