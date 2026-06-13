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
      `SELECT COALESCE(s.id, uuid_generate_v4()) AS id,
              COALESCE(s.user_id, u.id) AS user_id,
              COALESCE(s.plan, CASE WHEN u.role IN ('admin','superadmin') THEN 'pro' ELSE 'free' END) AS plan,
              COALESCE(s.is_active, true) AS is_active,
              COALESCE(s.start_date, NOW()) AS start_date,
              COALESCE(s.expiry_date, CASE WHEN u.role IN ('admin','superadmin') THEN NOW() + INTERVAL '10 years' ELSE NOW() + INTERVAL '30 days' END) AS expiry_date,
              COALESCE(s.duration_months, CASE WHEN u.role IN ('admin','superadmin') THEN 120 ELSE 1 END) AS duration_months,
              p.display_name, p.price, p.max_calculations, p.calc_expiry_days, p.max_materials, p.features, p.limitations
       FROM users u
       LEFT JOIN user_subscriptions s ON s.user_id = u.id
       LEFT JOIN subscription_plans p ON p.name = COALESCE(s.plan, CASE WHEN u.role IN ('admin','superadmin') THEN 'pro' ELSE 'free' END)
       WHERE u.id = $1`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Subscription not found' });
    res.json(rows[0]);
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
