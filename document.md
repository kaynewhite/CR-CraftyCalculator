# Crafty Rachel — System Documentation

**Version:** 1.0  
**Date:** June 2026  
**Prepared for:** Crafty Rachel — Pricing & Inventory Management System

---

## Table of Contents

1. [Core Thesis](#1-core-thesis)
2. [System Overview](#2-system-overview)
3. [Technology Stack](#3-technology-stack)
4. [User Roles & Access Control](#4-user-roles--access-control)
5. [Authentication System](#5-authentication-system)
6. [Feature Modules](#6-feature-modules)
   - 6.1 [Pricing Calculator](#61-pricing-calculator)
   - 6.2 [Material Inventory](#62-material-inventory)
   - 6.3 [Saved Calculations (History)](#63-saved-calculations-history)
   - 6.4 [Dashboard (User)](#64-dashboard-user)
   - 6.5 [Subscription Management](#65-subscription-management)
   - 6.6 [Payment System](#66-payment-system)
   - 6.7 [Notifications](#67-notifications)
   - 6.8 [Profile Management](#68-profile-management)
   - 6.9 [Reports](#69-reports)
7. [Admin Features](#7-admin-features)
   - 7.1 [Admin Dashboard](#71-admin-dashboard)
   - 7.2 [User Management](#72-user-management)
   - 7.3 [Payment Approval](#73-payment-approval)
   - 7.4 [QR Code Management](#74-qr-code-management)
   - 7.5 [Admin Reports](#75-admin-reports)
8. [Subscription Plans & Limits](#8-subscription-plans--limits)
9. [Subscription Lifecycle](#9-subscription-lifecycle)
10. [Email System](#10-email-system)
11. [Data Models](#11-data-models)
12. [API Endpoints](#12-api-endpoints)
13. [Security](#13-security)
14. [Database](#14-database)
15. [Deployment](#15-deployment)
16. [Glossary](#16-glossary)

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
| Hosting       | Render (cloud-hosted)                 |
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
- Hosted on **Render**
- Environment variables managed via Render's environment configuration (`NEON_DATABASE_URL`, SMTP credentials, `JWT_SECRET`)

---

## 4. User Roles & Access Control

The system has two distinct roles visible to end users:

| Role    | Description                          | Access                                                                         |
|---------|--------------------------------------|---------------------------------------------------------------------------------|
| `user`  | Regular crafter/business owner       | Calculator, Inventory, History, Subscription, Profile, Notifications, Reports  |
| `admin` | Platform administrator               | All user features + Admin Dashboard, User Management, Payment Approval, QR Manager, Reports Management |

**Admins have full access to all regular user features** (Calculator, Inventory, Saved Calculations, Profile, etc.) in addition to the admin control panel. This allows admins to use the platform as crafters themselves while also managing it.

Role is stored in the `users` table and encoded in the JWT. The frontend reads the role from the JWT payload (via `localStorage`) and routes accordingly:
- Users with role `user` are redirected to `/dashboard` after login.
- Users with role `admin` are redirected to `/admin-dashboard` after login.
- Attempting to access a role-restricted route without the correct role results in a redirect.

Backend middleware enforces access:
- `requireAuth` — validates JWT; rejects unauthenticated requests with `401`.
- `requireAdmin` — validates JWT and checks `role IN ('admin', 'superadmin')`; rejects with `403`.
- `requireSuperAdmin` — validates JWT and checks `role = 'superadmin'`; rejects with `403`.

---

## 5. Authentication System

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

## 6. Feature Modules

### 6.1 Pricing Calculator

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

### 6.2 Material Inventory

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
- `DELETE /api/materials/:id` — removes a material

Quantity can be adjusted with ± buttons directly on the inventory list without opening the edit modal.

**Built-in categories:** Paper, Adhesive, Decoration, Paint, Cards, Packaging, Stationery  
**Custom categories:** Pro plan only

---

### 6.3 Saved Calculations (History)

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

### 6.4 Dashboard (User)

**Route:** `/dashboard`

The user dashboard provides:
- **Stats cards** — total calculations, total materials, total saved
- **3 most recent** saved calculations
- **Subscription expiry banner** — shown when paid plan expires within 7 days or has already expired

---

### 6.5 Subscription Management

**Route:** `/subscription`

Users can view their current plan and its features. They can initiate an upgrade by selecting a higher plan, which triggers the payment flow.

The subscription page also shows whether a **pending payment request** exists, blocking duplicate submissions.

**Subscription data** is fetched from `GET /api/subscriptions/me`, which enforces expiry in real time: if `expiry_date < NOW()` and the plan is not free, the backend returns `plan: 'free'` and `is_active: false`, automatically revoking paid access without requiring a scheduled job.

---

### 6.6 Payment System

Users pay for subscriptions manually via GCash or PayMaya. The flow is:

1. User selects a plan → sees a payment modal with QR code (fetched from `payment_qr_codes` table).
2. User scans QR in their e-wallet, completes payment, uploads a screenshot.
3. A `payment_requests` record is created with `status: 'pending'`.
4. Admin reviews the screenshot and approves or rejects.
5. On approval: subscription is updated, notification sent to user.
6. On rejection: notification sent with optional feedback reason.

**Rule:** A user may only have one pending/scanning request at a time.

---

### 6.7 Notifications

**Route:** Bell icon (all authenticated pages)

Notifications are stored in the `notifications` table and polled every 30 seconds by the `NotificationService`.

Notification triggers:
- Payment approved → user notified with plan name
- Payment rejected → user notified with optional reason

The bell icon shows a badge count for unread notifications. Clicking a notification marks it read.

---

### 6.8 Profile Management

**Route:** `/profile`

Users can:
- View their name, email, current plan, and member-since date
- Edit name and email (updates the `users` table and refreshes the JWT user cache)
- Change password (requires current password; hashed with bcrypt before storage)
- Reset password via emailed link if current password is unknown

---

### 6.9 Reports

**Route:** `/reports`  
**Access:** All authenticated users and admins

The Reports feature allows users to submit bug reports, problem reports, feedback, or any other issue directly to the admin team. Admins use a separate Reports management page (`/admin-reports`) to manage incoming reports and submit their own reports to the Superadmin.

**Report types:**
- **Bug** — something in the app is broken or behaving unexpectedly
- **Problem** — something is not working as expected
- **Feedback** — a suggestion, compliment, or general comment
- **Other** — anything that doesn't fit the above

**Report lifecycle:**

```
User submits report
       │
       ▼
   [Open] — awaiting admin review
       │
       ├── Admin views → [Seen]
       │         │
       │         ├── Admin replies → reply visible to user
       │         ├── Admin forwards → Superadmin also sees it
       │         └── Admin resolves → [Resolved]
       │
Admin submits own report (reporter_role = 'admin')
       │
       ▼
  Superadmin receives it in Admin Reports inbox
       │
       ├── Superadmin replies → reply visible to admin
       └── Superadmin resolves → [Resolved]
```

**Report statuses:**
- `open` — submitted, not yet seen
- `seen` — admin/superadmin has opened the report
- `resolved` — the issue has been addressed
- `closed` — the report has been closed

---

## 7. Admin Features

Admin accounts use the same `users` table but with `role = 'admin'`. Admins log in using the standard login page and are redirected to `/admin-dashboard`.

**Admins retain full access to all regular user features** (Calculator, Inventory, History, Profile, Subscription, Reports) in addition to the admin panel tools below.

### 7.1 Admin Dashboard

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

### 7.2 User Management

**Route:** `/admin-users`

Lists all `role = 'user'` accounts with their name, email, plan, status, and last seen timestamp.

**Admin actions:**
- **Suspend user** — sets `status = 'rejected'` in `users`. The user cannot log in.
- **Reactivate user** — sets `status = 'active'`.
- **View user** — side panel shows subscription details and payment history.

Admins can search by name/email and filter by account status.

---

### 7.3 Payment Approval

**Route:** `/admin-payments`

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

### 7.4 QR Code Management

**Route:** `/admin-qr`

Admins upload QR code images for GCash and PayMaya. These images are stored as URLs in the `payment_qr_codes` table and served to users in the payment modal.

Each method (gcash, maya) has one active QR code at a time. Admins can remove and replace at any time.

---

### 7.5 Admin Reports

**Route:** `/admin-reports`

Admins manage user-submitted reports and can submit their own reports to the Superadmin from this page.

**Tabs for regular admins:**
- **User Reports** — view all user-submitted reports; reply, forward to Superadmin, or mark as resolved
- **Submit to Superadmin** — submit a new report to the Superadmin

**Tabs for Superadmin:**
- **User Reports** — view all user-submitted reports (same as admin)
- **Admin Reports** — view admin-submitted reports and forwarded user reports; reply and resolve

**Forwarding:** Admins can forward any user report to the Superadmin. Once forwarded, the Superadmin can see it in their Admin Reports tab alongside admin-submitted reports.

---

## 8. Subscription Plans & Limits

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

## 9. Subscription Lifecycle

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

## 10. Email System

Crafty Rachel sends transactional emails via Nodemailer (SMTP).

### Email types

| Type             | Trigger                              | Content                                      |
|------------------|--------------------------------------|----------------------------------------------|
| OTP Verification | User completes signup form           | 6-digit code, valid 10 minutes               |
| Password Reset   | User requests forgot-password link   | Reset link, valid 24 hours                   |

All sent/failed emails are recorded in the `email_logs` table with `type`, `to_email`, `to_name`, `status` (`sent`/`failed`), `attempts`, and any error message.

**OTP rate limiting:** Max 3 OTP sends per email address per hour (tracked in `otp_attempts` table).

---

## 11. Data Models

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

### `reports`
| Column               | Type        | Description                                           |
|----------------------|-------------|-------------------------------------------------------|
| id                   | UUID (PK)   |                                                       |
| reporter_id          | TEXT (FK)   | User who submitted the report                         |
| reporter_role        | TEXT        | 'user' or 'admin' — role at time of submission        |
| type                 | TEXT        | 'bug', 'problem', 'feedback', or 'other'              |
| subject              | TEXT        | Short title                                           |
| description          | TEXT        | Full details                                          |
| status               | TEXT        | 'open', 'seen', 'resolved', or 'closed'               |
| is_forwarded         | BOOLEAN     | True when admin has forwarded a user report to superadmin |
| forwarded_by         | TEXT (FK)   | Admin who forwarded (nullable)                        |
| forwarded_at         | TIMESTAMPTZ | When it was forwarded (nullable)                      |
| admin_reply          | TEXT        | Admin's response to a user report                     |
| admin_reply_at       | TIMESTAMPTZ |                                                       |
| superadmin_reply     | TEXT        | Superadmin's response to an admin report              |
| superadmin_reply_at  | TIMESTAMPTZ |                                                       |
| resolved_by          | TEXT (FK)   | Who resolved the report (nullable)                    |
| resolved_at          | TIMESTAMPTZ |                                                       |
| created_at           | TIMESTAMPTZ |                                                       |
| updated_at           | TIMESTAMPTZ |                                                       |

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

## 12. API Endpoints

All API routes are prefixed with `/api`. Protected routes require a valid `Authorization: Bearer <token>` header.

### Auth (`/api/auth`)
| Method | Path                    | Auth     | Description                        |
|--------|-------------------------|----------|------------------------------------|
| POST   | /signup                 | Public   | Initiates OTP-based registration   |
| POST   | /verify-otp             | Public   | Verifies OTP and creates account   |
| POST   | /resend-otp             | Public   | Resends OTP (rate-limited)         |
| POST   | /login                  | Public   | Authenticates and returns JWT      |
| POST   | /logout                 | Auth     | Invalidates session token          |
| POST   | /forgot-password        | Public   | Sends password reset email         |
| GET    | /validate-token/:token  | Public   | Checks if reset token is valid     |
| POST   | /reset-password         | Public   | Resets password using token        |

### Users (`/api/users`)
| Method | Path          | Auth    | Description                       |
|--------|---------------|---------|-----------------------------------|
| GET    | /me           | Auth    | Current user's profile            |
| PUT    | /me           | Auth    | Update name/email                 |
| PUT    | /me/password  | Auth    | Change password                   |
| GET    | /             | Admin   | List all users                    |
| PUT    | /:id/status   | Admin   | Suspend or reactivate user        |
| PUT    | /:id/role     | Admin   | Change user role                  |
| DELETE | /:id          | Admin   | Delete user                       |

### Materials (`/api/materials`)
| Method | Path   | Auth  | Description              |
|--------|--------|-------|--------------------------|
| GET    | /      | Auth  | List user's materials    |
| POST   | /      | Auth  | Create material          |
| PUT    | /:id   | Auth  | Update material          |
| DELETE | /:id   | Auth  | Delete material          |

### Calculations (`/api/calculations`)
| Method | Path      | Auth  | Description                     |
|--------|-----------|-------|---------------------------------|
| GET    | /         | Auth  | List user's saved calculations  |
| GET    | /summary  | Auth  | Aggregated stats                |
| POST   | /         | Auth  | Save a calculation              |
| DELETE | /:id      | Auth  | Delete a saved calculation      |

### Subscriptions (`/api/subscriptions`)
| Method | Path      | Auth    | Description                                   |
|--------|-----------|---------|-----------------------------------------------|
| GET    | /plans    | Public  | List all subscription plans                   |
| GET    | /me       | Auth    | Current user's subscription (expiry enforced) |
| GET    | /         | Admin   | List all subscriptions                        |
| PUT    | /:userId  | Admin   | Upgrade/downgrade a user's plan               |

### Payments (`/api/payments`)
| Method | Path          | Auth    | Description                          |
|--------|---------------|---------|--------------------------------------|
| GET    | /qr           | Public  | Get GCash/Maya QR codes              |
| PUT    | /qr           | Admin   | Upload QR code                       |
| GET    | /             | Auth    | My payment requests                  |
| GET    | /all          | Admin   | All payment requests                 |
| POST   | /             | Auth    | Submit payment request               |
| PUT    | /:id/approve  | Admin   | Approve a payment                    |
| PUT    | /:id/reject   | Admin   | Reject a payment                     |

### Reports (`/api/reports`)
| Method | Path            | Auth        | Description                                              |
|--------|-----------------|-------------|----------------------------------------------------------|
| POST   | /               | Auth        | Submit a new report (user or admin)                      |
| GET    | /mine           | Auth        | Fetch own submitted reports                              |
| GET    | /user-reports   | Admin       | Fetch all user-submitted reports                         |
| GET    | /admin-reports  | SuperAdmin  | Fetch admin-submitted + forwarded user reports           |
| PUT    | /:id/seen       | Admin       | Mark a user report as seen                               |
| PUT    | /:id/reply      | Admin       | Reply to a report (admin → user; superadmin → admin)     |
| PUT    | /:id/forward    | Admin       | Forward a user report to the Superadmin                  |
| PUT    | /:id/resolve    | Admin       | Mark a report as resolved                                |
| DELETE | /:id            | SuperAdmin  | Delete any report permanently                            |

### Admin (`/api/admin`)
| Method | Path                  | Auth  | Description                          |
|--------|-----------------------|-------|--------------------------------------|
| GET    | /stats                | Admin | Platform-wide statistics             |
| GET    | /stats/revenue        | Admin | Monthly revenue chart data           |
| GET    | /logs/subscriptions   | Admin | Subscription action log              |
| GET    | /logs/system          | Admin | System event log                     |
| GET    | /logs/activity        | Admin | User activity log                    |
| DELETE | /logs/system          | Admin | Clear system logs                    |
| DELETE | /logs/activity        | Admin | Clear activity logs                  |

### Notifications (`/api/notifications`)
| Method | Path       | Auth  | Description                     |
|--------|------------|-------|---------------------------------|
| GET    | /          | Auth  | List user's notifications       |
| PUT    | /:id/read  | Auth  | Mark notification as read       |
| PUT    | /read-all  | Auth  | Mark all notifications as read  |

---

## 13. Security

### Authentication & Authorization
- All sensitive routes protected by `requireAuth` JWT middleware.
- Admin routes further protected by `requireAdmin` role check.
- Superadmin-only routes protected by `requireSuperAdmin`.
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
- Report type validated against `['bug', 'problem', 'feedback', 'other']` allowlist.

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

## 14. Database

### Connection
- PostgreSQL via the `pg` (node-postgres) library using a **connection pool**.
- Connection string loaded from `NEON_DATABASE_URL` environment secret.
- SSL mode enforced by the Neon connection string.

### Schema Migrations
- On every server start, `server/db/migrate.js` runs `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ADD COLUMN IF NOT EXISTS` statements to ensure the schema is up to date.
- Migrations are additive only — no destructive changes are performed automatically.

### Key Tables Summary
| Table                   | Purpose                                      |
|-------------------------|----------------------------------------------|
| `users`                 | All accounts (users and admins)              |
| `user_subscriptions`    | Active subscription per user                 |
| `subscription_plans`    | Plan definitions (seeded once)               |
| `materials`             | User's inventory items                       |
| `calculations`          | Saved pricing calculations                   |
| `payment_requests`      | Manual payment submissions                   |
| `payment_qr_codes`      | GCash/Maya QR code URLs                      |
| `reports`               | User and admin report submissions            |
| `subscription_logs`     | History of plan changes (approved/rejected)  |
| `system_logs`           | Admin-level system events                    |
| `activity_logs`         | User login/logout/signup with IP & location  |
| `notifications`         | In-app user notifications                    |
| `email_logs`            | OTP and reset email delivery records         |
| `email_otps`            | Pending OTP verification records             |
| `otp_attempts`          | OTP rate-limit tracking                      |
| `password_reset_tokens` | Forgot-password token storage                |

---

## 15. Deployment

Crafty Rachel is deployed on **Render** as a web service.

The start command is:
```
node server/index.js
```

The Angular frontend is pre-built (`ng build --configuration production`) and the resulting `dist/crafty-rachel/browser/` folder is served as static files by Express. All unknown paths return `index.html` to support Angular's client-side routing.

**Environment variables required:**
| Variable              | Purpose                             |
|-----------------------|-------------------------------------|
| `NEON_DATABASE_URL`   | PostgreSQL connection string        |
| `JWT_SECRET`          | Signs and verifies JWTs             |
| `SMTP_HOST`           | Email server hostname               |
| `SMTP_PORT`           | Email server port                   |
| `SMTP_USER`           | SMTP username                       |
| `SMTP_PASS`           | SMTP password                       |
| `SMTP_FROM`           | From address for outgoing emails    |

---

## 16. Glossary

| Term                     | Definition                                                                 |
|--------------------------|----------------------------------------------------------------------------|
| **OTP**                  | One-Time Password — a 6-digit code sent by email to verify a new account. |
| **JWT**                  | JSON Web Token — a signed token used to authenticate API requests.         |
| **Markup**               | The percentage added on top of total cost to determine the selling price.  |
| **Waste %**              | The percentage of a material wasted during production. Applied per material to increase effective cost. |
| **Batch**                | A single production run that produces a set quantity of a product.         |
| **Plan**                 | Subscription tier: Free, Basic, or Pro. Determines feature limits.         |
| **Expiry**               | The date when a paid subscription ends. After this date the plan reverts to Free. |
| **is_active**            | A database flag indicating whether the subscription is currently valid.    |
| **BehaviorSubject**      | An RxJS object in Angular that holds the current value and emits updates to all subscribers. |
| **Session Token**        | A UUID stored per user in the database. Included in the JWT; invalidates previous sessions on new login. |
| **Heartbeat**            | A periodic request (every 2 minutes) the frontend sends to keep the session alive. |
| **QR Code**              | A scannable image linked to a GCash or PayMaya account, used for payment. |
| **Payment Request**      | A record created when a user submits proof of payment. Reviewed by an admin. |
| **Report**               | A user or admin submission describing a bug, problem, feedback, or other issue. |
| **Forward (report)**     | An admin action that escalates a user report to the Superadmin's inbox.    |
| **Activity Log**         | A server-side record of login, logout, and signup events with IP and location. |
| **System Log**           | A record of admin-level events: approvals, rejections, and errors.         |
| **Email Log**            | A record of every OTP and password reset email sent or failed.             |
| **bcrypt**               | A password-hashing algorithm. Crafty Rachel uses 12 salt rounds.           |
| **Neon**                 | Serverless PostgreSQL hosting provider used for the production database.   |
| **Render**               | Cloud hosting platform used to deploy the Crafty Rachel web service.       |
| **CORS**                 | Cross-Origin Resource Sharing — HTTP mechanism controlling which origins access the API. |
| **Helmet**               | Express middleware that sets HTTP security headers.                         |
| **Standalone component** | An Angular 19 component that declares its own imports without an NgModule. |
| **SMTP**                 | Simple Mail Transfer Protocol — the email delivery standard used by Nodemailer. |
