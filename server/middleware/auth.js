const { createClerkClient } = require('@clerk/backend');
const pool = require('../db/pool');

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization token' });
    }

    const token = authHeader.slice(7);
    const payload = await clerk.verifyToken(token);
    const clerkUserId = payload.sub;

    const clerkUser = await clerk.users.getUser(clerkUserId);
    const email = clerkUser.emailAddresses[0]?.emailAddress || '';
    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || email;

    const { rows } = await pool.query(
      `INSERT INTO users (id, email, name, role, status)
       VALUES ($1, $2, $3, 'user', 'active')
       ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, updated_at = NOW()
       RETURNING *`,
      [clerkUserId, email, name]
    );

    const dbUser = rows[0];

    await pool.query(
      `INSERT INTO user_subscriptions (user_id, plan, is_active, start_date, expiry_date)
       VALUES ($1, 'free', true, NOW(), NOW() + INTERVAL '30 days')
       ON CONFLICT (user_id) DO NOTHING`,
      [clerkUserId]
    );

    req.user = dbUser;
    req.clerkUserId = clerkUserId;
    next();
  } catch (err) {
    console.error('[Auth] Token verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
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

module.exports = { requireAuth, requireAdmin, requireSuperAdmin };
