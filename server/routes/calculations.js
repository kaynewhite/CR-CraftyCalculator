const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

// GET /api/calculations
router.get('/', requireAuth, async (req, res) => {
  try {
    // Get plan limits
    const subRes = await pool.query(
      `SELECT s.plan, p.max_calculations, p.calc_expiry_days
       FROM user_subscriptions s
       JOIN subscription_plans p ON p.name = s.plan
       WHERE s.user_id = $1`,
      [req.user.id]
    );
    const sub = subRes.rows[0] || { plan: 'free', max_calculations: 3, calc_expiry_days: 30 };

    let query = `SELECT * FROM calculations WHERE user_id = $1`;
    const params = [req.user.id];

    // Expiry filter
    if (sub.calc_expiry_days > 0) {
      query += ` AND created_at >= NOW() - INTERVAL '${parseInt(sub.calc_expiry_days)} days'`;
    }

    query += ` ORDER BY created_at DESC`;

    // Limit
    if (sub.max_calculations !== -1) {
      query += ` LIMIT ${parseInt(sub.max_calculations)}`;
    }

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch calculations' });
  }
});

// GET /api/calculations/summary
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*) AS total_calculations,
         COALESCE(AVG(profit_amount), 0) AS average_profit,
         COALESCE(SUM(
           (SELECT COALESCE(SUM((m->>'quantity')::numeric), 0)
            FROM jsonb_array_elements(materials) AS m)
         ), 0) AS total_materials_used
       FROM calculations WHERE user_id = $1`,
      [req.user.id]
    );
    const recent = await pool.query(
      `SELECT * FROM calculations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [req.user.id]
    );
    res.json({
      ...rows[0],
      recent_calculations: recent.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// GET /api/calculations/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM calculations WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Calculation not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch calculation' });
  }
});

// POST /api/calculations
router.post('/', requireAuth, async (req, res) => {
  const { name, category, materials, total_cost, suggested_price, profit_margin, profit_amount, notes } = req.body;
  if (!name || !category) {
    return res.status(400).json({ error: 'name and category are required' });
  }

  // Check count limit
  const subRes = await pool.query(
    `SELECT s.plan, p.max_calculations, p.calc_expiry_days
     FROM user_subscriptions s
     JOIN subscription_plans p ON p.name = s.plan
     WHERE s.user_id = $1`,
    [req.user.id]
  );
  const sub = subRes.rows[0] || { max_calculations: 3, calc_expiry_days: 30 };

  if (sub.max_calculations !== -1) {
    let countQ = `SELECT COUNT(*) AS cnt FROM calculations WHERE user_id = $1`;
    const params = [req.user.id];
    if (sub.calc_expiry_days > 0) {
      countQ += ` AND created_at >= NOW() - INTERVAL '${parseInt(sub.calc_expiry_days)} days'`;
    }
    const countRes = await pool.query(countQ, params);
    if (parseInt(countRes.rows[0].cnt) >= sub.max_calculations) {
      return res.status(403).json({ error: `Calculation limit (${sub.max_calculations}) reached for your plan` });
    }
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO calculations (user_id, name, category, materials, total_cost, suggested_price, profit_margin, profit_amount, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.user.id, name, category, JSON.stringify(materials || []), total_cost || 0, suggested_price || 0, profit_margin || 0, profit_amount || 0, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save calculation' });
  }
});

// DELETE /api/calculations/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM calculations WHERE id = $1 AND user_id = $2 RETURNING id`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Calculation not found' });
    res.json({ message: 'Deleted', id: rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete calculation' });
  }
});

module.exports = router;
