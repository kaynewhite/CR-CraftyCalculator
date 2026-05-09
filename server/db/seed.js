const pool = require('./pool');

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const CLERK_API = 'https://api.clerk.com/v1';

async function clerkRequest(method, path, body) {
  const res = await fetch(`${CLERK_API}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function findOrCreateClerkUser({ email, password, firstName, lastName }) {
  const existing = await clerkRequest('GET', `/users?email_address=${encodeURIComponent(email)}&limit=5`);
  if (Array.isArray(existing) && existing.length > 0) {
    console.log(`[Seed] User ${email} already exists in Clerk (${existing[0].id})`);
    return existing[0].id;
  }

  const created = await clerkRequest('POST', '/users', {
    email_address: [email],
    password,
    first_name: firstName,
    last_name: lastName,
    skip_password_checks: true,
    skip_password_requirement: false,
  });

  if (created.errors || created.error) {
    const errMsg = created.errors
      ? created.errors.map(e => e.long_message || e.message).join(', ')
      : created.error;
    throw new Error(errMsg);
  }

  console.log(`[Seed] Created Clerk user ${email} (${created.id})`);
  return created.id;
}

async function seed() {
  if (!CLERK_SECRET_KEY) {
    console.log('[Seed] No CLERK_SECRET_KEY — skipping admin seed');
    return;
  }

  const admins = [
    {
      email: 'admin@gmail.com',
      password: 'Admin@123!',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
    },
    {
      email: 'kaynematsuzuki@gmail.com',
      password: 'SuperAdmin@123!',
      firstName: 'Kayne',
      lastName: 'Matsuzuki',
      role: 'superadmin',
    },
  ];

  for (const admin of admins) {
    try {
      const clerkId = await findOrCreateClerkUser(admin);

      await pool.query(
        `INSERT INTO users (id, name, email, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           email = EXCLUDED.email,
           role = EXCLUDED.role,
           updated_at = NOW()`,
        [clerkId, `${admin.firstName} ${admin.lastName}`, admin.email, admin.role]
      );

      console.log(`[Seed] ${admin.role} seeded: ${admin.email}`);
    } catch (err) {
      console.error(`[Seed] Failed for ${admin.email}: ${err.message}`);
    }
  }
}

module.exports = seed;
