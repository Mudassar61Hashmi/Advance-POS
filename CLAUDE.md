# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack Point of Sale (POS) system. The Express server serves the React client as static files in production and via Vite middleware in development — both client and API run on the same port (default 3000).

## Commands

### Server (D:\POS\server)
```bash
node index.js              # Run server (production or dev)
nodemon index.js           # Run with auto-reload (dev)
```

### Client (D:\POS\client)
```bash
npm run dev      # Vite dev server (standalone, proxies /api to port 5000)
npm run build    # TypeScript check + Vite build to ../dist
npm run lint     # ESLint
npm run preview  # Preview production build
```

> In development, run `node server/index.js` — it loads Vite as middleware and serves the SPA + API together. The `client/vite.config.ts` proxy (`/api → localhost:5000`) is only used when running the Vite dev server standalone.

## Architecture

### Request Flow
```
Browser → Express (index.js)
  ├── /api/* → Route handlers → Mongoose → MongoDB
  └── /* → Vite middleware (dev) OR static dist/ (prod)
```

### Server (`server/`)
- **`index.js`** — Entry point: connects MongoDB, registers all routes at `/api`, conditionally loads Vite or serves `../dist`
- **`config/db.js`** — MongoDB connection; uses `MONGODB_URI` env var, falls back to `mongodb://localhost:27017/propos`
- **`config/.env`** — `MONGODB_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, `APP_URL` — **this file lives inside `config/`, not at server root**
- **`middleware/authMiddleware.js`** — `requireAuth` (JWT verification) and `requireRole(...roles)` guards; token expected in `Authorization: Bearer <token>`
- **`models/`** — Mongoose schemas; `Sale.js` auto-generates invoice numbers (`INV-#####`) via pre-save hook
- **`routes/`** — One file per domain: `auth`, `products`, `sales`, `payments`, `orders`, `customers`, `taxes`, `rolePermissions`

### Client (`client/src/`)
- **`App.tsx`** — Auth gate (reads `pos_user` from localStorage) + tab-based navigation state; no React Router
- **`layouts/DashboardLayout.tsx`** — Shell with role-filtered sidebar nav, theme toggle, notification bell, quick stats
- **`pages/`** — 11 page components; each page owns its own data fetching via `fetch('/api/...')`
- **`theme.tsx`** — `ThemeContext` with light/dark/system modes and multiple color presets; wraps entire app via `main.tsx`
- **`types.ts`** — Shared TypeScript interfaces for all domain entities (Product, Sale, Customer, etc.)

## Key Conventions

### Authentication
- JWT stored in `localStorage` under key `pos_user` as `{ token, user: { id, username, role, ... } }`
- Roles (in ascending privilege): `cashier → manager → admin → superadmin`
- Include `Authorization: Bearer <token>` header on all protected API requests

### Data Models
- `Product` has a unique `barcode` field and references `Tax` documents by ID
- `Sale` references `Customer`, `Product` items, and records payment method inline; supports `refunded` flag
- `Payment` and `PaymentMethod` are separate — methods are configurable (cash/card/mobile wallet) with processing fees

### Frontend Patterns
- State is managed with React hooks + Context; no Redux or Zustand
- Pages fetch data directly with `fetch` (no axios, no query library); token pulled from `localStorage`
- Theme classes (e.g., `bg-surface`, `text-primary`) come from the custom theme system, not raw Tailwind colors
- `framer-motion` used for page/modal transitions throughout

### ES Modules
The server uses `"type": "module"` — all imports must use ESM syntax and explicit `.js` extensions for local files.
