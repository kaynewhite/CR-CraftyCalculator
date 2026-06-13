const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const pool = require('../db/pool');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// GET /api/payments/qr — public QR codes for GCash/Maya
router.get('/qr', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM payment_qr_codes`);
    const result = {};
    rows.forEach(r => { result[r.method] = r.qr_url; });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch QR codes' });
  }
});

// PUT /api/payments/qr — admin sets QR codes
router.put('/qr', requireAdmin, async (req, res) => {
  const { method, qr_url } = req.body;
  if (!['gcash', 'maya'].includes(method)) {
    return res.status(400).json({ error: 'method must be gcash or maya' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE payment_qr_codes SET qr_url = $1, updated_at = NOW() WHERE method = $2 RETURNING *`,
      [qr_url, method]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update QR code' });
  }
});

// GET /api/payments — my payment requests
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM payment_requests WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch payment requests' });
  }
});

// GET /api/payments/all — admin: all payment requests
router.get('/all', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT pr.*, u.name AS user_name, u.email AS user_email
       FROM payment_requests pr
       JOIN users u ON u.id = pr.user_id
       ORDER BY pr.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch all payment requests' });
  }
});

// POST /api/payments — submit a payment request with screenshot upload
router.post('/', requireAuth, async (req, res) => {
  const { plan, method, screenshot_url } = req.body;

  if (!['basic', 'pro'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan' });
  }
  if (!['gcash', 'maya'].includes(method)) {
    return res.status(400).json({ error: 'Invalid payment method' });
  }

  try {
    // Prevent users from submitting multiple pending requests
    const existingRes = await pool.query(
      `SELECT COUNT(*) AS cnt FROM payment_requests WHERE user_id = $1 AND status IN ('pending','scanning')`,
      [req.user.id]
    );
    if (parseInt(existingRes.rows[0].cnt) > 0) {
      return res.status(409).json({ error: 'You already have a pending payment request' });
    }
    const { rows } = await pool.query(
      `INSERT INTO payment_requests (user_id, plan, method, screenshot_url, status)
       VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
      [req.user.id, plan, method, screenshot_url || null]
    );

    // System log
    await pool.query(
      `INSERT INTO system_logs (type, message, user_id, details)
       VALUES ('system', 'New payment request submitted', $1, $2)`,
      [req.user.id, JSON.stringify({ plan, method })]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit payment request' });
  }
});

// PUT /api/payments/:id/approve — admin approves
router.put('/:id/approve', requireAdmin, async (req, res) => {
  try {
    // Get the request first
    const reqRes = await pool.query(`SELECT * FROM payment_requests WHERE id = $1`, [req.params.id]);
    if (!reqRes.rows.length) return res.status(404).json({ error: 'Payment request not found' });
    const pr = reqRes.rows[0];

    // Update payment request
    const { rows } = await pool.query(
      `UPDATE payment_requests
       SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [req.user.id, req.params.id]
    );

    // Upgrade subscription
    const duration = 1;
    const expiryInterval = pr.plan === 'basic' ? '1 month' : '1 month';
    await pool.query(
      `INSERT INTO user_subscriptions (user_id, plan, is_active, start_date, expiry_date, duration_months)
       VALUES ($1, $2, true, NOW(), NOW() + INTERVAL '${expiryInterval}', $3)
       ON CONFLICT (user_id) DO UPDATE
         SET plan = EXCLUDED.plan, is_active = true,
             start_date = NOW(), expiry_date = NOW() + INTERVAL '${expiryInterval}',
             duration_months = EXCLUDED.duration_months, updated_at = NOW()`,
      [pr.user_id, pr.plan, duration]
    );

    // Subscription log
    const price = pr.plan === 'basic' ? 100 : 250;
    await pool.query(
      `INSERT INTO subscription_logs (user_id, action, plan, cost, approved_by)
       VALUES ($1, 'approved', $2, $3, $4)`,
      [pr.user_id, pr.plan, price, req.user.id]
    );

    // System log
    await pool.query(
      `INSERT INTO system_logs (type, message, user_id, admin_id, details)
       VALUES ('approval', 'Payment approved and subscription upgraded', $1, $2, $3)`,
      [pr.user_id, req.user.id, JSON.stringify({ plan: pr.plan })]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to approve payment' });
  }
});

// PUT /api/payments/:id/reject — admin rejects
router.put('/:id/reject', requireAdmin, async (req, res) => {
  const { feedback } = req.body;
  try {
    const reqRes = await pool.query(`SELECT * FROM payment_requests WHERE id = $1`, [req.params.id]);
    if (!reqRes.rows.length) return res.status(404).json({ error: 'Payment request not found' });
    const pr = reqRes.rows[0];

    const { rows } = await pool.query(
      `UPDATE payment_requests
       SET status = 'rejected', rejected_by = $1, rejected_at = NOW(), feedback = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [req.user.id, feedback || null, req.params.id]
    );

    // Subscription log
    await pool.query(
      `INSERT INTO subscription_logs (user_id, action, plan, cost, approved_by, feedback)
       VALUES ($1, 'rejected', $2, 0, $3, $4)`,
      [pr.user_id, pr.plan, req.user.id, feedback || null]
    );

    // System log
    await pool.query(
      `INSERT INTO system_logs (type, message, user_id, admin_id, details)
       VALUES ('rejection', 'Payment rejected', $1, $2, $3)`,
      [pr.user_id, req.user.id, JSON.stringify({ plan: pr.plan, feedback })]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reject payment' });
  }
});

module.exports = router;
