# NYSC Orientation Camp Kit Collection & Document Verification System

> **A real-time, decentralized document verification and orientation kit disbursement platform built to eliminate registration queues, cross-platoon congestion, and manual paper processing in National Youth Service Corps (NYSC) orientation camps.**

[![Next.js](https://img.shields.io/badge/Next.js-16.4.6-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0.0-blue?style=flat&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-Neon%20PostgreSQL-336791?style=flat&logo=postgresql)](https://neon.tech/)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)

---

## 1. Executive Summary & Problem Solved

Every year across 37 NYSC Orientation Camps in Nigeria, thousands of newly deployed Corps Members arrive on Day 1 and are subjected to exhaustive, hours-long queues under harsh weather to get their physical documents inspected, stamped, and approved before receiving their orientation kit (khakis, jungle boots, white vests, crests, and belts).

### The Critical Bottlenecks of Manual Camp Registration:
1. **Severe Physical Congestion:** Thousands of prospective corps members crowding inspection tents simultaneously.
2. **Document Wear & Loss:** Fragile school statement of results, green cards, and call-up letters getting torn, stained, or misplaced in crowded queues.
3. **Cross-Platoon Confusion & Inefficiencies:** Corps members queuing at incorrect platoon desks, wasting hours before being redirected.
4. **Logistics & Inventory Vulnerabilities:** Risk of duplicate kit collections or untracked kit disbursements due to manual paper tallying.
5. **Slow Manual Approvals:** Platoon inspectors manually reviewing up to 12 distinct document credentials per corps member with paper checklists.

### The Solution:
The **NYSC Kit Collection System** digitizes the entire onboarding lifecycle. Prospective corps members securely upload or photograph their credentials from their smartphones. Platoon Inspectors utilize an isolated Command Desk equipped with an **in-app live camera QR scanner** to verify identities, inspect high-resolution A4 dossiers, execute 1-click approvals with optimistic feedback, and officially disburse kits with zero physical paperwork.

---

## 2. Core User Roles & Capabilities

The system implements strict Role-Based Access Control (RBAC) across four primary user categories:

###  1. Corps Member Portal (`/`)
* **Passwordless OTP Authentication:** Log in securely using State Code (e.g., `LA/26C/18388`) and email verification OTP.
* **Smart Document Management:** Supports all mandatory camp documents:
  * Passport Photograph
  * Signed Call-Up Letter
  * Signed Green Card
  * Letter of Undertaking
  * School Certificate / Statement of Result (Degree / HND)
  * Medical Fitness Certificate
  * Signed Addendum
  * Signed Certificate Format
  * NERD Document
  * National Identity Number (NIN) Slip
  * Bank Account Opening Slip
  * Minuted Exeat Slip (if applied)
* **Mobile Photo Capture & A4 Normalizer:** Directly capture photos via camera or file upload, automatically standardized to official A4 PDF formats.
* **Digital Clearance Pass:** Upon submission, the portal generates a tamper-resistant digital pass featuring an encrypted QR code and a 4-digit backup PIN for kit collection.

###  2. Platoon Inspector Command Desk (`/inspector`)
* **Strict Platoon Isolation:** Platoon Inspectors (Platoons 1 through 10) only access and disburse kits to corps members assigned to their specific platoon.
* **In-App Live Camera QR Scanner:** Real-time camera viewfinder using computer vision (`jsQR`) to scan the corps member's digital pass without third-party scanning apps.
* **Cross-Platoon Fraud Shield:** If a corps member attempts to scan at the wrong platoon desk, the system triggers a bright red **Cross-Platoon Warning Banner**, blocking handover and directing them to their correct inspector.
* **High-Res Document Dossier Modal:** Comprehensive side-by-side preview of all uploaded documents with 1-click zoom, full-screen viewing, and A4 PDF downloads.
* **Ultra-Responsive Optimistic Approvals:** 1-click document approval with instant tactile feedback (`active:scale-95`) and immediate UI status flipping (`✓ Ready`) without network lag.
* **Request Re-upload Workflow:** Allows inspectors to request clearer scans for rejected documents without resetting the entire registration.

###  3. Camp Secretariat Authorization Desk (`/secretariat`)
* **Exeat Governance:** Centralized queue for reviewing and approving camp exeat requests (medical, compassionate, or official travel).
* **Document Cross-Verification:** Access to corps members' medical fitness slips and submitted exeat forms before authorizing camp exit.
* **Audit Trail Integration:** Every exeat delivery or rejection records officer name, timestamp, and departure notes.

###  4. Camp Directorate & Administrator (`/admin`)
* **Camp-Wide Real-Time KPIs:** Live metrics tracking Total Corps Members, Ready for Kit, Incomplete Submissions, and Disbursed Kits.
* **Nominal Roll Management:** Add, edit, search, and assign corps members to platoons and courses of study.
* **Inspector Account Configuration:** Configure and toggle official inspector and secretariat email accounts with active state toggles.
* **Document Purge Safeguard:** Dedicated "Clear All Uploaded Docs" action with custom system confirmations that resets document records while **strictly preserving** nominal roll accounts and emails.
* **Tamper-Evident Audit Logs:** Live chronological event log recording all logins, OTP dispatches, kit handovers, and blocked cross-platoon attempts.

---

## 3. Technology Stack & Architectural Decisions

| Layer | Technology | Justification |
| :--- | :--- | :--- |
| **Framework** | **Next.js 16 (App Router)** | Modern server-side rendering (SSR), dynamic API routes, optimized bundle splitting, and zero-config deployment. |
| **Language** | **TypeScript 5** | Strict type safety across document schemas, database records, and authentication payloads. |
| **Frontend** | **React 19 & Tailwind CSS** | Ultra-fast declarative components, military dark-mode aesthetic (`#0c1a13`, `#008751`), and optimistic UI updates. |
| **Database** | **Neon PostgreSQL** | Serverless PostgreSQL with connection pooling (`@neondatabase/serverless`), providing instant elasticity and zero data loss across sleeps. |
| **QR Scanning** | **jsQR** | Pure client-side canvas computer vision. Decodes QR codes directly from `<video>` streams in browser with zero external app dependencies. |
| **PDF Generation** | **jsPDF** | Client-side generation of standardized A4 document PDFs and printable clearance passes. |
| **Email Dispatch** | **Resend API + Nodemailer** | Dual-channel email dispatch: HTTPS API via Resend (unblockable on cloud hosts) + fallback SMTP + emergency on-screen rescue OTPs. |
| **Icons & Alerts** | **Lucide React + Custom Modals** | Consistent iconography and in-system modal dialogs (`ConfirmModal`, `SystemToast`) replacing native browser popups. |

---

## 4. Security & Reliability Architecture

```
                    ┌─────────────────────────┐
                    │  Prospective Corper     │
                    │  (State Code + OTP)     │
                    └───────────┬─────────────┘
                                │ Uploads Credentials
                                ▼
                    ┌─────────────────────────┐
                    │   Neon PostgreSQL DB    │
                    │ (Submissions & Roll)    │
                    └───────────┬─────────────┘
                                │ Generates QR Pass
                                ▼
                    ┌─────────────────────────┐
                    │ In-App Camera Scanner   │
                    │ (Platoon Inspector)     │
                    └───────────┬─────────────┘
                                │
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
[Same Platoon Match]                          [Wrong Platoon Mismatch]
• Corper Dossier Opened                       • CROSS-PLATOON ALERT
• 1-Click Document Approval                   • Handover Blocked
• Official Kit Disbursed                      • Security Audit Logged
```

1. **Platoon Isolation Matrix:** Inspectors are cryptographically and logically restricted to their platoon number. Cross-platoon dispatch attempts fail immediately at both API and UI levels.
2. **Dual-Channel Cloud Email Dispatch:**
   * **Primary:** Resend HTTP API over HTTPS (Port 443), preventing cloud container firewall timeouts on Render.
   * **Secondary:** TLS/SSL SMTP dual-port retry (Ports 465 and 587).
   * **Tertiary (Rescue Fallback):** If outbound mail ports are blocked by host firewalls, the server returns an emergency security code with an on-screen **"Autofill & Verify"** button, ensuring no user is stranded.
3. **Cryptographic Anti-Brute-Force Lockout:** IP-based and email-based tracking that locks accounts for 2 hours after 5 consecutive failed attempts.
4. **Single-Use Verification Tokens:** Clearance QR codes and 4-digit PINs expire once kit handover is officially marked as disbursed.

---

## 5. Environment Variables Configuration

Create a `.env` file in the root directory:

```env
# Database (Neon Serverless PostgreSQL)
DATABASE_URL=postgresql://neondb_owner:<password>@<neon-host>-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require

# Node Environment
NODE_ENV=production
PORT=3000

# Administrator Credentials
ADMIN_EMAIL=camp.director@nysc.gov.ng
ADMIN_NAME="Camp Director / Commandant"

# Email Dispatch (Option A: Resend HTTP API - Recommended for Render)
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM="NYSC Camp Verification <onboarding@resend.dev>"

# Email Dispatch (Option B: SMTP / Gmail App Password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_specific_password
SMTP_FROM="NYSC Camp Verification <portal@nysc.gov.ng>"
```

---

## 6. Installation & Local Development

### Prerequisites:
* Node.js 22.x or later
* npm or yarn

```bash
# 1. Clone the repository
git clone https://github.com/CeleHub/NYSC-Kit-Collection.git
cd NYSC-Kit-Collection

# 2. Install dependencies
npm install

# 3. Initialize local environment
cp .env.example .env
# Edit .env with your DATABASE_URL

# 4. Start development server
npm run dev
```

Visit `http://localhost:3000` to test the Corper portal, `http://localhost:3000/inspector` for Platoon Inspectors, and `http://localhost:3000/admin` for the Camp Directorate.

---

## 7. Production Deployment (Render + Neon)

1. **Database:** Create a free PostgreSQL instance on [Neon](https://neon.tech) and copy the pooled connection string to `DATABASE_URL`.
2. **Web Service (Render):**
   * **Build Command:** `npm run build`
   * **Start Command:** `npm run start`
   * **Node Version:** `22.12.0`
3. **Environment Variables on Render:**
   * Set `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_NAME`.
   * Add `RESEND_API_KEY` for instant email delivery over HTTPS.
4. **Deploy:** Push to GitHub/Render repository branch.

---

## 8. Author & Attribution

* **Software Developer / Engineer:** **Celestine Okonkwo** (Representing Platoon 8, SAED ICT Competition)
* **Portfolio Website:** [https://celestineokonkwo.me/](https://celestineokonkwo.me/)
* **GitHub Repository:** [https://github.com/CeleHub/NYSC-Kit-Collection.git](https://github.com/CeleHub/NYSC-Kit-Collection.git)
* **Live Deployment:** [https://nysc-kit-collection.onrender.com](https://nysc-kit-collection.onrender.com)

Designed and developed for the **National Youth Service Corps (NYSC) Directorate Headquarters**, Orientation Camp Technical Taskforce (SAED ICT Competition).

*Service and Humility.*
