const router = require('express').Router();
const pool = require('../db/pool');
const { requireAdmin, requireSuperAdmin } = require('../middleware/auth');

// GET /api/admin/stats — dashboard KPIs
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [usersRes, subsRes, paymentsRes, revenueRes, recentUsersRes, recentPaymentsRes, calcsRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status='active') AS active FROM users WHERE role='user'`),
      pool.query(`SELECT plan, COUNT(*) AS count FROM user_subscriptions GROUP BY plan`),
      pool.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status='pending') AS pending FROM payment_requests`),
      pool.query(`SELECT COALESCE(SUM(cost),0) AS total FROM subscription_logs WHERE action='approved'`),
      pool.query(`SELECT u.id, u.name, u.email, u.created_at, s.plan FROM users u LEFT JOIN user_subscriptions s ON s.user_id=u.id WHERE u.role='user' ORDER BY u.created_at DESC LIMIT 5`),
      pool.query(`SELECT pr.*, u.name AS user_name FROM payment_requests pr JOIN users u ON u.id=pr.user_id ORDER BY pr.created_at DESC LIMIT 5`),
      pool.query(`SELECT COUNT(*) AS total FROM calculations`),
    ]);

    const planDist = { free: 0, basic: 0, pro: 0 };
    subsRes.rows.forEach(r => { planDist[r.plan] = parseInt(r.count); });

    res.json({
      users: {
        total: parseInt(usersRes.rows[0].total),
        active: parseInt(usersRes.rows[0].active),
      },
      subscriptions: planDist,
      payments: {
        total: parseInt(paymentsRes.rows[0].total),
        pending: parseInt(paymentsRes.rows[0].pending),
      },
      revenue: {
        total: parseFloat(revenueRes.rows[0].total),
      },
      calculations: {
        total: parseInt(calcsRes.rows[0].total),
      },
      recent_users: recentUsersRes.rows,
      recent_payments: recentPaymentsRes.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

// GET /api/admin/stats/revenue — monthly revenue for chart
router.get('/stats/revenue', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') AS month,
         DATE_TRUNC('month', created_at) AS month_date,
         COALESCE(SUM(cost), 0) AS revenue
       FROM subscription_logs
       WHERE action = 'approved'
         AND created_at >= NOW() - INTERVAL '6 months'
       GROUP BY DATE_TRUNC('month', created_at)
       ORDER BY month_date ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch revenue data' });
  }
});

// GET /api/admin/logs/subscriptions
router.get('/logs/subscriptions', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT sl.*, u.name AS user_name, u.email AS user_email
       FROM subscription_logs sl
       JOIN users u ON u.id = sl.user_id
       ORDER BY sl.created_at DESC
       LIMIT 100`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch subscription logs' });
  }
});

// GET /api/admin/logs/system — superadmin only
router.get('/logs/system', requireSuperAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT sl.*, u.name AS user_name
       FROM system_logs sl
       LEFT JOIN users u ON u.id = sl.user_id
       ORDER BY sl.created_at DESC
       LIMIT 200`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch system logs' });
  }
});

// DELETE /api/admin/logs/system — superadmin only
router.delete('/logs/system', requireSuperAdmin, async (req, res) => {
  try {
    await pool.query(`DELETE FROM system_logs`);
    res.json({ message: 'System logs cleared' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to clear system logs' });
  }
});

// GET /api/admin/reset-requests — password reset requests pending admin review
router.get('/reset-requests', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT prt.id, prt.email, prt.token, prt.expires_at, prt.created_at, u.name AS user_name
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.used = false AND prt.expires_at > NOW()
       ORDER BY prt.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch reset requests' });
  }
});

// DELETE /api/admin/reset-requests/:id — dismiss a reset request
router.delete('/reset-requests/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE password_reset_tokens SET used = true WHERE id = $1', [req.params.id]);
    res.json({ message: 'Request dismissed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to dismiss request' });
  }
});

// GET /api/admin/admins — list admin accounts (superadmin only)
router.get('/admins', requireSuperAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.status, u.created_at
       FROM users u
       WHERE u.role IN ('admin', 'superadmin')
       ORDER BY u.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});

module.exports = router;
