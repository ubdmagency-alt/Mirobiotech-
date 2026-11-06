# Miro Biotech — static site

Research peptide catalogue, built as plain HTML, CSS and JavaScript. No framework,
no build step, no runtime dependencies. Deployed as static assets on Cloudflare
Workers.

Live pages: `/`, `/products`, `/product?slug=<slug>`, `/checkout`, `/about`,
`/contact`, `/shipping`, `/legal`.

---

## 1. What is in here

```
mirobiotech-site/
├── public/                     everything that is served
│   ├── index.html              home
│   ├── products.html           catalogue (filter, sort, search, quick view)
│   ├── product.html            product detail page (?slug=...)
│   ├── checkout.html           shipping details → payment method
│   ├── about.html
│   ├── contact.html
│   ├── shipping.html
│   ├── legal.html
│   ├── 404.html                served by not_found_handling
│   ├── _redirects              old .html → clean URL 301s
│   ├── robots.txt              allows every crawler, AI agents named explicitly
│   ├── sitemap.xml             37 URLs (6 pages + 31 products)
│   └── assets/
│       ├── css/                style, product-detail, home, inner, checkout
│       ├── js/                 data.js, shop.js, product.js, checkout.js
│       └── img/                logos, vial renders, category art, BTC QR
├── wrangler.toml               Workers config — assets only, no worker script
├── package.json                wrangler scripts
├── .github/workflows/deploy.yml  CI deploy on push to main
├── .nvmrc                      20
└── .gitignore
```

`public/assets/js/data.js` is the single source of truth for the catalogue. Add a
product there and it appears on the home page, the catalogue, the quick view and
its own detail page — no other file needs touching.

---

## 2. Deploy

### Path A — Wrangler from your machine (fastest)

```bash
cd mirobiotech-site
npm install
npx wrangler login          # or export CLOUDFLARE_API_TOKEN
npx wrangler deploy
```

First deploy prints a `*.workers.dev` URL. Open it and walk the routes.

### Path B — GitHub Actions (deploy on every push)

1. Push this folder to a GitHub repository (`main` branch).
2. Create an API token: **Cloudflare dashboard → My Profile → API Tokens →
   Create Token → "Edit Cloudflare Workers" template**. Scope it to the account
   you deploy to.
3. In the repository: **Settings → Secrets and variables → Actions → New
   repository secret**:

   | Secret | Value |
   | --- | --- |
   | `CLOUDFLARE_API_TOKEN` | the token from step 2 |
   | `CLOUDFLARE_ACCOUNT_ID` | **Workers & Pages → Overview → Account ID** |

4. Push to `main`. The workflow installs, runs a link/asset integrity check and
   deploys. Pull requests run the check only, no deploy.

### Path C — Cloudflare dashboard upload

**Workers & Pages → Create → Workers → Upload assets**, then drag the `public`
folder in. Fine for a one-off; you lose the redirects workflow and CI.

### Custom domain

In `wrangler.toml`:

```toml
[[routes]]
pattern = "mirobiotech.com"
custom_domain = true
```

Uncomment after the zone is on the same Cloudflare account, then `npx wrangler
deploy` again. Also update the origin in `public/sitemap.xml` and the
`Sitemap:` line in `public/robots.txt`.

---

## 3. Local development

```bash
npm install
npm run dev       # wrangler dev → http://localhost:8787
```

`wrangler dev` runs the real asset router, so clean URLs, `_redirects` 301s and
the 404 page all behave exactly as in production. Opening `public/index.html`
straight from disk also works, but `.html` links and redirects will not.

---

## 4. The checkout flow

`/checkout` is a two-step form. There is no payment processor, no card field and
no backend — everything is client-side and the order leaves as an email the
customer sends from their own mail app.

**Step 1 — shipping details.** Name, email, institution (optional), address,
city, state, postcode, country (125 countries), phone, order notes. Required
fields are validated in the browser. Typed values are kept in `localStorage`
(`miro-shipping`) so a refresh does not lose them.

**Step 2 — payment method.** Exactly two options:

1. **Pay via Bitcoin** — shows the amount, the address and a scannable QR code,
   plus a three-step instruction. The confirm button opens a mail draft pre-filled
   with the items, the BTC amount, the address and a blank `txid:` line.
2. **Email order** — sends the same draft to the team, with a line asking for
   PayPal / CashApp / Zelle / card details. Those four are invoiced manually and
   are described as "available on request" everywhere on the site.

### Values you may need to change

| What | Where |
| --- | --- |
| Bitcoin address | `BTC_ADDRESS` in `assets/js/checkout.js` (also printed in `checkout.html`) |
| Order email | `ORDER_EMAIL` in `assets/js/shop.js` |
| USD → BTC rate | `USD_PER_BTC` in `assets/js/checkout.js` |
| QR code image | `assets/img/btc-qr.png` — regenerate if the address changes |

`USD_PER_BTC` is a **hard-coded reference rate**, not a live quote: a static site
cannot fetch a live price. The page says the BTC figure is indicative and that the
team confirms the rate by email. Update the constant when the market moves, or
replace it with a small fetch to a price API and redeploy.

Regenerate the QR from the address with any wallet, or:

```bash
pip install qrcode[pil]
python3 -c "import qrcode;qrcode.make('bitcoin:bc1qh6l9xxaehfldawqcu6lyvm3d5rrdlgv27we509').save('btc-qr.png')"
```

New arrivals are published with the catalogue, not hard-coded: `/checkout` shows
an empty state when `miro-cart` is empty.

---

## 5. Reviews

Each product page renders three customer reviews (author, country, date, rating,
title, body) and a rating summary in the buy box. Review data lives in `reviews`
and `rating` on the product objects in `data.js`, and is mirrored into the
product's JSON-LD (`aggregateRating` + `review[]`), so the markup stays eligible
for rich results.

To add or swap a review, edit the `reviews` array for that product in `data.js`.
Keep `rating.value` / `rating.count` in step with the published set.

---

## 6. Editing guide

| Task | File |
| --- | --- |
| Add / edit a product | `public/assets/js/data.js` |
| Prices | `variants[].price` (per pack of 10) in `data.js`; per-vial price is derived |
| Home page copy | `public/index.html` |
| Catalogue layout | `public/products.html` + `assets/css/style.css` |
| Detail page sections | `public/assets/js/product.js` |
| Colours, type, spacing | `assets/css/style.css` (`:root` custom properties) |
| Checkout copy | `public/checkout.html` |
| Sitemap | `public/sitemap.xml` — 37 URLs, regenerate if the catalogue changes |

After changing the catalogue, refresh `sitemap.xml` and the JSON-LD counts.

---

## 7. Verification

Run before every deploy:

```bash
node --check public/assets/js/*.js          # syntax
npx wrangler dev                            # then walk:
#   /                      200
#   /products              200
#   /product?slug=bpc-157  200, three reviews, no image caption, image clear of the title
#   /checkout              200, form → payment → BTC panel + email panel
#   /products.html         301 → /products
#   /nope                  404 (custom page)
npx wrangler deploy --dry-run               # "Read 65 files", bundle ≈0.3 KiB
```

The GitHub workflow re-runs the asset-reference check on every push.

---

## 8. Compliance notes

Product copy is written for in-vitro and preclinical research audiences. There are
no human-use claims, no dosing guidance and no therapeutic language on the site;
the full disclaimer lives on `/legal`. Keep it that way when editing.

Bitcoin payments are irreversible. The checkout tells the customer to verify the
address and to email the transaction ID, and the legal page states that the rate
is confirmed before dispatch. Do not remove those two sentences.
