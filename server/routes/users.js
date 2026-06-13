const router = require('express').Router();
const pool = require('../db/pool');
const bcrypt = require('bcrypt');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const SALT_ROUNDS = 12;

// GET /api/users/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.*, COALESCE(s.plan, CASE WHEN u.role IN ('admin','superadmin') THEN 'pro' ELSE 'free' END) AS plan,
              s.is_active, s.start_date, s.expiry_date
       FROM users u
       LEFT JOIN user_subscriptions s ON s.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    res.json(rows[0] || req.user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PUT /api/users/me
router.put('/me', requireAuth, async (req, res) => {
  const { name, email } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [name, email, req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// PUT /api/users/me/password
router.put('/me/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  try {
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const valid = await bcrypt.compare(currentPassword || '', rows[0].password_hash);
    if (!valid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query(
      'UPDATE users SET password_hash = $1, plain_password = $2, updated_at = NOW() WHERE id = $3',
      [passwordHash, newPassword, req.user.id]
    );

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// PUT /api/users/heartbeat — updates last_seen_at
router.put('/heartbeat', requireAuth, async (req, res) => {
  try {
    await pool.query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Heartbeat failed' });
  }
});

// ── Admin routes ──

// GET /api/users — list all users (admin)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.status, u.created_at, u.last_seen_at,
              s.plan, s.is_active, s.expiry_date
       FROM users u
       LEFT JOIN user_subscriptions s ON s.user_id = u.id
       WHERE u.role = 'user'
       ORDER BY u.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/users/with-passwords — superadmin only
router.get('/with-passwords', requireAdmin, async (req, res) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'SuperAdmin access required' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.name, u.plain_password, u.created_at, u.last_seen_at,
              s.plan
       FROM users u
       LEFT JOIN user_subscriptions s ON s.user_id = u.id
       WHERE u.role = 'user'
       ORDER BY u.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users with passwords' });
  }
});

// PUT /api/users/:id/status
router.put('/:id/status', requireAdmin, async (req, res) => {
  const { status, rejection_feedback } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE users SET status = $1, rejection_feedback = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [status, rejection_feedback || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// PUT /api/users/:id/role
router.put('/:id/role', requireAdmin, async (req, res) => {
  const { role } = req.body;
  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [role, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Only superadmins can delete users' });
  }
  const { id } = req.params;
  if (String(req.user.id) === String(id)) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }
  try {
    const check = await pool.query('SELECT id, role FROM users WHERE id = $1', [id]);
    if (!check.rows.length) return res.status(404).json({ error: 'User not found' });
    if (check.rows[0].role === 'admin' || check.rows[0].role === 'superadmin') {
      return res.status(400).json({ error: 'Cannot delete admin accounts' });
    }
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
