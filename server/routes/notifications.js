const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const notifications = [];

    const payRes = await pool.query(
      `SELECT id, plan, status, feedback, updated_at
       FROM payment_requests
       WHERE user_id = $1
         AND status IN ('approved','rejected')
         AND updated_at > NOW() - INTERVAL '14 days'
       ORDER BY updated_at DESC`,
      [userId]
    );

    payRes.rows.forEach(pr => {
      if (pr.status === 'approved') {
        notifications.push({
          id: 'pay_' + pr.id,
          type: 'payment_approved',
          message: `Your ${pr.plan.toUpperCase()} plan payment was approved! Your subscription is now active.`,
          created_at: pr.updated_at,
        });
      } else {
        const feedback = pr.feedback ? ` Reason: "${pr.feedback}"` : '';
        notifications.push({
          id: 'pay_' + pr.id,
          type: 'payment_rejected',
          message: `Your ${pr.plan.toUpperCase()} plan payment was rejected.${feedback}`,
          created_at: pr.updated_at,
        });
      }
    });

    const subRes = await pool.query(
      `SELECT plan, expiry_date
       FROM user_subscriptions
       WHERE user_id = $1
         AND is_active = true
         AND expiry_date IS NOT NULL
         AND expiry_date > NOW()
         AND expiry_date < NOW() + INTERVAL '7 days'`,
      [userId]
    );

    subRes.rows.forEach(sub => {
      const daysLeft = Math.ceil((new Date(sub.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      notifications.push({
        id: 'sub_expiry_' + sub.plan,
        type: 'subscription_expiring',
        message: `Your ${sub.plan.toUpperCase()} subscription expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Renew to keep access.`,
        created_at: new Date().toISOString(),
      });
    });

    notifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    res.json(notifications);
  } catch (err) {
    console.error('[Notifications]', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

module.exports = router;
