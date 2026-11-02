# Miro Biotech — static site

Research-peptide storefront. Plain HTML/CSS/JS, no framework, no build step.
Hosted on **Cloudflare Workers** (static assets) and version-controlled on **GitHub**.

```
.
├── public/                     ← everything that gets served
│   ├── index.html              home
│   ├── products.html           catalogue          → served at /products
│   ├── product.html            product detail     → /product?slug=bpc-157
│   ├── about.html              → /about
│   ├── contact.html            → /contact
│   ├── shipping.html           → /shipping
│   ├── legal.html              → /legal
│   ├── 404.html                not-found page
│   ├── robots.txt
│   ├── sitemap.xml             37 URLs, generated from the catalogue
│   ├── _redirects              old .html URLs → clean URLs
│   └── assets/
│       ├── css/  style.css · product-detail.css · home.css · inner.css
│       ├── js/   data.js (all 31 products) · shop.js · product.js
│       └── img/  product, category, hero and press imagery
├── .github/workflows/deploy.yml   CI: asset check + deploy on push to main
├── wrangler.toml
├── package.json
└── .gitignore
```

---

## Quick start (local)

```bash
npm install
npm run dev          # http://localhost:8787
```

`npm run dev` uses Wrangler's local Workers runtime, so what you see is what
Cloudflare will serve — including the clean URLs.

---

## Deploy path A — connect the GitHub repo (recommended, no CLI)

Cloudflare builds and deploys on every push. This is the least moving parts.

1. **Push this folder to GitHub** (see *Git* below).
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Import a repository**.
3. Pick the repo, then set:
   - **Project name:** `mirobiotech`
   - **Build command:** *(leave blank)*
   - **Deploy command:** `npx wrangler deploy`
   - **Root directory:** *(leave blank — `wrangler.toml` is at the root)*
4. **Save and deploy.** You get `https://mirobiotech.<your-subdomain>.workers.dev`.

Because `wrangler.toml` already declares `[assets] directory = "./public"`,
Cloudflare needs no further configuration. Pushing to `main` redeploys automatically.

---

## Deploy path B — from your machine with Wrangler

```bash
npm install
npx wrangler login          # opens the browser, one time
npx wrangler whoami         # confirm the right account

npm run dev                 # optional local check on :8787
npm run deploy              # publishes to *.workers.dev
```

To publish to the **existing** worker instead of creating a new one, either keep the
name `mirobiotech` in `wrangler.toml`, or run `npx wrangler deploy --name mirobiotech-ramsonekwe17`.

---

## Deploy path C — GitHub Actions on every push

Already wired up in `.github/workflows/deploy.yml`. Add two repository secrets
(**Settings → Secrets and variables → Actions**):

| Secret | Where to get it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → *Create Token* → **Edit Cloudflare Workers** template |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard URL: `dash.cloudflare.com/<ACCOUNT_ID>/…` |

Then push to `main`. The workflow checks that every asset reference resolves,
then deploys. Pull requests run the check only.

> Pick **either** path A **or** path C — not both — otherwise each push deploys twice.

---

## Git

```bash
cd mirobiotech-site
git init -b main
git add .
git commit -m "Miro Biotech site: rebuilt homepage, product detail pages, per-vial pricing"

# create an empty repo on GitHub first (no README, no .gitignore), then:
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

`node_modules/`, `.wrangler/` and `.dev.vars` are already git-ignored.

---

## Custom domain

`mirobiotech.com` is currently served by the main site, so **do not attach it** to
this worker unless this build is meant to replace it.

When you are ready, either:
- Workers → your worker → **Settings → Domains & Routes → Add custom domain**, or
- uncomment the `[[routes]]` block in `wrangler.toml` and redeploy.

The domain's DNS must be on Cloudflare first, or the deploy will fail on zone
verification.

---

## What to verify after the first deploy

| Check | Expected |
|---|---|
| `/` | Hero, live search, Featured, Blends, Categories, Why, volume pricing, FAQ |
| `/products` | 31 cards, each showing `from $X USD / per vial` |
| Click any card | Goes to `/product?slug=…` |
| `/product?slug=bpc-157` | `$18.50 USD per vial`, pack picker, specs, quality, ordering, FAQ, related |
| `/product?slug=klow` | Blend composition table instead of a single-compound spec sheet |
| `/product?slug=nope` | Friendly "we could not find that product" screen |
| Add to order → Order button | Drawer opens, total correct, "Email this order" builds the mailto |
| `/contact` | Form opens a pre-filled email |
| `/products.html` | 301 → `/products` (old links still work) |
| `/sitemap.xml`, `/robots.txt` | Serve with 200 |

---

## Editing content

| What | File |
|---|---|
| Prices, pack sizes, names, descriptions, specs, FAQ, related products | `public/assets/js/data.js` — one record per product, all pages read from it |
| Card → page vs. modal behaviour | `CARD_MODE` at the top of `public/assets/js/shop.js` (`"page"` or `"modal"`) |
| Ordering email address | `ORDER_EMAIL` at the top of `public/assets/js/shop.js` |
| Product page layout | `public/assets/js/product.js` (markup) + `public/assets/css/product-detail.css` |
| Homepage | `public/index.html` + `public/assets/css/home.css` |

After changing the catalogue, regenerate the sitemap:

```bash
node -e 'const fs=require("fs");const d=fs.readFileSync("public/assets/js/data.js","utf8");
const P=JSON.parse(d.slice(d.indexOf("window.MIRO_PRODUCTS = ")+24,d.lastIndexOf(";")));
const B="https://mirobiotech.ramsonekwe17.workers.dev";
const fixed=["/","/products","/about","/shipping","/contact","/legal"];
const urls=["<?xml version=\"1.0\" encoding=\"UTF-8\"?>","<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">",
...fixed.map(p=>`  <url><loc>${B}${p}</loc></url>`),
...P.map(p=>`  <url><loc>${B}/product?slug=${p.slug}</loc></url>`),"</urlset>"];
fs.writeFileSync("public/sitemap.xml",urls.join("\n")+"\n");console.log("sitemap:",urls.length-2);'
```

---

## Notes for whoever picks this up

- **This build has no compliance banner.** The research-use messaging that was on
  every page has been removed; the terms themselves live on `/legal`. Anything
  customer-facing that implies human use should go back through whoever handles
  compliance.
- **Prices are per pack of 10 vials.** The per-vial figure is shown first because it
  compares favourably, but the pack price is always disclosed next to it — don't
  remove that line, it keeps the listing honest and avoids chargeback arguments.
- **No backend.** The cart lives in `localStorage`; orders leave the site as a
  `mailto:` link. There is nothing to secure, no database, no payment keys.
