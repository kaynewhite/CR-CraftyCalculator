const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth, requireAdmin, requireSuperAdmin } = require('../middleware/auth');

const VALID_TYPES = ['bug', 'problem', 'feedback', 'other'];

// POST /api/reports — any authenticated user or admin submits a report
router.post('/', requireAuth, async (req, res) => {
  try {
    const { type, subject, description } = req.body;
    const reporterRole = (req.user.role === 'admin' || req.user.role === 'superadmin') ? 'admin' : 'user';

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Invalid report type' });
    }
    if (!subject || subject.trim().length < 3) {
      return res.status(400).json({ error: 'Subject must be at least 3 characters' });
    }
    if (!description || description.trim().length < 10) {
      return res.status(400).json({ error: 'Description must be at least 10 characters' });
    }

    const { rows } = await pool.query(
      `INSERT INTO reports (reporter_id, reporter_role, type, subject, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.id, reporterRole, type, subject.trim(), description.trim()]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[Reports] submit error:', err.message);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// GET /api/reports/mine — reporter sees their own reports
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*,
              fwd.name AS forwarded_by_name
       FROM reports r
       LEFT JOIN users fwd ON fwd.id = r.forwarded_by
       WHERE r.reporter_id = $1
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[Reports] mine error:', err.message);
    res.status(500).json({ error: 'Failed to load reports' });
  }
});

// GET /api/reports/user-reports — admin sees all user reports
router.get('/user-reports', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*,
              u.name  AS reporter_name,
              u.email AS reporter_email,
              fwd.name AS forwarded_by_name
       FROM reports r
       JOIN users u ON u.id = r.reporter_id
       LEFT JOIN users fwd ON fwd.id = r.forwarded_by
       WHERE r.reporter_role = 'user'
       ORDER BY r.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('[Reports] user-reports error:', err.message);
    res.status(500).json({ error: 'Failed to load user reports' });
  }
});

// GET /api/reports/admin-reports — superadmin sees admin-submitted + forwarded user reports
router.get('/admin-reports', requireSuperAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*,
              u.name  AS reporter_name,
              u.email AS reporter_email,
              fwd.name AS forwarded_by_name
       FROM reports r
       JOIN users u ON u.id = r.reporter_id
       LEFT JOIN users fwd ON fwd.id = r.forwarded_by
       WHERE r.reporter_role = 'admin'
          OR (r.reporter_role = 'user' AND r.is_forwarded = TRUE)
       ORDER BY r.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('[Reports] admin-reports error:', err.message);
    res.status(500).json({ error: 'Failed to load admin reports' });
  }
});

// PUT /api/reports/:id/seen — admin marks user report as seen
router.put('/:id/seen', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE reports
       SET status = 'seen', updated_at = NOW()
       WHERE id = $1 AND reporter_role = 'user' AND status = 'open'
       RETURNING *`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Report not found or already seen' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[Reports] seen error:', err.message);
    res.status(500).json({ error: 'Failed to update report' });
  }
});

// PUT /api/reports/:id/reply — admin replies to user report; superadmin replies to admin report
router.put('/:id/reply', requireAdmin, async (req, res) => {
  try {
    const { reply } = req.body;
    if (!reply || reply.trim().length < 1) {
      return res.status(400).json({ error: 'Reply cannot be empty' });
    }

    const isSuperAdmin = req.user.role === 'superadmin';

    let q, params;
    if (isSuperAdmin) {
      // superadmin replies to admin reports or forwarded user reports
      q = `UPDATE reports
           SET superadmin_reply = $1, superadmin_reply_at = NOW(), status = 'seen', updated_at = NOW()
           WHERE id = $2
             AND (reporter_role = 'admin' OR (reporter_role = 'user' AND is_forwarded = TRUE))
           RETURNING *`;
      params = [reply.trim(), req.params.id];
    } else {
      // admin replies to user reports
      q = `UPDATE reports
           SET admin_reply = $1, admin_reply_at = NOW(), status = 'seen', updated_at = NOW()
           WHERE id = $2 AND reporter_role = 'user'
           RETURNING *`;
      params = [reply.trim(), req.params.id];
    }

    const { rows } = await pool.query(q, params);
    if (!rows.length) return res.status(404).json({ error: 'Report not found or not in your scope' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[Reports] reply error:', err.message);
    res.status(500).json({ error: 'Failed to reply to report' });
  }
});

// PUT /api/reports/:id/forward — admin forwards user report to superadmin
router.put('/:id/forward', requireAdmin, async (req, res) => {
  try {
    if (req.user.role === 'superadmin') {
      return res.status(400).json({ error: 'SuperAdmins cannot forward reports' });
    }

    const { rows } = await pool.query(
      `UPDATE reports
       SET is_forwarded = TRUE,
           forwarded_by = $1,
           forwarded_at = NOW(),
           updated_at   = NOW()
       WHERE id = $2
         AND reporter_role = 'user'
         AND is_forwarded  = FALSE
       RETURNING *`,
      [req.user.id, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Report not found or already forwarded' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[Reports] forward error:', err.message);
    res.status(500).json({ error: 'Failed to forward report' });
  }
});

// PUT /api/reports/:id/resolve — admin/superadmin resolves a report
router.put('/:id/resolve', requireAdmin, async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'superadmin';

    let where;
    if (isSuperAdmin) {
      where = `(reporter_role = 'admin' OR (reporter_role = 'user' AND is_forwarded = TRUE))`;
    } else {
      where = `reporter_role = 'user'`;
    }

    const { rows } = await pool.query(
      `UPDATE reports
       SET status = 'resolved', resolved_by = $1, resolved_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND ${where}
       RETURNING *`,
      [req.user.id, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Report not found or not in your scope' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[Reports] resolve error:', err.message);
    res.status(500).json({ error: 'Failed to resolve report' });
  }
});

// DELETE /api/reports/:id — superadmin deletes any report
router.delete('/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM reports WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Report not found' });
    res.json({ message: 'Report deleted' });
  } catch (err) {
    console.error('[Reports] delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

module.exports = router;
