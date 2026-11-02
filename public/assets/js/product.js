/* ==========================================================================
   Miro Biotech — product detail page
   --------------------------------------------------------------------------
   Renders product.html?slug=<slug> from window.MIRO_PRODUCTS (assets/js/data.js).

   Everything on the page is generated here so the page can never drift out of
   sync with the catalogue. If a field is missing for a product, that section
   is simply not rendered — no placeholders, no empty headings.

   Cart integration: uses window.MiroShop.addToCart() from shop.js.
   ========================================================================== */

(function () {
  "use strict";

  var ORDER_EMAIL = (window.MiroShop && window.MiroShop.ORDER_EMAIL) || "team@mirobiotech.org";

  /* ---------- helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function money(n) {
    var v = Number(n) || 0;
    return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " USD";
  }
  /* "5mg (×10)" -> { size: "5mg", pack: 10 } */
  function parseVariant(v) {
    var label = String(v.label || "");
    var m = label.match(/^(.+?)\s*\([×x]\s*(\d+)\)\s*$/);
    var size = m ? m[1].trim() : label.trim();
    var pack = m ? Number(m[2]) : 1;
    return { size: size, pack: pack, unit: v.price / pack };
  }

  var SVG = {
    check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    truck: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 18V6a1 1 0 0 0-1-1H2v12h12z"/><path d="M14 9h4l4 4v5h-8"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
    flask: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6"/><path d="M10 3v6.5L4.6 18a2 2 0 0 0 1.7 3h11.4a2 2 0 0 0 1.7-3L14 9.5V3"/><path d="M7 15h10"/></svg>',
    doc: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/></svg>',
    microscope: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 18h8"/><path d="M3 22h18"/><path d="M14 22a7 7 0 1 0 0-14h-1"/><path d="M9 14h2"/><path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z"/><path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3"/></svg>',
    shield: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>',
    lock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    snow: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v20M4 6l16 12M20 6 4 18"/><path d="m9 4 3 3 3-3M9 20l3-3 3 3"/></svg>',
    mail: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 7 10-7"/></svg>',
    arrow: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
  };

  /* ---------- resolve product ---------- */
  var params = new URLSearchParams(window.location.search);
  var slug = (
    params.get("slug") ||                                  // product.html?slug=bpc-157
    window.location.hash.replace(/^#/, "") ||              // product.html#bpc-157
    document.documentElement.getAttribute("data-default-slug") ||  // preview fallback
    ""
  ).trim();
  var all = window.MIRO_PRODUCTS || [];
  var product = null;
  for (var i = 0; i < all.length; i++) {
    if (all[i].slug === slug) { product = all[i]; break; }
  }

  var root = $("#product-root");

  if (!product) {
    if (root) {
      root.innerHTML =
        '<section class="section"><div class="wrap center">' +
          '<p class="eyebrow">Not found</p>' +
          '<h1>We could not find that product</h1>' +
          '<p class="muted">The link may be out of date. Browse the full catalogue to find the compound you need.</p>' +
          '<p class="mt-2"><a class="btn btn--primary" href="/products">Browse the catalogue</a></p>' +
        '</div></section>';
    }
    document.title = "Product not found — Miro Biotech";
    return;
  }

  /* ---------- document head ---------- */
  document.title = product.name + " " + product.purity + " Purity | Research Peptide | Miro Biotech";
  var md = $('meta[name="description"]');
  if (md) md.setAttribute("content", product.shortDescription);
  var canon = document.createElement("link");
  canon.rel = "canonical";
  canon.href = window.location.origin + "/product?slug=" + product.slug;
  document.head.appendChild(canon);

  /* ---------- state ---------- */
  var chosen = product.variants[0];
  var chosenParsed = parseVariant(chosen);
  var qty = 1;

  /* ---------- serialise content that repeats ---------- */
  var specRows = "";
  var compositionRow = "";
  Object.keys(product.specs || {}).forEach(function (k) {
    var v = product.specs[k];
    if (!v) return;
    if (k === "components" && Array.isArray(v)) {
      compositionRow =
        "<tr><th scope=\"row\">Total per vial</th><td id=\"blend-total\">" + esc(chosenParsed.size) + "</td></tr>" +
        "<tr><th scope=\"row\">Composition</th><td>" + v.map(function (c) {
        return esc(c.label) + (c.substance ? ' <span class="spec-sub">' + esc(c.substance) + "</span>" : "") +
               " &mdash; " + esc(c.amount);
      }).join("<br>") + "</td></tr>";
      return;
    }
    if (typeof v !== "string") return;
    if (/^https?:\/\//.test(v)) {
      v = '<a href="' + esc(v) + '" target="_blank" rel="noopener noreferrer">' + esc(v.replace(/^https?:\/\//, "")) + "</a>";
    }
    specRows += "<tr><th scope=\"row\">" + esc(k) + "</th><td>" + v + "</td></tr>";
  });

  /* identifiers not already in the spec table get appended */
  var inSpec = Object.keys(product.specs || {}).map(function (k) { return k.toLowerCase(); });
  Object.keys(product.identifiers || {}).forEach(function (k) {
    var label = k === "CAS" ? "CAS number" : k;
    if (inSpec.indexOf(label.toLowerCase()) !== -1) return;
    var value = product.identifiers[k];
    if (k === "PubChem CID") {
      value = '<a href="https://pubchem.ncbi.nlm.nih.gov/compound/' + esc(value) + '" target="_blank" rel="noopener noreferrer">' + esc(value) + "</a>";
    } else if (k === "ChEMBL") {
      value = '<a href="https://www.ebi.ac.uk/chembl/compound_report_card/' + esc(value) + '/" target="_blank" rel="noopener noreferrer">' + esc(value) + "</a>";
    } else if (k === "Wikidata") {
      value = '<a href="https://www.wikidata.org/wiki/' + esc(value) + '" target="_blank" rel="noopener noreferrer">' + esc(value) + "</a>";
    } else {
      value = esc(value);
    }
    specRows += "<tr><th scope=\"row\">" + esc(label) + "</th><td>" + value + "</td></tr>";
  });
  if (product.molecularWeight && !inSpec.some(function (k) { return k.indexOf("molecular weight") === 0; })) {
    specRows += "<tr><th scope=\"row\">Molecular weight</th><td>" + esc(product.molecularWeight) + " g/mol</td></tr>";
  }
  specRows += compositionRow;

  var aliasChips = (product.alternateName || []).map(function (a) {
    return '<span class="tag tag--muted">' + esc(a) + "</span>";
  }).join("");

  var variantButtons = product.variants.map(function (v, idx) {
    var p = parseVariant(v);
    return '<button class="variant" type="button" data-variant="' + idx + '" aria-pressed="' + (idx === 0) + '">' +
             '<span class="variant__label">' + esc(p.size) +
               "<small>pack of " + p.pack + " &middot; " + money(v.price) + "</small></span>" +
             '<span class="variant__price">' + money(p.unit) + "<small>per vial</small></span>" +
           "</button>";
  }).join("");

  var appCards = (product.researchApplications || []).map(function (a) {
    return '<article class="app-card">' +
             '<span class="app-card__icon">' + SVG.microscope + "</span>" +
             "<h3>" + esc(a.title) + "</h3>" +
             "<p>" + esc(a.text) + "</p>" +
           "</article>";
  }).join("");

  var faqItems = (product.faq || []).map(function (f) {
    return "<details class=\"faq\">" +
             "<summary>" + esc(f.q) + "</summary>" +
             "<p>" + esc(f.a) + "</p>" +
           "</details>";
  }).join("");

  var related = (product.related || []).map(function (r) {
    for (var j = 0; j < all.length; j++) if (all[j].slug === r) return all[j];
    return null;
  }).filter(Boolean);

  var relatedCards = related.map(function (p) {
    var from = Math.min.apply(null, p.variants.map(function (v) { return v.price; }));
    return '<a class="card card--link" href="/product?slug=' + encodeURIComponent(p.slug) + '">' +
             '<div class="card__media">' +
               '<span class="badge badge--purity">' + esc(p.purity) + " pure</span>" +
               '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + ' research vial" loading="lazy">' +
             "</div>" +
             '<div class="card__body">' +
               '<div class="card__cat">' + esc(p.category) + "</div>" +
               '<h3 class="card__title">' + esc(p.name) + "</h3>" +
               '<p class="card__desc">' + esc(p.shortDescription) + "</p>" +
               '<div class="card__foot">' +
                 '<div class="card__price">from ' + money(from / 10) + "<small>per vial</small></div>" +
                 '<span class="card__more">Details &rarr;</span>' +
               "</div>" +
             "</div>" +
           "</a>";
  }).join("");

  var bullets = [
    { icon: SVG.truck, text: "Free worldwide shipping, tracked and insured" },
    { icon: SVG.check, text: "Same-day dispatch — orders confirmed before 2pm ET" },
    { icon: SVG.doc, text: "Certificate of analysis for every batch" },
    { icon: SVG.shield, text: "Third-party identity and purity verification" },
    { icon: SVG.snow, text: "Shipped ambient-stable; store at &minus;20&deg;C on arrival" },
    { icon: SVG.lock, text: "Supplied in sealed 10-vial packs with batch documentation" }
  ];

  /* ---------- page ---------- */
  root.innerHTML =
    '<section class="page-head page-head--product">' +
      '<div class="wrap">' +
        '<div class="breadcrumb">' +
          '<a href="/">Home</a><span>/</span>' +
          '<a href="/products">Products</a><span>/</span>' +
          '<a href="products.html#' + esc(slugCat(product.category)) + '">' + esc(product.category) + "</a><span>/</span>" +
          "<span>" + esc(product.name) + "</span>" +
        "</div>" +
      "</div>" +
    "</section>" +

    '<section class="section section--paper">' +
      '<div class="wrap">' +
        '<div class="product">' +

          '<div class="product__media">' +
            '<span class="product__purity-badge">' + esc(product.purity) + " pure</span>" +
            '<img src="' + esc(product.image) + '" alt="' + esc(product.name) + ' research vial">' +
            '<p class="product__media-note">Product image is for illustrative purposes only and may not represent the actual product.</p>' +
          "</div>" +

          '<div class="product__info">' +
            '<div class="product__tags">' +
              '<a class="tag" href="products.html#' + esc(slugCat(product.category)) + '">' + esc(product.category) + "</a>" +

              (product.sku ? '<span class="tag tag--muted">SKU ' + esc(product.sku) + "</span>" : "") +
            "</div>" +

            "<h1>" + esc(product.name) + "</h1>" +

            '<div class="product__purity-line">' +
              '<span class="dot"></span>Verified purity ' + esc(product.purity) +
              '<span class="sep"></span>Batch-tested' +
            "</div>" +

            '<p class="product__lede">' + esc(product.shortDescription) + "</p>" +

            (aliasChips ? '<div class="product__aliases"><span>Also known as</span>' + aliasChips + "</div>" : "") +

            '<div class="field">' +
              '<span class="field__label">Choose your pack <span class="field__hint">10 vials per pack</span></span>' +
              '<div class="variants" id="detail-variants">' + variantButtons + "</div>" +
            "</div>" +

            '<div class="field">' +
              '<span class="field__label" id="qty-label">Quantity</span>' +
              '<div class="buybar">' +
                '<div class="qty qty--lg" role="group" aria-labelledby="qty-label">' +
                  '<button type="button" id="qty-minus" aria-label="Decrease quantity">&minus;</button>' +
                  '<span id="qty-value">1</span>' +
                  '<button type="button" id="qty-plus" aria-label="Increase quantity">+</button>' +
                "</div>" +
                '<div class="buybar__price">' +
                  '<b id="detail-total">' + money(chosenParsed.unit) + "</b>" +
                  '<small id="detail-unit">per vial &middot; pack of ' + chosenParsed.pack +
                    " &middot; " + money(chosen.price) + " per pack</small>" +
                "</div>" +
              "</div>" +
            "</div>" +

            '<div class="modal__actions">' +
              '<button class="btn btn--primary btn--lg btn--block" id="detail-add">Add to order</button>' +
              '<a class="btn btn--ghost btn--block" id="detail-email" href="#">' +
                SVG.mail + " Message us about this" +
              "</a>" +
            "</div>" +

            '<p class="modal__note">' +
              "We do not take payment online. Add compounds to your list and email the order — " +
              "we reply within one business day with availability, freight and a total." +
            "</p>" +

            '<ul class="trust-list">' +
              bullets.map(function (b) {
                return '<li><span class="trust-list__icon">' + b.icon + "</span><span>" + b.text + "</span></li>";
              }).join("") +
            "</ul>" +
          "</div>" +

        "</div>" +
      "</div>" +
    "</section>" +

    (specRows ?
    '<section class="section section--cream" id="specifications">' +
      '<div class="wrap">' +
        '<div class="section-head"><p class="eyebrow">Reference data</p>' +
          "<h2>" + esc(product.name) + " specifications</h2>" +
          "<p>Identity and physical data for this compound, as published in the reference literature. For laboratory use only.</p>" +
        "</div>" +
        '<div class="split split--even">' +
          '<div class="panel"><table class="spec-table"><tbody>' + specRows + "</tbody></table></div>" +
          '<div class="panel panel--soft">' +
            (product.sequence
              ? '<p class="spec-label">Amino-acid sequence</p><code class="spec-code">' + esc(product.sequence) + "</code>"
              : (product.structure
                ? '<p class="spec-label">Structure</p><code class="spec-code">' + esc(product.structure) + "</code>"
                : "")) +
            "<h3>Handling &amp; storage</h3>" +
            '<ul class="tick-list">' +
              "<li>Store the lyophilised powder at &minus;20&deg;C, protected from light.</li>" +
              "<li>Reconstitute with bacteriostatic water; keep solutions at 2&ndash;8&deg;C.</li>" +
              "<li>Avoid repeated freeze&ndash;thaw cycles; aliquot before freezing.</li>" +
              "<li>Equilibrate to room temperature before opening the vial.</li>" +
            "</ul>" +
            '<p class="panel__foot">A certificate of analysis for the current batch is available on request.</p>' +
          "</div>" +
        "</div>" +
      "</div>" +
    "</section>" : "") +

    (appCards ?
    '<section class="section section--paper" id="research">' +
      '<div class="wrap">' +
        '<div class="section-head"><p class="eyebrow">Research applications</p>' +
          "<h2>Where " + esc(product.name) + " is used in research</h2>" +
          "<p>Areas of study described in the published literature. Listed for research reference only — " +
          "not a statement of efficacy, safety or intended human use.</p>" +
        "</div>" +
        '<div class="app-grid">' + appCards + "</div>" +
      "</div>" +
    "</section>" : "") +

    '<section class="section section--cream" id="quality">' +
      '<div class="wrap">' +
        '<div class="section-head"><p class="eyebrow">Quality</p>' +
          "<h2>Independently verified, batch by batch</h2>" +
          "<p>Every vial of " + esc(product.name) + " is released against a certificate of analysis before it ships.</p>" +
        "</div>" +
        '<div class="grid grid--3">' +
          '<article class="panel">' +
            '<span class="panel__icon">' + SVG.flask + "</span>" +
            "<h3>Tested every batch</h3>" +
            "<p>Each batch is analysed by an independent third-party laboratory before release. " +
            "Identity is confirmed by mass spectrometry; purity by HPLC.</p>" +
          "</article>" +
          '<article class="panel">' +
            '<span class="panel__icon">' + SVG.shield + "</span>" +
            "<h3>Verified to " + esc(product.purity) + "</h3>" +
            "<p>The current batch of " + esc(product.name) + " is verified at " + esc(product.purity) +
            " purity against its reference standard, with the chromatogram recorded on the COA.</p>" +
          "</article>" +
          '<article class="panel">' +
            '<span class="panel__icon">' + SVG.doc + "</span>" +
            "<h3>Certificate of analysis</h3>" +
            "<p>A digital COA — batch number, method, purity, appearance and storage — is supplied with every order " +
            "and available before purchase on request.</p>" +
            '<a class="panel__link" href="mailto:' + ORDER_EMAIL +
              '?subject=' + encodeURIComponent("COA request — " + product.name) +
              '&body=' + encodeURIComponent("Hello Miro Biotech,\n\nPlease send the certificate of analysis for the current batch of " + product.name + ".\n\nName:\nInstitution:\nCountry:\n\nThank you,") +
              '">Request the COA ' + SVG.arrow + "</a>" +
          "</article>" +
        "</div>" +
      "</div>" +
    "</section>" +

    '<section class="section section--paper" id="ordering">' +
      '<div class="wrap">' +
        '<div class="split">' +
          '<div>' +
            '<p class="eyebrow">Ordering</p>' +
            "<h2>How to order " + esc(product.name) + "</h2>" +
            '<ol class="steps">' +
              "<li><b>Pick your pack.</b> Sizes and pack prices are listed at the top of this page.</li>" +
              "<li><b>Add it to your list.</b> Build a list across the catalogue — nothing is charged online.</li>" +
              "<li><b>Email the order.</b> Your mail app opens pre-filled with every item, size and price.</li>" +
              "<li><b>We confirm and invoice.</b> Availability, freight and the total come back within one business day.</li>" +
            "</ol>" +
          "</div>" +
          '<div class="panel panel--soft">' +
            "<h3>What we need from you</h3>" +
            '<table class="spec-table"><tbody>' +
              "<tr><th scope=\"row\">Products &amp; sizes</th><td>From your list, or just describe them</td></tr>" +
              "<tr><th scope=\"row\">Shipping country</th><td>So we can quote freight</td></tr>" +
              "<tr><th scope=\"row\">Name &amp; institution</th><td>If ordering for a lab</td></tr>" +
            "</tbody></table>" +
            '<a class="btn btn--primary btn--block mt-2" href="mailto:' + ORDER_EMAIL + '">Email ' + ORDER_EMAIL + "</a>" +
            '<p class="panel__foot">Mon&ndash;Fri, 9am&ndash;5pm ET. Free shipping worldwide, customs handled.</p>' +
          "</div>" +
        "</div>" +
      "</div>" +
    "</section>" +

    (faqItems ?
    '<section class="section section--cream" id="faq">' +
      '<div class="wrap wrap--narrow">' +
        '<div class="section-head"><p class="eyebrow">FAQ</p>' +
          "<h2>" + esc(product.name) + " questions</h2></div>" +
        faqItems +
      "</div>" +
    "</section>" : "") +

    (relatedCards ?
    '<section class="section section--paper" id="related">' +
      '<div class="wrap">' +
        '<div class="section-head"><p class="eyebrow">Compare</p>' +
          "<h2>Related products</h2>" +
          "<p>Other compounds from the same research area.</p></div>" +
        '<div class="grid">' + relatedCards + "</div>" +
        '<p class="center mt-2"><a class="btn btn--ghost" href="/products">View all 31 products &rarr;</a></p>' +
      "</div>" +
    "</section>" : "") +

    '';

  /* ---------- helpers that need product ---------- */
  function slugCat(cat) {
    return String(cat).toLowerCase().replace(/&/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  /* ---------- behaviour ---------- */
  function refreshBuyBar() {
    var total = chosen.price * qty;
    $("#detail-total").textContent = money(chosenParsed.unit);
    $("#detail-unit").innerHTML = "per vial &middot; pack of " + chosenParsed.pack +
      " &middot; " + money(chosen.price) + " per pack" +
      (qty > 1 ? " &middot; " + qty + " packs = " + money(total) : "");
    $("#qty-value").textContent = qty;
    var blendTotal = $("#blend-total");
    if (blendTotal) blendTotal.textContent = chosenParsed.size;
    var add = $("#detail-add");
    if (add) add.innerHTML = "Add to order &middot; " + money(total);
  }

  Array.prototype.forEach.call(document.querySelectorAll("#detail-variants .variant"), function (btn) {
    btn.addEventListener("click", function () {
      var idx = Number(btn.getAttribute("data-variant"));
      chosen = product.variants[idx];
      chosenParsed = parseVariant(chosen);
      Array.prototype.forEach.call(document.querySelectorAll("#detail-variants .variant"), function (b) {
        b.setAttribute("aria-pressed", String(b === btn));
      });
      refreshBuyBar();
    });
  });

  $("#qty-minus").addEventListener("click", function () {
    qty = Math.max(1, qty - 1); refreshBuyBar();
  });
  $("#qty-plus").addEventListener("click", function () {
    qty = Math.min(99, qty + 1); refreshBuyBar();
  });

  $("#detail-add").addEventListener("click", function () {
    if (!window.MiroShop) { window.location.href = "products.html"; return; }
    window.MiroShop.addToCart({
      slug: product.slug,
      name: product.name,
      size: chosenParsed.size + " (\u00d7" + chosenParsed.pack + ")",
      price: chosen.price,
      unit: chosenParsed.unit,
      qty: qty,
      image: product.image
    });
  });

  $("#detail-email").setAttribute(
    "href",
    "mailto:" + ORDER_EMAIL +
      "?subject=" + encodeURIComponent("Enquiry: " + product.name + " — " + chosenParsed.size + " pack") +
      "&body=" + encodeURIComponent(
        "Hello Miro Biotech,\n\n" +
        "I would like more information about " + product.name + " (" + chosenParsed.size +
        " \u00d7" + chosenParsed.pack + " vials, " + money(chosen.price) + " per pack).\n\n" +
        "Quantity I am considering: " + qty + " pack(s)\n" +
        "Please send availability, the current COA, shipping cost and a total.\n\n" +
        "Name:\nInstitution:\nShipping country:\n\n" +
        "Thank you,"
      )
  );

  refreshBuyBar();

  /* ---------- structured data (SEO) ---------- */
  var ld = {
    "@context": "https://schema.org",
    "@type": ["Product", "MolecularEntity"],
    name: product.name,
    description: product.shortDescription,
    image: new URL(product.image, window.location.href).href,
    sku: product.sku || undefined,
    alternateName: product.alternateName && product.alternateName.length ? product.alternateName : undefined,
    brand: { "@type": "Brand", name: "Miro Biotech" },
    category: product.category,
    sameAs: product.sameAs && product.sameAs.length ? product.sameAs : undefined,
    identifier: Object.keys(product.identifiers || {}).map(function (k) {
      return { "@type": "PropertyValue", propertyID: k, value: product.identifiers[k] };
    }),
    offers: product.variants.map(function (v) {
      var p = parseVariant(v);
      return {
        "@type": "Offer",
        name: p.size + " \u00d7" + p.pack + " vials",
        price: v.price,
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        itemCondition: "https://schema.org/NewCondition",
        url: canon.href
      };
    })
  };
  if (product.molecularWeight) {
    ld.molecularWeight = { "@type": "QuantitativeValue", value: product.molecularWeight, unitCode: "DAL" };
  }
  var s1 = document.createElement("script");
  s1.type = "application/ld+json";
  s1.textContent = JSON.stringify(ld);
  document.head.appendChild(s1);

  if (product.faq && product.faq.length) {
    var fd = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: product.faq.map(function (f) {
        return { "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } };
      })
    };
    var s2 = document.createElement("script");
    s2.type = "application/ld+json";
    s2.textContent = JSON.stringify(fd);
    document.head.appendChild(s2);
  }

  var bd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: window.location.origin + "/" },
      { "@type": "ListItem", position: 2, name: "Products", item: window.location.origin + "/products" },
      { "@type": "ListItem", position: 3, name: product.category, item: window.location.origin + "/products#" + slugCat(product.category) },
      { "@type": "ListItem", position: 4, name: product.name }
    ]
  };
  var s3 = document.createElement("script");
  s3.type = "application/ld+json";
  s3.textContent = JSON.stringify(bd);
  document.head.appendChild(s3);
})();
