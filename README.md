# CampusConnect (University Student Chat Platform)

> **"Your Campus. Your People."**

A complete, production-oriented web platform where university students can meet, discover, and chat 1-on-1 with verified peers across campuses. Initially targeted at **Lovely Professional University (LPU)** and engineered to support universities across India.

---

## 🌟 Features & System Overview

1. **Strict 18+ Age Verification**:
   - Server-side birth date calculation and rejection of underage sign-ups.

2. **University Verification Workflow**:
   - Automatic domain verification for official campus emails (e.g. `@lpu.in`, `@du.ac.in`).
   - Alternative manual review workflow for student ID card upload proofs.
   - Verified student badge indicator across chat and discovery.

3. **Atomic Concurrency-Controlled Matchmaking**:
   - Target university filter (own university, specific partner campus, or any).
   - Partner gender preference (Boys, Girls, Everyone) with mutual compatibility enforcement.
   - Concurrency lock preventing double-matching or race conditions.
   - Anti-self-matching and mutual block-list filtering.
   - 60-second queue timeout with graceful fallback.

4. **Persistent Real-Time 1-on-1 Chat**:
   - Real-time messaging powered by Server-Sent Events (SSE) and persistent database storage.
   - Message length enforcement (1,000 chars) and XSS sanitization.
   - Rate limiting (anti-spam protection).
   - In-chat immediate **Block User**, **Report User**, and **End Conversation** controls.

5. **Razorpay Payment Integration & Auditable Credit Ledger**:
   - Configurable credit packages:
     - 1 Credit: ₹9
     - 5 Credits: ₹29 (Campus Explorer)
     - 10 Credits: ₹49 (Super Connector)
   - Cryptographic HMAC-SHA256 signature verification on server.
   - Built-in test sandbox mode for testing payment flows when Razorpay keys are not yet configured.
   - **Atomic credit deduction**: Exactly 1 credit is deducted when an eligible match is established.
   - **Zero-charge guarantee**: No credits consumed if matchmaking is cancelled or no match is found.
   - **Auditable Credit Ledger**: Immutable ledger recording all additions, deductions, and refunds with timestamps and reference IDs.

6. **Searchable Student Discovery (Browse)**:
   - Filter by university, gender, course, and interests.
   - Privacy controls: Students can toggle discovery visibility or online presence anytime.
   - Start direct chats with credit deduction.

7. **Secure Admin Operations Console**:
   - Server-enforced role access (`ADMIN` and `MODERATOR`).
   - Executive metrics: Registered students, verified count, active conversations, revenue in INR.
   - University management: Add campuses, set approved email domains, activate/deactivate.
   - Verification queue: Review student ID proofs and approve/reject with feedback.
   - Moderation queue: Review abuse reports, suspend or reinstate accounts.
   - Pricing package management.
   - Complete administrative audit trail.

---

## 🛠️ Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS (Dark Navy `#070A13`, Electric Blue `#0EA5E9`, Purple `#8B5CF6`)
- **Database & ORM**: PostgreSQL / SQLite with Prisma ORM
- **Authentication**: JWT session tokens via `jose`, bcrypt password hashing, HTTP-only secure cookies
- **Real-Time Communication**: Server-Sent Events (SSE) stream + PubSub event bus
- **Payments**: Razorpay Gateway (Test Mode / Live Mode)
- **Validation**: Zod Schemas

---

## 🚀 Quick Start & Installation

### 1. Prerequisites
- Node.js 18.17+ or 20+
- npm, pnpm, or yarn

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Default local `.env.local`:
```env
NEXT_PUBLIC_APP_NAME="CampusConnect"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_TAGLINE="Your Campus. Your People."

DATABASE_URL="file:./dev.db"
JWT_SECRET="campusconnect-dev-super-secure-jwt-secret-key-32-chars-long"

# Razorpay Test Mode Keys (Optional for Sandbox Testing)
RAZORPAY_KEY_ID=""
RAZORPAY_KEY_SECRET=""
RAZORPAY_WEBHOOK_SECRET=""

# Enables testing credit purchases without real money when Razorpay keys are absent
ENABLE_SANDBOX_PAYMENTS="true"

ADMIN_INITIAL_EMAIL="admin@campusconnect.edu"
ADMIN_INITIAL_PASSWORD="AdminSecurePassword123!"
```

### 4. Run Automated Test Suite
To verify the 16 critical business workflows, age verification, matching engine, and payment ledgers:
```bash
npm test
```

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing the Complete End-to-End User Journey

You can test the entire student experience locally in under 3 minutes:

### Journey A: Immediate Login with Pre-Seeded Accounts
1. Open [http://localhost:3000/login](http://localhost:3000/login).
2. Click **"👤 Aarav (LPU B.Tech, 5 Credits)"** to autofill credentials (`aarav.sharma@lpu.in` / `StudentPass123!`).
3. Click **Sign In**.
4. You arrive at the **Student Dashboard**:
   - Notice the **Verified Student** badge and **5 Credits Available**.
   - Review your online status and active conversations.
5. Click **"Find a Match"** (`/match`):
   - Choose your partner preference (e.g. Girls, Boys, or Everyone).
   - Click **"Start Match Search"**.
   - Notice the atomic matchmaking radar scanner. If another compatible student is waiting, you are paired instantly and redirected to `/chat/[conversationId]`.
6. Open an incognito browser window:
   - Login as **"👤 Priya (LPU MBA, 8 Credits)"** (`priya.patel@lpu.in` / `StudentPass123!`).
   - Join the matchmaking room to trigger an instant mutual match with Aarav!
   - Send real-time messages in the chat window without refreshing.

### Journey B: Custom UPI QR Code Payment & Manual Verification
1. Navigate to **Pricing** (`/pricing`).
2. Select any package (e.g. **Campus Explorer - 5 Credits for ₹29**).
3. The **UPI QR Payment Gate** modal opens displaying the admin's uploaded PhonePe QR code (`public/uploads/payment/custom_qr.png`) and receiver name (**KRISH SO ANIL KUMAR**).
4. Scan the QR code using any UPI app (PhonePe, Google Pay, Paytm, BHIM) and pay the exact amount.
5. Enter the **12-digit UTR / UPI Transaction Reference Number** and optionally attach a payment receipt screenshot.
6. Click **"Submit Payment for Verification"**:
   - The order transitions to `PENDING_VERIFICATION` ("Awaiting payment verification") with **0 credits** granted until verified.
7. Once the administrator verifies and approves the UTR in `/admin`, credits are added atomically to the student's ledger and the modal automatically transitions to the verified screen!

### Journey C: Testing the Admin Console & QR Settings
1. Log in at [http://localhost:3000/login](http://localhost:3000/login) using the **Super Admin** credentials (`admin@campusconnect.edu` / `AdminSecurePassword123!`).
2. Navigate to [http://localhost:3000/admin](http://localhost:3000/admin):
   - Switch to **Payment Settings & QR** to upload or replace your UPI QR code image, update the payment receiver name, edit student instructions, or enable/disable payments.
   - Switch to **Orders & Verification** to inspect submitted UTR numbers, preview receipt screenshots, and click **Approve** or **Reject**.
   - Switch to **Verifications** to approve/reject student ID cards.
   - Switch to **Universities** to add new colleges or update approved email domains.
   - Switch to **Moderation** to view abuse reports and suspend accounts.
   - Switch to **Audit Logs** to view timestamps of administrative operations.


---

## 🔒 Security & Privacy Architecture

- **No Plaintext Passwords**: Passwords hashed with 10 salt rounds via bcrypt.
- **Strict IDOR Protection**: Chat routes verify participant membership on every request. Conversations cannot be read by guessing IDs.
- **Rate Limiting**: Chat messages are rate-limited to 400ms per message to mitigate automated script spam.
- **XSS Sanitization**: Message bodies strip HTML tags and restrict length to 1,000 characters.
- **Immutable Credit Ledger**: Credit additions, deductions, and refunds cannot overwrite prior transaction history.
- **Privacy First**: Sensitive student ID upload documents are stored securely and never accessible by other students.

---

## 🌐 External Integrations & Setup Required for Production

Before taking CampusConnect live to production, obtain and populate the following production credentials in your hosting environment (e.g. Vercel / Supabase):

1. **PostgreSQL Database**:
   - Set `DATABASE_URL="postgresql://user:password@host:port/campusconnect?sslmode=require"`
   - Run `npx prisma migrate deploy`
2. **Razorpay Live Gateway**:
   - Obtain live keys from [Razorpay Dashboard](https://dashboard.razorpay.com/app/keys).
   - Set `RAZORPAY_KEY_ID="rzp_live_..."`
   - Set `RAZORPAY_KEY_SECRET="..."`
   - Set `RAZORPAY_WEBHOOK_SECRET="..."`
   - Point your Razorpay Webhook URL to `https://your-domain.com/api/payments/webhook` for events: `payment.captured`, `order.paid`.
   - Set `ENABLE_SANDBOX_PAYMENTS="false"`.
3. **Session Secrets**:
   - Generate a 32+ character random secret for `JWT_SECRET`.
4. **Legal Review**:
   - Perform legal review of Terms of Service and Privacy Policy against the Digital Personal Data Protection Act (DPDPA), 2023 and Consumer Protection (E-Commerce) Rules, 2020.
