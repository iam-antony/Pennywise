# Pennywise 🪙

A clean, private personal finance tracker. Track income, savings, and spending against your goals — with a guided setup, financial-year views, a Sankey income-flow diagram, and per-category notes.

**This is the public "blank slate" build:** it starts in **January 2026** with no pre-filled data. Every visitor sets up their own profile and all their data stays in *their own browser* (via `localStorage`) — nothing is sent to a server.

---

## Deploying to the web with Vercel (recommended)

Vercel gives you a free, fast, public URL in about 5 minutes. There are two ways to do it.

### Option A — Deploy from GitHub (best for ongoing updates)

1. **Create a GitHub repository**
   - Go to https://github.com/new, name it `pennywise`, and create it (no README needed).
2. **Push this folder to it.** From inside the `pennywise-app` folder, run:
   ```bash
   git init
   git add .
   git commit -m "Initial Pennywise app"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/pennywise.git
   git push -u origin main
   ```
3. **Connect to Vercel**
   - Sign up / log in at https://vercel.com (you can sign in with your GitHub account).
   - Click **Add New… → Project**, then **Import** your `pennywise` repo.
   - Vercel auto-detects Vite. The defaults are correct:
     - **Framework Preset:** Vite
     - **Build Command:** `npm run build`
     - **Output Directory:** `dist`
   - Click **Deploy**.
4. Done. In ~60 seconds you'll get a URL like `https://pennywise-xyz.vercel.app`. Share it with friends.
   Every time you `git push`, Vercel rebuilds and updates the live site automatically.

### Option B — Deploy with the Vercel CLI (fastest one-off)

1. Install the CLI: `npm i -g vercel`
2. From inside this folder, run: `vercel`
3. Answer the prompts (accept the defaults). For a production URL, run `vercel --prod`.

---

## Running it locally first (optional but recommended)

```bash
npm install      # install dependencies
npm run dev      # start a local dev server (usually http://localhost:5173)
```

Open the printed URL in your browser to try it before publishing.

To preview the exact production build locally:
```bash
npm run build
npm run preview
```

---

## A few things worth knowing

- **Data is per-browser.** Because the app uses `localStorage`, each friend's data lives only on the device/browser they use. Clearing browser data, or using a different device, starts fresh. This keeps everything private and requires no database or login.
- **Want cross-device sync or accounts later?** That needs a backend. Supabase (free tier) is the easiest path — it provides a database + authentication. This is a larger change; the current build is intentionally simple and serverless.
- **Custom domain.** In the Vercel dashboard, open your project → **Settings → Domains** to attach a domain like `pennywise.yourname.com`.
- **The build warning about chunk size** (>500 kB) is harmless — it's just a suggestion. The app gzips to ~185 kB and loads quickly.

---

## What's in this folder

```
pennywise-app/
├── index.html            # HTML entry point
├── package.json          # dependencies + scripts
├── vite.config.js        # Vite build config
├── vercel.json           # SPA routing config for Vercel
├── .gitignore
├── public/
│   └── favicon.svg       # app icon
└── src/
    ├── main.jsx          # React bootstrap
    └── App.jsx           # the entire Pennywise app
```

---

## Features

- **Guided onboarding** — name, currency (75+ supported), financial-year start, monthly income, savings goal, and savings/spending categories.
- **Dashboard** — stat cards, gauge dials vs annual targets, combined bar+line charts, and an income-distribution Sankey diagram.
- **Income / Savings / Expenditure pages** — monthly and full-FY views, weekly entry tabs, editable forecasts, and formula-enabled input cells (type `45+32+73`).
- **Notes & tags** — annotate weekly expenditure items and tag monthly income.
- **Net worth & money owed** trackers.
- **Editable baselines** with an FY-scoped editor.
- **Add future financial years** as time goes on.

Enjoy, and happy budgeting! 🪙
