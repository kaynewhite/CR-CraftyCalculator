# Crafty Rachel — System Documentation

**Version:** 1.0  
**Date:** June 2026  
**Prepared for:** Crafty Rachel — Pricing & Inventory Management System

---

## Table of Contents

1. [Core Thesis](#1-core-thesis)
2. [System Overview](#2-system-overview)
3. [Technology Stack](#3-technology-stack)
4. [Architecture](#4-architecture)
5. [User Roles & Access Control](#5-user-roles--access-control)
6. [Authentication System](#6-authentication-system)
7. [Feature Modules](#7-feature-modules)
   - 7.1 [Pricing Calculator](#71-pricing-calculator)
   - 7.2 [Material Inventory](#72-material-inventory)
   - 7.3 [Saved Calculations (History)](#73-saved-calculations-history)
   - 7.4 [Dashboard (User)](#74-dashboard-user)
   - 7.5 [Subscription Management](#75-subscription-management)
   - 7.6 [Payment System](#76-payment-system)
   - 7.7 [Notifications](#77-notifications)
   - 7.8 [Profile Management](#78-profile-management)
8. [Admin Features](#8-admin-features)
   - 8.1 [Admin Dashboard](#81-admin-dashboard)
   - 8.2 [User Management](#82-user-management)
   - 8.3 [Payment Approval](#83-payment-approval)
   - 8.4 [QR Code Management](#84-qr-code-management)
9. [Subscription Plans & Limits](#9-subscription-plans--limits)
10. [Subscription Lifecycle](#10-subscription-lifecycle)
11. [Email System](#11-email-system)
12. [Data Models](#12-data-models)
13. [API Endpoints](#13-api-endpoints)
14. [Security](#14-security)
15. [Database](#15-database)
16. [Deployment](#16-deployment)
17. [Glossary](#17-glossary)

---

## 1. Core Thesis

Crafty Rachel was built to solve a specific, practical problem faced by Filipino crafters and small-business owners: **most of them underprice their products because they have no easy way to calculate the true cost of what they make.**

The traditional approach — using a notepad or a basic spreadsheet — is slow, error-prone, and doesn't account for material waste, labor time, or desired profit margin. As a result, many artisans work long hours but barely break even.

Crafty Rachel provides a **structured, guided pricing calculator** that enforces the correct formula:

```
Selling Price = (Material Cost + Printing Cost + Labor Cost) × (1 + Markup %)
```

Combined with a **material inventory** that keeps unit costs up to date, and a **saved-calculation history** that lets users revisit and refine their pricing over time, Crafty Rachel gives crafters the tools they need to price confidently, scale sustainably, and understand where their money comes from.

The system is subscription-based, delivered as a web application accessible on any device, and administered by a dedicated admin who manages user accounts and payment approvals.

---

## 2. System Overview

Crafty Rachel is a **full-stack web application** with the following high-level structure:

| Layer         | Technology                            |
|---------------|---------------------------------------|
| Frontend      | Angular 19 (standalone components)    |
| Backend       | Node.js + Express 5                   |
| Database      | PostgreSQL (Neon serverless)          |
| Hosting       | Replit (cloud-hosted)                 |
| Email         | Nodemailer (SMTP)                     |
| Auth          | JWT (JSON Web Tokens) + OTP via email |

The application serves a **single-page Angular frontend** from the Express server. All API calls are prefixed with `/api/`. Authentication is enforced via JWT middleware on all protected routes.

---

## 3. Technology Stack

### Frontend
- **Angular 19** — standalone component architecture; no NgModules
- **Bootstrap Icons** — icon set (via CDN)
- **Bootstrap 5** — utility classes for layout and form controls
- **Google Fonts** — Fredoka (brand headings), Inter (body text)
- Custom CSS variables for theming (light/dark mode)

### Backend
- **Node.js** (runtime)
- **Express 5** (HTTP framework)
- **pg** (PostgreSQL client — node-postgres)
- **bcrypt** (password hashing, 12 salt rounds)
- **jsonwebtoken** (JWT creation and verification)
- **uuid** (v4 UUID generation)
- **nodemailer** (email delivery)
- **morgan** (HTTP request logging)
- **helmet** (HTTP security headers)

### Database
- **PostgreSQL** hosted on **Neon** (serverless, connection pooling enabled)
- Schema migrations run automatically on server start via a custom `migrate.js` script

### Infrastructure
- Hosted on **Replit**
- Environment variables managed via Replit Secrets (`NEON_DATABASE_URL`, SMTP credentials, `JWT_SECRET`)

---

## 4. Architecture

```
┌──────────────────────────────────────────┐
│              Browser (Angular 19)         │
│  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │ Services │  │Components│  │ Models │  │
│  └────┬─────┘  └──────────┘  └────────┘  │
│       │ HTTP (HttpClient)                 │
└───────┼──────────────────────────────────┘
        │ /api/*
┌───────▼──────────────────────────────────┐
│          Express Server (Node.js)         │
│  ┌────────────────────────────────────┐  │
│  │  Routes: auth, users, materials,   │  │
│  │  calculations, subscriptions,      │  │
│  │  payments, admin, notifications    │  │
│  └──────────────┬─────────────────────┘  │
│                 │ JWT Middleware           │
│  ┌──────────────▼─────────────────────┐  │
│  │  PostgreSQL Pool (Neon)             │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### Request flow
1. The Angular app makes HTTP requests to `/api/*` endpoints.
2. The `ApiService` (Angular) attaches the JWT bearer token to every authenticated request.
3. The Express `requireAuth` middleware verifies the JWT and attaches the decoded user to `req.user`.
4. Route handlers query the Neon PostgreSQL database via a connection pool.
5. Responses are returned as JSON; Angular services update their BehaviorSubjects, triggering reactive UI updates.

### Frontend State Management
Angular services hold application state as **RxJS BehaviorSubjects**:
- `AuthService.currentUser$` — logged-in user object
- `SubscriptionService.subscription$` — current subscription details
- `SubscriptionService.qr$` — GCash/Maya QR codes
- `PaymentService.requests$` — current user's payment requests
- `NotificationService.notifications$` — unread notification count

---

## 5. User Roles & Access Control

The system has two distinct roles visible to end users:

| Role    | Description                                                                 | Access                                     |
|---------|-----------------------------------------------------------------------------|---------------------------------------------|
| `user`  | Regular crafter/business owner account                                      | Calculator, Inventory, History, Subscription, Profile, Notifications |
| `admin` | Platform administrator                                                      | Admin Dashboard, User Management, Payment Approval, QR Manager, Password Resets |

Role is stored in the `users` table and encoded in the JWT. The frontend reads the role from the JWT payload (via `localStorage`) and routes accordingly:
- Users with role `user` are redirected to `/dashboard` after login.
- Users with role `admin` are redirected to `/admin-dashboard` after login.
- Attempting to access a role-restricted route without the correct role results in a redirect to the appropriate login page.

Backend middleware enforces access:
- `requireAuth` — validates JWT; rejects unauthenticated requests with `401`.
- `requireAdmin` — validates JWT and checks `role IN ('admin', 'superadmin')`; rejects with `403`.

---

## 6. Authentication System

### Registration (Signup with OTP)

1. User submits name, email, and password.
2. Server validates inputs (uniqueness, password strength, email format).
3. An OTP rate-limit check enforces **max 3 attempts per email per hour**.
4. A 6-digit OTP is generated and stored in `email_otps` table with a 10-minute expiry.
5. The OTP is sent to the user's email via Nodemailer.
6. User submits the OTP; server verifies it, creates the user account, creates a free subscription record, logs the `signup` activity, and issues a JWT.

### Login

1. User submits email and password.
2. Server looks up the user, verifies bcrypt hash.
3. Suspended (`rejected`) accounts receive a `403` error.
4. On success: activity logged, `last_seen_at` updated, new session token issued, JWT returned.

### Session Management

- JWT is stored in `localStorage` under `cr_auth_token`.
- JWT payload: `{ userId, email, role, sessionToken }`. Expires in **7 days**.
- Each user has a `session_token` column in `users`. On login, a new UUID is written. The middleware verifies that the token in the JWT matches the current `session_token` — this invalidates all previous sessions when a new login occurs.
- The frontend runs a **heartbeat** every 2 minutes to keep sessions alive and detect forced logouts.
- On logout: `session_token` set to `NULL` in the DB, JWT removed from `localStorage`.

### Password Reset

1. User requests reset → server generates a UUID token stored in `password_reset_tokens` (24h expiry).
2. A reset link containing the token is emailed.
3. User clicks link → frontend validates token with server.
4. User submits new password → server hashes it, updates the user record, marks token as used.

---

## 7. Feature Modules

### 7.1 Pricing Calculator

**Route:** `/calculator`  
**Plan requirement:** All plans (Free: 3 calculations/month)

The calculator is the primary tool. It computes a recommended selling price using:

```
Total Material Cost  = Σ (qty × cost_per_unit × (1 + waste% / 100))  per material
Total Cost           = Total Material Cost + Printing Cost + Labor Cost
Selling Price        = Total Cost × (1 + Markup% / 100)
Profit per batch     = Selling Price × Quantity - Total Cost
Profit per unit      = Profit per batch ÷ Quantity
```

**Inputs:**
- Product name
- Product category (type)
- Batch quantity (must be ≥ 1)
- Materials list (name, quantity, cost per unit, unit type, waste %)
- Printing cost (batch total)
- Labor cost (batch total)
- Markup percentage

**Outputs:**
- Real-time cost breakdown
- Suggested selling price
- Profit per batch and per unit

The calculator subscribes to `MaterialService` to auto-populate material costs from Inventory. The `subscription$` BehaviorSubject gates usage: if the monthly limit is reached (Free plan), users are prompted to upgrade.

Calculations are saved to the `calculations` table via `POST /api/calculations` and appear in History.

---

### 7.2 Material Inventory

**Route:** `/inventory`  
**Plan requirement:** All plans (limits apply)

Materials are stored in the `materials` table, scoped to the logged-in user via `user_id`.

**Fields per material:**
- `name` (unique per user)
- `quantity` (current stock)
- `cost_per_unit`
- `unit` — one of: piece, pack, roll, sheet, ream, meter
- `category` — built-in or custom (Pro only)

**CRUD operations:**
- `GET /api/materials` — lists user's materials
- `POST /api/materials` — creates a material (enforces plan limit)
- `PUT /api/materials/:id` — updates a material
- `DELETE /api/materials/:id` — soft or hard delete

Quantity can be adjusted with ± buttons directly on the inventory list without opening the edit modal.

**Built-in categories:** Paper, Adhesive, Decoration, Paint, Cards, Packaging, Stationery  
**Custom categories:** Pro plan only

---

### 7.3 Saved Calculations (History)

**Route:** `/saved`  
**Plan requirement:** All plans (save limits apply)

Calculations saved from the Calculator page are listed here. Each entry shows:
- Product name, category
- Batch quantity
- Total cost, selling price, profit
- Date saved

Users can search, sort (by date, profit, or name), view a full breakdown, or delete a saved calculation.

**Expiry:** Calculations expire based on the active plan when they were saved:
- Free: 30 days
- Basic: 60 days
- Pro: Never

---

### 7.4 Dashboard (User)

**Route:** `/dashboard`

The user dashboard provides:
- **Stats cards** — total calculations, total materials, total saved
- **3 most recent** saved calculations
- **Subscription expiry banner** — shown when paid plan expires within 7 days or has already expired

---

### 7.5 Subscription Management

**Route:** `/subscription`

Users can view their current plan and its features. They can initiate an upgrade by selecting a higher plan, which triggers the payment flow.

The subscription page also shows whether a **pending payment request** exists, blocking duplicate submissions.

**Subscription data** is fetched from `GET /api/subscriptions/me`, which enforces expiry in real time: if `expiry_date < NOW()` and the plan is not free, the backend returns `plan: 'free'` and `is_active: false`, automatically revoking paid access without requiring a scheduled job.

---

### 7.6 Payment System

Users pay for subscriptions manually via GCash or PayMaya. The flow is:

1. User selects a plan → sees a payment modal with QR code (fetched from `payment_qr_codes` table).
2. User scans QR in their e-wallet, completes payment, uploads a screenshot.
3. A `payment_requests` record is created with `status: 'pending'`.
4. Admin reviews the screenshot and approves or rejects.
5. On approval: subscription is updated, notification sent to user.
6. On rejection: notification sent with optional feedback reason.

**Rule:** A user may only have one pending/scanning request at a time.

---

### 7.7 Notifications

**Route:** Bell icon (all authenticated pages)

Notifications are stored in the `notifications` table and polled every 30 seconds by the `NotificationService`.

Notification triggers:
- Payment approved → user notified with plan name
- Payment rejected → user notified with optional reason

The bell icon shows a badge count for unread notifications. Clicking a notification marks it read.

---

### 7.8 Profile Management

**Route:** `/profile`

Users can:
- View their name, email, current plan, and member-since date
- Edit name and email (updates the `users` table and refreshes the JWT user cache)
- Change password (requires current password; hashed with bcrypt before storage)
- Reset password via emailed link if current password is unknown

---

## 8. Admin Features

Admin accounts use the same `users` table but with `role = 'admin'`. They log in at `/admin-login` and are routed to `/admin-dashboard`.

### 8.1 Admin Dashboard

**Route:** `/admin-dashboard`

Shows platform-wide statistics:
- Total registered users
- Active (paid) subscriptions
- Pending payment requests
- Total revenue from approved payments
- Monthly revenue bar chart (last 6 months)
- Recent pending payment requests (quick-action list)

Data source: `GET /api/admin/stats` and `GET /api/admin/stats/revenue`.

---

### 8.2 User Management

**Route:** `/admin/users`

Lists all `role = 'user'` accounts with their name, email, plan, status, and last seen timestamp.

**Admin actions:**
- **Suspend user** — sets `status = 'rejected'` in `users`. The user cannot log in.
- **Reactivate user** — sets `status = 'active'`.
- **View user** — side panel shows subscription details and payment history.

Admins can search by name/email and filter by account status.

---

### 8.3 Payment Approval

**Route:** `/admin/payments`

Lists all payment requests with:
- User name and email
- Requested plan
- Payment method (GCash / Maya)
- Uploaded screenshot (click to view full size)
- Submission timestamp

**Admin actions:**
- **Approve** — upgrades the user's subscription immediately; logs to `subscription_logs` and `system_logs`; sends notification.
- **Reject** — optionally provides a rejection reason; logs to `subscription_logs` and `system_logs`; sends notification.

---

### 8.4 QR Code Management

**Route:** `/admin/qr`

Admins upload QR code images for GCash and PayMaya. These images are stored as URLs in the `payment_qr_codes` table and served to users in the payment modal.

Each method (gcash, maya) has one active QR code at a time. Admins can remove and replace at any time.

---

## 9. Subscription Plans & Limits

| Attribute                  | Free         | Basic          | Pro             |
|----------------------------|--------------|----------------|-----------------|
| Monthly price (PHP)        | ₱0           | ₱100           | ₱250            |
| Calculations per month     | 3            | Unlimited       | Unlimited       |
| Max inventory items        | 10           | 50             | Unlimited       |
| Max saved calculations     | 3            | 10             | Unlimited       |
| Saved calculation expiry   | 30 days      | 60 days        | Never           |
| Custom material categories | No           | No             | Yes             |
| Priority support           | No           | Yes            | Yes (24/7)      |

All limit enforcement happens at both the backend (API returns errors if limits are exceeded) and frontend (UI shows upgrade prompts before blocked actions).

---

## 10. Subscription Lifecycle

```
[Sign Up]
    │
    ▼
[Free Plan — 30 days]
    │
    ├── No payment → stays Free
    │
    ├── Payment submitted → [Pending]
    │       │
    │       ├── Admin Approves → [Basic or Pro — 1 month]
    │       │         │
    │       │         ├── Expiry reached → auto-reverts to [Free]
    │       │         │
    │       │         └── Renewed → [Basic or Pro — 1 more month]
    │       │
    │       └── Admin Rejects → stays [Free]
    │
    └── Account suspended → cannot log in
```

**Expiry enforcement:** The backend checks `expiry_date < NOW()` on every call to `GET /api/subscriptions/me`. If the paid subscription has expired, the API returns `plan: 'free'` and marks `is_active = false` in the database. No scheduled job is required — expiry is enforced on first access after the deadline.

---

## 11. Email System

Crafty Rachel sends transactional emails via Nodemailer (SMTP).

### Email types

| Type             | Trigger                              | Content                                      |
|------------------|--------------------------------------|----------------------------------------------|
| OTP Verification | User completes signup form           | 6-digit code, valid 10 minutes               |
| Password Reset   | User requests forgot-password link   | Reset link, valid 24 hours                   |

All sent/failed emails are recorded in the `email_logs` table with `type`, `to_email`, `to_name`, `status` (`sent`/`failed`), `attempts`, and any error message.

**OTP rate limiting:** Max 3 OTP sends per email address per hour (tracked in `otp_attempts` table).

---

## 12. Data Models

### `users`
| Column               | Type        | Description                             |
|----------------------|-------------|-----------------------------------------|
| id                   | UUID (PK)   | Unique user identifier                  |
| email                | TEXT        | Lowercase, unique                       |
| name                 | TEXT        | Display name                            |
| password_hash        | TEXT        | bcrypt hash (12 rounds)                 |
| role                 | TEXT        | 'user' or 'admin'                       |
| status               | TEXT        | 'active' or 'rejected' (suspended)      |
| session_token        | UUID        | Current valid session; null when logged out |
| last_seen_at         | TIMESTAMPTZ | Updated on each login                   |
| created_at           | TIMESTAMPTZ | Account creation timestamp              |

### `user_subscriptions`
| Column          | Type        | Description                        |
|-----------------|-------------|------------------------------------|
| id              | UUID (PK)   |                                    |
| user_id         | UUID (FK)   | References users.id                |
| plan            | TEXT        | 'free', 'basic', or 'pro'          |
| is_active       | BOOLEAN     | False when expired or cancelled    |
| start_date      | TIMESTAMPTZ | When this billing period started   |
| expiry_date     | TIMESTAMPTZ | When this billing period ends      |
| duration_months | INTEGER     | How many months were purchased     |
| updated_at      | TIMESTAMPTZ |                                    |

### `materials`
| Column        | Type        | Description                       |
|---------------|-------------|-----------------------------------|
| id            | UUID (PK)   |                                   |
| user_id       | UUID (FK)   | Owner                             |
| name          | TEXT        | Unique per user                   |
| quantity      | NUMERIC     | Current stock                     |
| cost_per_unit | NUMERIC     | Price per unit                    |
| unit          | TEXT        | piece / pack / roll / sheet / ream / meter |
| category      | TEXT        | Material grouping                 |

### `calculations`
| Column        | Type        | Description                       |
|---------------|-------------|-----------------------------------|
| id            | UUID (PK)   |                                   |
| user_id       | UUID (FK)   |                                   |
| name          | TEXT        | Product name                      |
| data          | JSONB       | Full calculation snapshot         |
| created_at    | TIMESTAMPTZ |                                   |

### `payment_requests`
| Column          | Type        | Description                          |
|-----------------|-------------|--------------------------------------|
| id              | UUID (PK)   |                                      |
| user_id         | UUID (FK)   |                                      |
| plan            | TEXT        | Requested plan                       |
| method          | TEXT        | 'gcash' or 'maya'                    |
| screenshot_url  | TEXT        | Uploaded proof of payment            |
| status          | TEXT        | 'pending', 'scanning', 'approved', 'rejected' |
| approved_by     | UUID        | Admin who approved (nullable)        |
| rejected_by     | UUID        | Admin who rejected (nullable)        |
| feedback        | TEXT        | Rejection reason (nullable)          |
| created_at      | TIMESTAMPTZ |                                      |

### `notifications`
| Column     | Type      | Description                            |
|------------|-----------|----------------------------------------|
| id         | UUID (PK) |                                        |
| user_id    | UUID (FK) |                                        |
| type       | TEXT      | 'payment_approved', 'payment_rejected' |
| message    | TEXT      | Human-readable notification text       |
| is_read    | BOOLEAN   |                                        |
| created_at | TIMESTAMPTZ |                                      |

### `activity_logs`
| Column      | Type        | Description                        |
|-------------|-------------|------------------------------------|
| id          | UUID (PK)   |                                    |
| user_id     | UUID (FK)   |                                    |
| user_email  | TEXT        |                                    |
| user_name   | TEXT        |                                    |
| action      | TEXT        | 'login', 'logout', or 'signup'     |
| ip_address  | TEXT        | Client IP address                  |
| user_agent  | TEXT        | Browser/device string              |
| location    | TEXT        | City, Region, Country (ip-api.com) |
| created_at  | TIMESTAMPTZ |                                    |

### `email_logs`
| Column        | Type        | Description                       |
|---------------|-------------|-----------------------------------|
| id            | UUID (PK)   |                                   |
| type          | TEXT        | 'otp' or 'reset'                  |
| to_email      | TEXT        |                                   |
| to_name       | TEXT        |                                   |
| status        | TEXT        | 'sent' or 'failed'                |
| attempts      | INTEGER     | Delivery attempt count            |
| error_message | TEXT        | SMTP error if failed              |
| created_at    | TIMESTAMPTZ |                                   |

---

## 13. API Endpoints

All API routes are prefixed with `/api`. Protected routes require a valid `Authorization: Bearer <token>` header.

### Auth (`/api/auth`)
| Method | Path                        | Auth     | Description                        |
|--------|-----------------------------|----------|------------------------------------|
| POST   | /signup                     | Public   | Initiates OTP-based registration   |
| POST   | /verify-otp                 | Public   | Verifies OTP and creates account   |
| POST   | /resend-otp                 | Public   | Resends OTP (rate-limited)         |
| POST   | /login                      | Public   | Authenticates and returns JWT      |
| POST   | /logout                     | Auth     | Invalidates session token          |
| POST   | /forgot-password            | Public   | Sends password reset email         |
| GET    | /validate-token/:token      | Public   | Checks if reset token is valid     |
| POST   | /reset-password             | Public   | Resets password using token        |

### Users (`/api/users`)
| Method | Path             | Auth    | Description                       |
|--------|------------------|---------|-----------------------------------|
| GET    | /me              | Auth    | Current user's profile            |
| PUT    | /me              | Auth    | Update name/email                 |
| PUT    | /me/password     | Auth    | Change password                   |
| GET    | /               | Admin   | List all users                    |
| PUT    | /:id/status      | Admin   | Suspend or reactivate user        |
| PUT    | /:id/role        | Admin   | Change user role                  |
| DELETE | /:id             | Admin   | Delete user                       |

### Materials (`/api/materials`)
| Method | Path   | Auth  | Description              |
|--------|--------|-------|--------------------------|
| GET    | /      | Auth  | List user's materials    |
| POST   | /      | Auth  | Create material          |
| PUT    | /:id   | Auth  | Update material          |
| DELETE | /:id   | Auth  | Delete material          |

### Calculations (`/api/calculations`)
| Method | Path       | Auth  | Description                     |
|--------|------------|-------|---------------------------------|
| GET    | /          | Auth  | List user's saved calculations  |
| GET    | /summary   | Auth  | Aggregated stats                |
| POST   | /          | Auth  | Save a calculation              |
| DELETE | /:id       | Auth  | Delete a saved calculation      |

### Subscriptions (`/api/subscriptions`)
| Method | Path        | Auth    | Description                          |
|--------|-------------|---------|--------------------------------------|
| GET    | /plans      | Public  | List all subscription plans          |
| GET    | /me         | Auth    | Current user's subscription (expiry enforced) |
| GET    | /           | Admin   | List all subscriptions               |
| PUT    | /:userId    | Admin   | Upgrade/downgrade a user's plan      |

### Payments (`/api/payments`)
| Method | Path            | Auth    | Description                          |
|--------|-----------------|---------|--------------------------------------|
| GET    | /qr             | Public  | Get GCash/Maya QR codes              |
| PUT    | /qr             | Admin   | Upload QR code                       |
| GET    | /               | Auth    | My payment requests                  |
| GET    | /all            | Admin   | All payment requests                 |
| POST   | /               | Auth    | Submit payment request               |
| PUT    | /:id/approve    | Admin   | Approve a payment                    |
| PUT    | /:id/reject     | Admin   | Reject a payment                     |

### Admin (`/api/admin`)
| Method | Path              | Auth  | Description                          |
|--------|-------------------|-------|--------------------------------------|
| GET    | /stats            | Admin | Platform-wide statistics             |
| GET    | /stats/revenue    | Admin | Monthly revenue chart data           |
| GET    | /logs/subscriptions | Admin | Subscription action log            |
| GET    | /logs/system      | Admin | System event log                     |
| GET    | /logs/activity    | Admin | User activity log (login/logout/signup) |
| DELETE | /logs/system      | Admin | Clear system logs                    |
| DELETE | /logs/activity    | Admin | Clear activity logs                  |

### Notifications (`/api/notifications`)
| Method | Path       | Auth  | Description                     |
|--------|------------|-------|---------------------------------|
| GET    | /          | Auth  | List user's notifications       |
| PUT    | /:id/read  | Auth  | Mark notification as read       |
| PUT    | /read-all  | Auth  | Mark all notifications as read  |

---

## 14. Security

### Authentication & Authorization
- All sensitive routes protected by `requireAuth` JWT middleware.
- Admin routes further protected by `requireAdmin` role check.
- Session tokens are single-use per login — a new login invalidates all prior sessions.
- JWT expiry: 7 days.

### Password Security
- Passwords are hashed with **bcrypt** at 12 salt rounds before storage.
- Plain-text password is never logged or exposed in API responses.

### Input Validation
- Email format and uniqueness validated on signup.
- Password length minimum enforced (8 characters) on signup and reset.
- Plan names validated against an allowlist on all subscription update routes.
- Payment method validated against `['gcash', 'maya']` allowlist.

### Rate Limiting
- OTP requests: max **3 per email per hour** (tracked in `otp_attempts` table).
- One pending payment request per user at a time.

### HTTP Security
- **Helmet.js** sets security headers (X-Frame-Options, X-Content-Type-Options, etc.).
- CORS configured to restrict origins in production.
- Request body size capped at **10 MB** (for screenshot uploads).

### IP & Geolocation Logging
- Every login, logout, and signup event records the client's IP address (via `X-Forwarded-For` header chain), browser user agent, and approximate location (city, region, country via ip-api.com).
- Private/local IPs are identified and logged as "Local / Private Network".

---

## 15. Database

### Connection
- PostgreSQL via the `pg` (node-postgres) library using a **connection pool**.
- Connection string loaded from `NEON_DATABASE_URL` environment secret.
- SSL mode enforced by the Neon connection string.

### Schema Migrations
- On every server start, `server/db/migrate.js` runs `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ADD COLUMN IF NOT EXISTS` statements to ensure the schema is up to date.
- Migrations are additive only — no destructive changes are performed automatically.

### Key Tables Summary
| Table                  | Purpose                                     |
|------------------------|---------------------------------------------|
| `users`                | All accounts (users and admins)             |
| `user_subscriptions`   | Active subscription per user                |
| `subscription_plans`   | Plan definitions (seeded once)              |
| `materials`            | User's inventory items                      |
| `calculations`         | Saved pricing calculations                  |
| `payment_requests`     | Manual payment submissions                  |
| `payment_qr_codes`     | GCash/Maya QR code URLs                     |
| `subscription_logs`    | History of plan changes (approved/rejected) |
| `system_logs`          | Admin-level system events                   |
| `activity_logs`        | User login/logout/signup with IP & location |
| `notifications`        | In-app user notifications                   |
| `email_logs`           | OTP and reset email delivery records        |
| `email_otps`           | Pending OTP verification records            |
| `otp_attempts`         | OTP rate-limit tracking                     |
| `password_reset_tokens`| Forgot-password token storage               |

---

## 16. Deployment

Crafty Rachel is deployed on **Replit** using a single workflow:

```
Command: node server/index.js
```

The Angular frontend is pre-built (`ng build --configuration production`) and the resulting `dist/crafty-rachel/browser/` folder is served as static files by Express. All unknown paths return `index.html` to support Angular's client-side routing.

**Environment secrets required:**
| Secret                | Purpose                             |
|-----------------------|-------------------------------------|
| `NEON_DATABASE_URL`   | PostgreSQL connection string        |
| `JWT_SECRET`          | Signs and verifies JWTs             |
| `SMTP_HOST`           | Email server hostname               |
| `SMTP_PORT`           | Email server port                   |
| `SMTP_USER`           | SMTP username                       |
| `SMTP_PASS`           | SMTP password                       |
| `SMTP_FROM`           | From address for outgoing emails    |

---

## 17. Glossary

| Term                  | Definition                                                                 |
|-----------------------|----------------------------------------------------------------------------|
| **OTP**               | One-Time Password — a 6-digit code sent by email to verify a new account. |
| **JWT**               | JSON Web Token — a signed token used to authenticate API requests.         |
| **Markup**            | The percentage added on top of total cost to determine the selling price.  |
| **Waste %**           | The percentage of a material that is wasted during production (e.g., paper offcuts). Applied per material to increase effective cost. |
| **Batch**             | A single production run that produces a set quantity of a product.         |
| **Plan**              | Subscription tier: Free, Basic, or Pro. Determines feature limits.         |
| **Expiry**            | The date when a paid subscription ends. After this date the plan reverts to Free. |
| **is_active**         | A database flag indicating whether the subscription is currently valid.    |
| **BehaviorSubject**   | An RxJS object in the Angular frontend that holds the current value and emits updates to all subscribers. |
| **Session Token**     | A UUID stored per user in the database. Included in the JWT; used to invalidate previous sessions on new login. |
| **Heartbeat**         | A periodic request (every 2 minutes) the frontend sends to keep the session alive. |
| **QR Code**           | A scannable image linked to a GCash or PayMaya account, used for payment. |
| **Payment Request**   | A record created when a user submits proof of payment. Reviewed by an admin. |
| **Activity Log**      | A server-side record of login, logout, and signup events including IP address and location. |
| **System Log**        | A record of admin-level events: approvals, rejections, and errors.        |
| **Email Log**         | A record of every OTP and password reset email sent or failed.            |
| **bcrypt**            | A password-hashing algorithm. Crafty Rachel uses 12 salt rounds.          |
| **Neon**              | Serverless PostgreSQL hosting provider used for the production database.  |
| **CORS**              | Cross-Origin Resource Sharing — HTTP mechanism that controls which origins can access the API. |
| **Helmet**            | Express middleware that sets HTTP security headers.                        |
| **Standalone component** | An Angular 19 component that declares its own imports without an NgModule. |
| **SMTP**              | Simple Mail Transfer Protocol — the email delivery standard used by Nodemailer. |
