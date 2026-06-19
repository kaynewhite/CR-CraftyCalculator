const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// GET /api/subscriptions/plans — public
router.get('/plans', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM subscription_plans ORDER BY price ASC`);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// GET /api/subscriptions/me — current user's subscription
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id AS user_id, u.role,
              s.id AS sub_id, s.plan, s.is_active, s.start_date, s.expiry_date, s.duration_months
       FROM users u
       LEFT JOIN user_subscriptions s ON s.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Subscription not found' });

    const row = rows[0];
    const isAdminRole = row.role === 'admin' || row.role === 'superadmin';

    // Determine if expired (only applies to regular users with a paid plan)
    const now = new Date();
    const expiryDate = row.expiry_date ? new Date(row.expiry_date) : null;
    const isExpired = !isAdminRole && expiryDate !== null && expiryDate < now && row.plan && row.plan !== 'free';

    // If expired and still marked active in DB, update it
    if (isExpired && row.is_active) {
      await pool.query(
        `UPDATE user_subscriptions SET is_active = false, updated_at = NOW() WHERE user_id = $1`,
        [row.user_id]
      );
    }

    const effectivePlan = isAdminRole ? (row.plan || 'pro') : (isExpired ? 'free' : (row.plan || 'free'));
    const effectiveIsActive = isAdminRole ? true : (isExpired ? false : (row.is_active ?? true));
    const effectiveExpiry = isAdminRole
      ? (row.expiry_date || new Date(Date.now() + 10 * 365 * 86400000))
      : (row.expiry_date || new Date(Date.now() + 30 * 86400000));

    // Fetch plan details
    const { rows: planRows } = await pool.query(
      `SELECT display_name, price, max_calculations, calc_expiry_days, max_materials, features, limitations
       FROM subscription_plans WHERE name = $1`,
      [effectivePlan]
    );
    const planDetails = planRows[0] || {};

    res.json({
      id: row.sub_id,
      user_id: row.user_id,
      plan: effectivePlan,
      is_active: effectiveIsActive,
      start_date: row.start_date || now,
      expiry_date: effectiveExpiry,
      duration_months: row.duration_months || (isAdminRole ? 120 : 1),
      ...planDetails,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// GET /api/subscriptions — all subscriptions (admin)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*, u.name, u.email, u.status AS user_status
       FROM user_subscriptions s
       JOIN users u ON u.id = s.user_id
       ORDER BY s.updated_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// PUT /api/subscriptions/:userId — admin upgrades/downgrades a user's plan
router.put('/:userId', requireAdmin, async (req, res) => {
  const { plan, duration_months = 1 } = req.body;
  if (!['free', 'basic', 'pro'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan' });
  }

  const expiryInterval = plan === 'free' ? `'30 days'` : `'${parseInt(duration_months)} months'`;

  try {
    const { rows } = await pool.query(
      `INSERT INTO user_subscriptions (user_id, plan, is_active, start_date, expiry_date, duration_months)
       VALUES ($1, $2, true, NOW(), NOW() + INTERVAL ${expiryInterval}, $3)
       ON CONFLICT (user_id) DO UPDATE
         SET plan = EXCLUDED.plan,
             is_active = true,
             start_date = NOW(),
             expiry_date = NOW() + INTERVAL ${expiryInterval},
             duration_months = EXCLUDED.duration_months,
             updated_at = NOW()
       RETURNING *`,
      [req.params.userId, plan, duration_months]
    );

    // Log it
    const price = plan === 'free' ? 0 : plan === 'basic' ? 100 : 250;
    await pool.query(
      `INSERT INTO subscription_logs (user_id, action, plan, cost, approved_by)
       VALUES ($1, 'upgraded', $2, $3, $4)`,
      [req.params.userId, plan, price, req.user.id]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

module.exports = router;
