const router = require('express').Router();
const pool = require('../db/pool');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { JWT_SECRET } = require('../middleware/auth');

const SALT_ROUNDS = 12;

function signToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const userId = uuidv4();

    const { rows } = await pool.query(
      `INSERT INTO users (id, email, name, password_hash, role, status)
       VALUES ($1, $2, $3, $4, 'user', 'active')
       RETURNING id, email, name, role, status, created_at`,
      [userId, email.toLowerCase().trim(), name.trim(), passwordHash]
    );

    const user = rows[0];

    await pool.query(
      `INSERT INTO user_subscriptions (user_id, plan, is_active, start_date, expiry_date)
       VALUES ($1, 'free', true, NOW(), NOW() + INTERVAL '30 days')
       ON CONFLICT (user_id) DO NOTHING`,
      [user.id]
    );

    const token = signToken(user);
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('[Auth] Signup error:', err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT u.*, s.plan FROM users u
       LEFT JOIN user_subscriptions s ON s.user_id = u.id
       WHERE LOWER(u.email) = LOWER($1)`,
      [email.trim()]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];

    if (!user.password_hash) {
      return res.status(401).json({ error: 'Account not set up — please use password reset' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.status === 'rejected') {
      return res.status(403).json({ error: 'Your account has been suspended. Please contact support.' });
    }

    const token = signToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        plan: user.plan || 'free',
      }
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);

    if (!rows.length) {
      return res.json({ message: 'If that email is registered, a reset request has been submitted to the admin.' });
    }

    const user = rows[0];
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      'UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND used = false',
      [user.id]
    );

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, email, token, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [user.id, user.email, token, expiresAt]
    );

    res.json({ message: 'If that email is registered, a reset request has been submitted to the admin.' });
  } catch (err) {
    console.error('[Auth] Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// GET /api/auth/validate-token/:token
router.get('/validate-token/:token', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT email FROM password_reset_tokens WHERE token = $1 AND used = false AND expires_at > NOW()`,
      [req.params.token]
    );
    if (!rows.length) return res.status(400).json({ valid: false });
    res.json({ valid: true, email: rows[0].email });
  } catch (err) {
    res.status(500).json({ valid: false });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  try {
    const { rows } = await pool.query(
      `SELECT * FROM password_reset_tokens WHERE token = $1 AND used = false AND expires_at > NOW()`,
      [token]
    );

    if (!rows.length) {
      return res.status(400).json({ error: 'This reset link is invalid or has already been used' });
    }

    const resetToken = rows[0];
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, resetToken.user_id]);
    await pool.query('UPDATE password_reset_tokens SET used = true WHERE id = $1', [resetToken.id]);

    await pool.query(
      `INSERT INTO system_logs (type, message, user_id, details)
       VALUES ('system', 'User password reset via admin-mediated token', $1, $2)`,
      [resetToken.user_id, JSON.stringify({ method: 'token_reset' })]
    );

    res.json({ message: 'Password reset successfully. You can now log in with your new password.' });
  } catch (err) {
    console.error('[Auth] Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;
