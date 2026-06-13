const router = require('express').Router();
const pool = require('../db/pool');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { JWT_SECRET, requireAuth } = require('../middleware/auth');
const { sendOtpEmail, sendResetEmail } = require('../utils/mailer');

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const SALT_ROUNDS = 12;

function signToken(user, sessionToken) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role, sessionToken },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

async function issueSession(userId) {
  const sessionToken = uuidv4();
  await pool.query('UPDATE users SET session_token = $1 WHERE id = $2', [sessionToken, userId]);
  return sessionToken;
}

const http = require('http');

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

function isPrivateIp(ip) {
  return !ip || ip === 'unknown' || ip === '::1' || ip === '127.0.0.1' ||
    ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.') ||
    ip.startsWith('::ffff:127.') || ip.startsWith('::ffff:10.') || ip.startsWith('::ffff:192.168.');
}

async function getLocation(ip) {
  if (isPrivateIp(ip)) return 'Local / Private Network';
  return new Promise((resolve) => {
    const cleanIp = ip.replace('::ffff:', '');
    const req = http.get(`http://ip-api.com/json/${cleanIp}?fields=status,city,regionName,country`, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.status === 'success') {
            const parts = [json.city, json.regionName, json.country].filter(Boolean);
            resolve(parts.join(', ') || 'Unknown');
          } else {
            resolve('Unknown');
          }
        } catch { resolve('Unknown'); }
      });
    });
    req.on('error', () => resolve('Unknown'));
    req.setTimeout(3000, () => { req.destroy(); resolve('Unknown'); });
  });
}

async function logActivity(userId, userEmail, userName, action, req) {
  try {
    const ip = getClientIp(req);
    const location = await getLocation(ip);
    await pool.query(
      `INSERT INTO activity_logs (user_id, user_email, user_name, action, ip_address, user_agent, location)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, userEmail, userName, action, ip, req.headers['user-agent'] || 'unknown', location]
    );
  } catch (err) {
    console.error('[ActivityLog] Failed to log activity:', err.message);
  }
}

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const { rows: attempts } = await pool.query(
      `SELECT COUNT(*) FROM otp_attempts WHERE email = LOWER($1) AND created_at > NOW() - INTERVAL '1 hour'`,
      [email]
    );
    if (parseInt(attempts[0].count) >= 3) {
      return res.status(429).json({ error: 'Too many verification attempts. Please try again in 1 hour.' });
    }

    await pool.query('INSERT INTO otp_attempts (email) VALUES (LOWER($1))', [email]);

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query('DELETE FROM email_otps WHERE email = LOWER($1)', [email]);
    await pool.query(
      `INSERT INTO email_otps (email, name, password_hash, otp, expires_at, plain_password)
       VALUES (LOWER($1), $2, $3, $4, $5, $6)`,
      [email, name.trim(), passwordHash, otp, expiresAt, password]
    );

    await sendOtpEmail(email, name.trim(), otp);
    res.status(200).json({ message: 'Verification code sent. Please check your email.' });
  } catch (err) {
    console.error('[Auth] Signup error:', err);
    res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and verification code are required' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT * FROM email_otps WHERE email = LOWER($1) ORDER BY created_at DESC LIMIT 1`,
      [email]
    );

    if (!rows.length) {
      return res.status(400).json({ error: 'No pending verification found. Please sign up again.' });
    }

    const record = rows[0];

    if (new Date() > new Date(record.expires_at)) {
      await pool.query('DELETE FROM email_otps WHERE email = LOWER($1)', [email]);
      return res.status(400).json({ error: 'Verification code has expired. Please sign up again.' });
    }

    if (record.otp !== otp.trim()) {
      return res.status(400).json({ error: 'Incorrect verification code. Please try again.' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (existing.rows.length) {
      await pool.query('DELETE FROM email_otps WHERE email = LOWER($1)', [email]);
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const userId = uuidv4();
    const { rows: userRows } = await pool.query(
      `INSERT INTO users (id, email, name, password_hash, plain_password, role, status)
       VALUES ($1, LOWER($2), $3, $4, $5, 'user', 'active')
       RETURNING id, email, name, role, status, created_at`,
      [userId, email, record.name, record.password_hash, record.plain_password || null]
    );

    const user = userRows[0];

    await pool.query(
      `INSERT INTO user_subscriptions (user_id, plan, is_active, start_date, expiry_date)
       VALUES ($1, 'free', true, NOW(), NOW() + INTERVAL '30 days')
       ON CONFLICT (user_id) DO NOTHING`,
      [user.id]
    );

    await pool.query('DELETE FROM email_otps WHERE email = LOWER($1)', [email]);

    await logActivity(user.id, user.email, user.name, 'signup', req);

    const sessionToken = await issueSession(user.id);
    const token = signToken(user, sessionToken);
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, created_at: user.created_at } });
  } catch (err) {
    console.error('[Auth] Verify OTP error:', err);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

// POST /api/auth/resend-otp
router.post('/resend-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const { rows } = await pool.query(
      `SELECT * FROM email_otps WHERE email = LOWER($1) ORDER BY created_at DESC LIMIT 1`,
      [email]
    );

    if (!rows.length) {
      return res.status(400).json({ error: 'No pending verification found. Please sign up again.' });
    }

    const record = rows[0];

    const { rows: attempts } = await pool.query(
      `SELECT COUNT(*) FROM otp_attempts WHERE email = LOWER($1) AND created_at > NOW() - INTERVAL '1 hour'`,
      [email]
    );
    if (parseInt(attempts[0].count) >= 3) {
      return res.status(429).json({ error: 'Too many verification attempts. Please try again in 1 hour.' });
    }

    await pool.query('INSERT INTO otp_attempts (email) VALUES (LOWER($1))', [email]);

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `UPDATE email_otps SET otp = $1, expires_at = $2 WHERE email = LOWER($3)`,
      [otp, expiresAt, email]
    );

    await sendOtpEmail(email, record.name, otp);
    res.json({ message: 'A new verification code has been sent.' });
  } catch (err) {
    console.error('[Auth] Resend OTP error:', err);
    res.status(500).json({ error: 'Failed to resend code. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT u.*, COALESCE(s.plan, CASE WHEN u.role IN ('admin','superadmin') THEN 'pro' ELSE 'free' END) AS plan
       FROM users u
       LEFT JOIN user_subscriptions s ON s.user_id = u.id
       WHERE LOWER(u.email) = LOWER($1)`,
      [email.trim()]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];

    if (!user.password_hash) {
      return res.status(401).json({ error: 'Account not set up — please use password reset' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.status === 'rejected') {
      return res.status(403).json({ error: 'Your account has been suspended. Please contact support.' });
    }

    await logActivity(user.id, user.email, user.name, 'login', req);

    await pool.query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [user.id]);

    const sessionToken = await issueSession(user.id);
    const token = signToken(user, sessionToken);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        plan: user.plan || 'free',
        created_at: user.created_at,
      }
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req, res) => {
  try {
    await logActivity(req.user.id, req.user.email, req.user.name, 'logout', req);
    await pool.query('UPDATE users SET session_token = NULL WHERE id = $1', [req.user.id]);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('[Auth] Logout error:', err);
    res.json({ message: 'Logged out' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);

    if (!rows.length) {
      return res.json({ message: 'If that email is registered, a reset link has been sent.' });
    }

    const user = rows[0];
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      'UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND used = false',
      [user.id]
    );

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, email, token, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [user.id, user.email, token, expiresAt]
    );

    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const baseUrl = `${proto}://${host}`;
    const resetLink = `${baseUrl}/reset-password?token=${token}`;

    await sendResetEmail(user.email, user.name, resetLink);

    res.json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    console.error('[Auth] Forgot password error:', err);
    res.status(500).json({ error: 'Failed to send reset email. Please try again.' });
  }
});

// GET /api/auth/validate-token/:token
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
      return res.status(400).json({ error: 'This reset link is invalid or has already been used' });
    }

    const resetToken = rows[0];
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    await pool.query(
      'UPDATE users SET password_hash = $1, plain_password = $2, updated_at = NOW() WHERE id = $3',
      [passwordHash, password, resetToken.user_id]
    );
    await pool.query('UPDATE password_reset_tokens SET used = true WHERE id = $1', [resetToken.id]);

    await pool.query(
      `INSERT INTO system_logs (type, message, user_id, details)
       VALUES ('system', 'User password reset via admin-mediated token', $1, $2)`,
      [resetToken.user_id, JSON.stringify({ method: 'token_reset' })]
    );

    res.json({ message: 'Password reset successfully. You can now log in with your new password.' });
  } catch (err) {
    console.error('[Auth] Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;
