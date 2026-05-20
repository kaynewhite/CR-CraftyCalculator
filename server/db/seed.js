const pool = require('./pool');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const SALT_ROUNDS = 12;

async function seed() {
  const admins = [
    {
      email: 'admin@craftyr.com',
      password: 'Admin@CraftyR2026',
      name: 'Admin User',
      role: 'admin',
    },
    {
      email: 'superadmin@craftyr.com',
      password: 'SuperAdmin@CraftyR2026',
      name: 'Super Admin',
      role: 'superadmin',
    },
  ];

  for (const admin of admins) {
    try {
      const existing = await pool.query('SELECT id, role FROM users WHERE LOWER(email) = LOWER($1)', [admin.email]);

      if (existing.rows.length > 0) {
        const existingUser = existing.rows[0];
        if (existingUser.role !== admin.role) {
          const passwordHash = await bcrypt.hash(admin.password, SALT_ROUNDS);
          await pool.query(
            `UPDATE users SET name = $1, password_hash = $2, role = $3, updated_at = NOW() WHERE id = $4`,
            [admin.name, passwordHash, admin.role, existingUser.id]
          );
          console.log(`[Seed] Updated ${admin.role}: ${admin.email}`);
        } else {
          console.log(`[Seed] ${admin.role} already exists: ${admin.email}`);
        }
        continue;
      }

      const passwordHash = await bcrypt.hash(admin.password, SALT_ROUNDS);
      const userId = uuidv4();

      await pool.query(
        `INSERT INTO users (id, email, name, password_hash, role, status)
         VALUES ($1, $2, $3, $4, $5, 'active')`,
        [userId, admin.email.toLowerCase(), admin.name, passwordHash, admin.role]
      );

      await pool.query(
        `INSERT INTO user_subscriptions (user_id, plan, is_active, start_date, expiry_date)
         VALUES ($1, 'free', true, NOW(), NOW() + INTERVAL '1 year')
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );

      console.log(`[Seed] Created ${admin.role}: ${admin.email}`);
    } catch (err) {
      console.error(`[Seed] Failed for ${admin.email}:`, err.message);
    }
  }

  console.log('[Seed] Admin seeding complete');
  console.log('[Seed] Admin credentials:');
  console.log('[Seed]   admin@craftyr.com / Admin@CraftyR2026');
  console.log('[Seed]   superadmin@craftyr.com / SuperAdmin@CraftyR2026');
}

module.exports = seed;
