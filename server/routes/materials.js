const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

// GET /api/materials
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM materials WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch materials' });
  }
});

// POST /api/materials
router.post('/', requireAuth, async (req, res) => {
  const { name, quantity, cost_per_unit, unit, category } = req.body;
  if (!name || quantity == null || cost_per_unit == null || !unit) {
    return res.status(400).json({ error: 'name, quantity, cost_per_unit, unit are required' });
  }

  // Check inventory limit
  const subRes = await pool.query(
    `SELECT s.plan, p.max_materials
     FROM user_subscriptions s
     JOIN subscription_plans p ON p.name = s.plan
     WHERE s.user_id = $1`,
    [req.user.id]
  );
  const sub = subRes.rows[0];
  if (sub && sub.max_materials !== -1) {
    const countRes = await pool.query(
      `SELECT COUNT(*) AS cnt FROM materials WHERE user_id = $1`,
      [req.user.id]
    );
    if (parseInt(countRes.rows[0].cnt) >= sub.max_materials) {
      return res.status(403).json({ error: `Inventory limit (${sub.max_materials}) reached for your plan` });
    }
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO materials (user_id, name, quantity, cost_per_unit, unit, category)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.id, name, quantity, cost_per_unit, unit, category || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create material' });
  }
});

// PUT /api/materials/:id
router.put('/:id', requireAuth, async (req, res) => {
  const { name, quantity, cost_per_unit, unit, category } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE materials
       SET name = COALESCE($1, name),
           quantity = COALESCE($2, quantity),
           cost_per_unit = COALESCE($3, cost_per_unit),
           unit = COALESCE($4, unit),
           category = COALESCE($5, category),
           updated_at = NOW()
       WHERE id = $6 AND user_id = $7 RETURNING *`,
      [name, quantity, cost_per_unit, unit, category, req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Material not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update material' });
  }
});

// DELETE /api/materials/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM materials WHERE id = $1 AND user_id = $2 RETURNING id`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Material not found' });
    res.json({ message: 'Deleted', id: rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete material' });
  }
});

module.exports = router;
