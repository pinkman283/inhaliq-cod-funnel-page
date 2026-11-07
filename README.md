# High-Converting Single-Page COD E-Commerce Funnel (Next.js 16 + Laravel Headless API)

A production-grade, single-page Cash on Delivery (COD) sales funnel built with **Next.js (App Router)**, **TypeScript**, and **Tailwind CSS**, designed specifically for the Bangladesh market and integrated directly with an external **Laravel Headless E-Commerce API (v1)**.

---

## 🌟 Architecture & Key Features

### 1. Centralized Laravel API Client (`lib/laravel-api.ts`)
- **Direct Backend Integration:** Operates server-side to fetch products, shipping charges, and store settings, and submits orders and leads directly to Laravel `/api/v1`.
- **Zero Hardcoded Products:** Displays products returned by the backend API.
- **Variant Management:**
  - Products without variants: Direct selection with `color_id: null` and `size_id: null`.
  - Products with variants: Mandatory selection of colors/editions and sizes/packs before checkout, passing exact numerical variant IDs.
- **Real Order Creation:** Orders are created via `/checkout/order-save` and appear instantly in the senior developer's Laravel Admin Panel. Zero simulated or fake fallback invoices.
- **Abandoned Cart CRM:** Silently captures leads via `/checkout/lead` upon phone number blur.

### 2. Strict Meta Ad Policy Compliance & Zero Domain Leaks
- **Server-Side Keyword Scrubbing (`lib/sanitize.ts`):** Automatically sanitizes restricted terms before rendering.
- **Image Binary Streaming Proxy (`app/api/image-proxy`):** Streams all product images server-to-server, preventing Facebook crawlers from seeing the backend store domain.
- **Private API Credentials:** `LARAVEL_API_KEY` and backend endpoints remain strictly on the server.

### 3. Professional UI/UX & Design System
- **Balanced 2-Column Desktop Layout:** Left column contains model snapshot, variant selectors, and customer details; right column features a sticky order summary and prominent COD confirmation CTA.
- **Integrated Sliding Theme Toggle:** Accessible pill switch with smooth spring-animated thumb, Sun/Moon icons, and theme persistence (Default: Light mode).
- **Responsive Mobile Layout:** Single-column progressive flow with 16px touch-optimized inputs (preventing iOS Safari auto-zoom) and a non-intrusive floating quick-order bar.
- **Zero Fake Promotional Elements:** Clean, authentic pricing without artificial urgency counters or fake strikethroughs.

---

## 📡 Integrated Backend Endpoints

| Endpoint | Method | Purpose in Funnel |
| :--- | :---: | :--- |
| `/init-settings` | `GET` | Fetches store defaults, shipping charges, Facebook Pixel IDs |
| `/shipping-charges` | `GET` | Standardized shipping rules (Inside Dhaka ৳60, Outside Dhaka ৳120) |
| `/campaign/{slug}` | `GET` | Fetches campaign-specific landing page products |
| `/product/{slug}` | `GET` | SKU details, gallery images, size & color variants |
| `/shop?per_page=12` | `GET` | Automatic catalog feed fallback |
| `/checkout/order-save` | `POST` | Official order creation with CAPI headers, returns genuine `invoice_id` |
| `/checkout/lead` | `POST` | Abandoned cart lead recording into Laravel CRM |

---

## 🔧 Environment Configuration

Create or update `.env.local`:

```env
# Laravel Headless API Configuration (Server-Only — Never expose with NEXT_PUBLIC_)
LARAVEL_BACKEND_ORIGIN="https://your-laravel-store.com"
LARAVEL_API_BASE_URL="https://your-laravel-store.com/api/v1"
LARAVEL_API_KEY="your_admin_configured_secret_key"

# Optional Product Filtering:
# Strategy 1: Fetch products from a Laravel Campaign slug
LARAVEL_CAMPAIGN_SLUG=""

# Strategy 2: Fetch specific product slugs (comma-separated)
LARAVEL_PRODUCT_SLUGS="product-slug-1,product-slug-2"

# Strategy 3: Leave both blank to automatically pull catalog from /shop?per_page=12
```

---

## 🚀 Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Run development server
npm run dev

# 3. Production build verification
npm run build
npm run start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.
