# 🔮 Obscural

**Smart Invoice & Payment Platform on Rialo Protocol**

Obscural is a hybrid Web3 invoicing platform that combines traditional commercial invoicing (itemized billing, PDF export, contact management) with on-chain settlement via smart contracts on Rialo / Sepolia.

---

## ✨ Features

- **Smart Invoicing** — Create, send, and track invoices with multi-currency support (USD, ETH, USDC, DAI)
- **PDF Export** — Generate branded PDF invoices with QR payment codes
- **Contact Management** — Full CRUD contacts with profile editing, avatar support, and backend sync
- **Real-Time Analytics** — Revenue charts, settlement rates, and cash flow telemetry powered by Chart.js
- **AI Copilot** — Natural language invoice creation, financial analysis, and bill splitting via multi-agent system
- **Autopilot Trust Matrix** — AI-evaluated counterparty trust scoring with auto-pay policies
- **Escrow Vault** — Trustless funds custody governed by `EscrowVault.sol` smart contract
- **Bill Splitter** — Automated multi-party payment distribution via `BillSplitter.sol`
- **Notifications** — Real-time alerts for overdue invoices, upcoming due dates, and settled payments (backend-synced)
- **Profile Sync** — User profiles synced between local storage and Supabase backend
- **Mobile Responsive** — Bottom tab navigation for mobile viewports with glassmorphism design
- **Error Recovery** — React Error Boundary with styled fallback UI
- **PWA Ready** — Installable as a Progressive Web App with offline support
- **Security** — Rate limiting, security headers, input sanitization, graceful shutdown

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Frontend (Vite + React 19)         │
│  Landing · Dashboard · Invoices · Contacts           │
│  Analytics · Autopilot · Settings · AI Chat          │
├──────────────────────────────────────────────────────┤
│                    Backend (Express.js)               │
│  REST API · AI Agents · Autopilot Engine             │
│  Security Middleware (rate limit, sanitize, headers)  │
├──────────────────────────────────────────────────────┤
│               Smart Contracts (Foundry / Solidity)   │
│  InvoiceFactory · EscrowVault · BillSplitter         │
├──────────────────────────────────────────────────────┤
│               Infrastructure                         │
│  Supabase (DB) · Privy (Auth) · Rialo/Sepolia (L1)  │
└──────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, React Router 7, Zustand, Chart.js |
| Styling | Vanilla CSS with design tokens, Google Fonts (Inter, JetBrains Mono, Plus Jakarta Sans) |
| Auth | Privy (Google + Wallet login) |
| Backend | Express.js 5, Node.js |
| Database | Supabase (PostgreSQL) |
| AI | Google Gemini API (multi-agent system) |
| Blockchain | Solidity 0.8.24, Foundry, ethers.js v6 |
| PDF | jsPDF |
| QR | qrcode.react |
| PWA | Service Worker + Web App Manifest |

---

## 📁 Project Structure

```
obscural/
├── contracts/              # Solidity smart contracts (Foundry)
│   ├── src/
│   │   ├── InvoiceFactory.sol
│   │   ├── EscrowVault.sol
│   │   └── BillSplitter.sol
│   ├── test/               # Foundry tests
│   └── script/             # Deploy scripts
├── server/                 # Express.js backend
│   └── src/
│       ├── agents/         # AI agent system (router, creator, reminder, analyst, splitter, autopilot)
│       ├── config/         # Environment config
│       ├── db/             # Database schema (Supabase SQL)
│       ├── middleware/     # Security middleware (rate limit, sanitize, headers)
│       ├── routes/         # REST API routes
│       │   ├── ai.js           # AI chat endpoints
│       │   ├── autopilot.js    # Trust matrix & auto-pay scan
│       │   ├── invoices.js     # Invoice CRUD
│       │   ├── contacts.js     # Contact management + bulk sync
│       │   ├── notifications.js # Notification management
│       │   ├── profiles.js     # User profile upsert
│       │   └── export.js       # CSV/PDF export
│       ├── services/       # Supabase, AI (Gemini) services
│       └── index.js        # Server entry point
├── src/                    # React frontend
│   ├── components/
│   │   ├── ai/             # AI Chat panel
│   │   ├── common/         # ErrorBoundary, Toast, Spinner, ImmersiveBackground
│   │   └── layout/         # Layout, Sidebar, MobileNav
│   ├── hooks/              # Custom hooks (useWallet, useContract)
│   ├── pages/              # Page components (10 pages including 404)
│   ├── services/           # API client (7 API namespaces)
│   ├── store/              # Zustand auth store
│   ├── styles/             # CSS per component (12 files)
│   └── utils/              # Constants, contract addresses, token config
├── public/                 # Static assets, PWA manifest, service worker
├── .env.example            # Environment variables template
├── .env                    # Environment variables (not committed)
├── index.html              # Entry HTML
├── package.json
└── vite.config.js
```

---

## 🔌 API Endpoints

### AI
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/chat` | Send message to AI assistant |
| GET | `/api/ai/policies` | Get agent policies |
| GET | `/api/ai/health` | AI system health |

### Invoices
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/invoices` | List invoices (filter by userId, status) |
| GET | `/api/invoices/:id` | Get single invoice |
| POST | `/api/invoices` | Create invoice |
| PATCH | `/api/invoices/:id` | Update invoice |
| DELETE | `/api/invoices/:id` | Delete draft invoice |
| POST | `/api/invoices/:id/remind` | Send payment reminder |

### Contacts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/contacts` | List contacts for user |
| GET | `/api/contacts/:id` | Get single contact |
| POST | `/api/contacts` | Create contact |
| PATCH | `/api/contacts/:id` | Update contact |
| DELETE | `/api/contacts/:id` | Delete contact |
| POST | `/api/contacts/sync` | Bulk sync from client |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | List notifications |
| GET | `/api/notifications/count` | Unread count |
| POST | `/api/notifications` | Create notification |
| PATCH | `/api/notifications/:id/read` | Mark as read |
| PATCH | `/api/notifications/read-all` | Mark all as read |
| DELETE | `/api/notifications/:id` | Delete notification |

### Profiles
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/profiles/:userId` | Get user profile |
| PUT | `/api/profiles/:userId` | Upsert user profile |

### Autopilot
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/autopilot/trust` | Get trust profiles |
| PUT | `/api/autopilot/override` | Set trust override |
| DELETE | `/api/autopilot/override` | Remove trust override |
| POST | `/api/autopilot/scan` | Run autopilot scan |
| GET | `/api/autopilot/activity` | Get activity log |
| GET | `/api/autopilot/latch-status` | OnLatch connection status |

### Export
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/export/csv` | Export invoices as CSV |
| GET | `/api/export/transactions/csv` | Export transactions as CSV |
| GET | `/api/export/pdf/:id` | Get invoice data for PDF |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server health check |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- **Foundry** (for smart contract development) — [Install Guide](https://book.getfoundry.sh/getting-started/installation)

### 1. Clone & Install

```bash
git clone https://github.com/AiArcOrg/Obscural.git
cd Obscural
npm install
cd server && npm install && cd ..
```

### 2. Environment Variables

```bash
cp .env.example .env
# Edit .env with your actual keys
```

### 3. Database Setup

Run the SQL migration in your Supabase dashboard:

```bash
# Copy contents of server/src/db/schema.sql into the Supabase SQL Editor
```

This creates 7 tables: `profiles`, `invoices`, `contacts`, `notifications`, `trust_overrides`, `agent_logs`, `transactions`.

### 4. Run Development

```bash
# Frontend (Vite dev server)
npm run dev

# Backend (Express server — separate terminal)
npm run dev:server

# Or run both simultaneously
npm run dev:all
```

### 5. Smart Contracts

```bash
cd contracts

# Build
forge build

# Test
forge test

# Deploy to Sepolia
forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast
```

---

## 📜 Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server (port 5173) |
| `npm run dev:server` | Start Express backend with watch mode (port 3001) |
| `npm run dev:all` | Start frontend + backend concurrently |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run Oxlint |

---

## 🔒 Security

- **Rate Limiting** — 120 req/min (general), 20 req/min (AI), 40 req/min (Autopilot), 30 req/min (Export)
- **Security Headers** — X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy
- **Input Sanitization** — HTML tag stripping on all incoming request bodies
- **Body Size Guard** — 1MB max request body
- **Auto-Logout** — 7 days inactivity timeout on frontend
- **Graceful Shutdown** — SIGTERM/SIGINT handlers for clean server shutdown

---

## 📄 License

MIT © 2026 Rialo / AiArc
