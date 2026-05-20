const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

const JWT_SECRET = process.env.JWT_SECRET || 'crafty-rachel-secret-change-in-production';

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization token' });
    }

    const token = authHeader.slice(7);
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const { rows } = await pool.query(
      `SELECT u.*, s.plan, s.is_active, s.expiry_date
       FROM users u
       LEFT JOIN user_subscriptions s ON s.user_id = u.id
       WHERE u.id = $1`,
      [payload.userId]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = rows[0];
    next();
  } catch (err) {
    console.error('[Auth] Token verification failed:', err.message);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

async function requireAdmin(req, res, next) {
  await requireAuth(req, res, async () => {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}

async function requireSuperAdmin(req, res, next) {
  await requireAuth(req, res, async () => {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'SuperAdmin access required' });
    }
    next();
  });
}

module.exports = { requireAuth, requireAdmin, requireSuperAdmin, JWT_SECRET };
