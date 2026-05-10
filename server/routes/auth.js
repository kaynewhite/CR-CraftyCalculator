const router = require('express').Router();
const pool = require('../db/pool');
const { v4: uuidv4 } = require('uuid');
const { createClerkClient } = require('@clerk/backend');

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!rows.length) {
      return res.json({ message: 'If that email exists, a reset request has been sent to the admin.' });
    }

    const user = rows[0];
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, email, token, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [user.id, email, token, expiresAt]
    );

    res.json({ message: 'If that email exists, a reset request has been sent to the admin.' });
  } catch (err) {
    console.error('[Auth] Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process request' });
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
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const resetToken = rows[0];

    await clerk.users.updateUser(resetToken.user_id, { password });

    await pool.query('UPDATE password_reset_tokens SET used = true WHERE id = $1', [resetToken.id]);

    await pool.query(
      `INSERT INTO system_logs (type, message, user_id, details)
       VALUES ('system', 'User password reset via token', $1, $2)`,
      [resetToken.user_id, JSON.stringify({ method: 'token_reset' })]
    );

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    console.error('[Auth] Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// GET /api/auth/validate-token/:token - check if token is valid (no auth needed)
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

module.exports = router;
