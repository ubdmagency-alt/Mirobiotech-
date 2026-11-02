/* ==========================================================================
   Miro Biotech — site script
   Cart, product modal, and email-based ordering.
   No dependencies. All state lives in localStorage under "miro-cart".

   ORDERING MODEL
   --------------
   There is no payment processing. The cart collects items, then builds a
   pre-filled email to ORDER_EMAIL containing the product, size, quantity and
   price of each line so we can quote and invoice by reply.
   ========================================================================== */

var ORDER_EMAIL = "team@mirobiotech.org";
var CART_KEY = "miro-cart";

/* --------------------------------------------------------------------------
   CARD_MODE — what happens when someone clicks a product card.

   "page"   : cards are links — clicking goes straight to product.html?slug=...
              (the quick-view modal is still available via [data-quickview])
   "modal"  : clicking a card opens the quick-view modal instead, which links
              through to the full page.

   Both targets exist; switch the value to change the behaviour site-wide.
   -------------------------------------------------------------------------- */
var CARD_MODE = "page";
var DETAIL_PAGE = "/product";

/* Product records come from assets/js/data.js (window.MIRO_PRODUCTS).
   Falls back to the inline #product-data block if data.js is not loaded, so
   older pages keep working. */
function getProducts() {
  if (window.MIRO_PRODUCTS && window.MIRO_PRODUCTS.length) return window.MIRO_PRODUCTS;
  var src = $("#product-data");
  if (!src) return [];
  try { return JSON.parse(src.textContent) || []; } catch (e) { return []; }
}

/* Lowest per-vial price across a product's packs, used on the cards. */
function fromPerVial(p) {
  var best = null;
  (p.variants || []).forEach(function (v) {
    var u = parseVariant(v).unit;
    if (best === null || u < best) best = u;
  });
  return best === null ? 0 : best;
}

/* "5mg (\u00d710)" -> { size: "5mg", pack: 10, unit: price / 10 } */
function parseVariant(v) {
  var m = String(v.label || "").match(/^(.+?)\s*\([\u00d7x]\s*(\d+)\)\s*$/);
  var pack = m ? Number(m[2]) : 1;
  return {
    size: m ? m[1].trim() : String(v.label || ""),
    pack: pack,
    unit: (Number(v.price) || 0) / pack
  };
}

/* ---------- tiny helpers ---------- */
function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
function money(n) {
  var v = Number(n) || 0;
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " USD";
}
function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/* ---------- cart state ---------- */
function readCart() {
  try {
    var raw = localStorage.getItem(CART_KEY);
    var arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}
function writeCart(items) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch (e) {
    /* storage disabled — cart stays in memory for this page view only */
  }
  renderCart();
}
function cartCount() {
  return readCart().reduce(function (n, i) { return n + i.qty; }, 0);
}
function cartTotal() {
  return readCart().reduce(function (n, i) { return n + i.price * i.qty; }, 0);
}

function addToCart(item) {
  var cart = readCart();
  var key = item.slug + "|" + item.size;
  var existing = null;
  for (var i = 0; i < cart.length; i++) {
    if (cart[i].slug + "|" + cart[i].size === key) { existing = cart[i]; break; }
  }
  if (existing) {
    existing.qty += item.qty || 1;
  } else {
    cart.push({
      slug: item.slug,
      name: item.name,
      size: item.size,
      price: item.price,
      unit: item.unit || 0,
      qty: item.qty || 1,
      image: item.image || ""
    });
  }
  writeCart(cart);
  toast(existing ? "Quantity updated" : "Added to your order");
  openDrawer();
}

function setQty(slug, size, qty) {
  var cart = readCart();
  for (var i = 0; i < cart.length; i++) {
    if (cart[i].slug === slug && cart[i].size === size) {
      cart[i].qty = Math.max(0, qty);
      if (cart[i].qty === 0) cart.splice(i, 1);
      break;
    }
  }
  writeCart(cart);
}

function removeItem(slug, size) {
  var cart = readCart().filter(function (i) {
    return !(i.slug === slug && i.size === size);
  });
  writeCart(cart);
}

/* ---------- toast ---------- */
var toastTimer = null;
function toast(msg) {
  var el = $("#toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.classList.remove("is-visible"); }, 2200);
}

/* ---------- cart drawer rendering ---------- */
function renderCart() {
  var count = cartCount();
  $$("[data-cart-count]").forEach(function (el) {
    el.textContent = count;
    el.classList.toggle("is-visible", count > 0);
  });

  var body = $("#cart-body");
  var foot = $("#cart-foot");
  if (!body) return;

  var cart = readCart();

  if (!cart.length) {
    body.innerHTML =
      '<div class="cart-empty">' +
        '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">' +
          '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>' +
          '<path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>' +
        '</svg>' +
        '<p><strong>Your order is empty</strong></p>' +
        '<p style="font-size:.86rem">Browse the catalogue and add what you need.</p>' +
        '<a class="btn btn--primary btn--sm mt-2" href="/products">Browse Products</a>' +
      '</div>';
    if (foot) foot.innerHTML =
      '<a class="btn btn--ghost btn--block" href="/contact">Message us instead</a>';
    return;
  }

  body.innerHTML = cart.map(function (i) {
    var img = i.image ? '<img src="' + esc(i.image) + '" alt="" loading="lazy">' : "";
    return (
      '<div class="cart-item">' +
        img +
        '<div>' +
          '<div class="cart-item__name">' + esc(i.name) + '</div>' +
          '<div class="cart-item__meta">' + esc(i.size) +
            (i.unit ? ' &middot; ' + money(i.unit) + ' per vial' : '') + '</div>' +
          '<div class="qty">' +
            '<button type="button" data-qty="-1" data-slug="' + esc(i.slug) + '" data-size="' + esc(i.size) + '" aria-label="Decrease quantity">&minus;</button>' +
            '<span>' + i.qty + '</span>' +
            '<button type="button" data-qty="1" data-slug="' + esc(i.slug) + '" data-size="' + esc(i.size) + '" aria-label="Increase quantity">+</button>' +
          '</div>' +
        '</div>' +
        '<div class="cart-item__price">' + money(i.price * i.qty) + '</div>' +
      '</div>'
    );
  }).join("");

  if (foot) {
    foot.innerHTML =
      '<div class="cart-total"><span>Estimated total</span><b>' + money(cartTotal()) + '</b></div>' +
      '<button class="btn btn--primary btn--block btn--lg" id="email-order">' +
        'Email this order &rarr;' +
      '</button>' +
      '<p class="form-hint center mt-2" style="margin-top:.75rem">' +
        'Opens your mail app with the full order pre-filled, sent to <strong>' + ORDER_EMAIL + '</strong>.' +
      '</p>';
  }
}

/* ---------- build the order email ---------- */
function buildOrderEmail() {
  var cart = readCart();
  var lines = cart.map(function (i) {
    return "- " + i.name + " — " + i.size + " — qty " + i.qty +
           " — " + money(i.price) + " each — " + money(i.price * i.qty);
  });

  var subject = "Research order enquiry — " + cart.length +
                (cart.length === 1 ? " item" : " items") + " (" + money(cartTotal()) + ")";

  var body = [
    "Hello Miro Biotech,",
    "",
    "I would like to order the following research materials:",
    "",
    lines.join("\n"),
    "",
    "Estimated total: " + money(cartTotal()),
    "",
    "---",
    "Please confirm availability and total including shipping.",
    "",
    "Name:",
    "Institution / company (if applicable):",
    "Shipping address:",
    "Country:",
    "Contact phone (for courier):",
    "",
    "Thank you,"
  ].join("\n");

  return { subject: subject, body: body };
}

function emailOrder() {
  var cart = readCart();
  if (!cart.length) { toast("Your order is empty"); return; }
  var msg = buildOrderEmail();
  window.location.href = "mailto:" + ORDER_EMAIL +
    "?subject=" + encodeURIComponent(msg.subject) +
    "&body=" + encodeURIComponent(msg.body);
  toast("Opening your email app…");
}

/* ---------- drawer open/close ---------- */
function openDrawer() {
  var d = $("#cart-drawer");
  if (!d) return;
  d.classList.add("is-open");
  d.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  renderCart();
  var close = $(".drawer__close", d);
  if (close) close.focus();
}
function closeDrawer() {
  var d = $("#cart-drawer");
  if (!d) return;
  d.classList.remove("is-open");
  d.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

/* ---------- product modal ---------- */
var modalReturnFocus = null;

var SVG_TICK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

/* Compact spec table for the quick view — the four most useful rows. */
var MODAL_SPEC_ORDER = ["Molecular weight", "Purity", "CAS number", "Molecular formula", "Sequence", "PubChem CID"];
function modalSpecs(p) {
  var specs = p.specs || {};
  var rows = "";

  MODAL_SPEC_ORDER.forEach(function (k) {
    if (!specs[k]) return;
    rows += "<tr><th scope=\"row\">" + esc(k) + "</th><td>" + esc(specs[k]) + "</td></tr>";
  });

  /* Blends have no single compound spec sheet — show the composition instead. */
  if (specs.components && specs.components.length) {
    var comp = specs.components.map(function (c) {
      return esc(c.label) + ' <span class="modal__unit">(' + esc(c.amount) + ")</span>";
    }).join("<br>");
    rows += "<tr><th scope=\"row\">Composition</th><td>" + comp + "</td></tr>";
  }
  if (specs["Total amount per vial"]) {
    rows += "<tr><th scope=\"row\">Total per vial</th><td>" + esc(specs["Total amount per vial"]) + "</td></tr>";
  }

  if (!rows) return "";
  return '<div class="modal__specs"><table><tbody>' + rows + '</tbody></table></div>';
}

function openProductModal(slug) {
  var products = getProducts();
  if (!products.length) return;

  var p = null;
  for (var i = 0; i < products.length; i++) {
    if (products[i].slug === slug) { p = products[i]; break; }
  }
  if (!p) return;

  var modal = $("#product-modal");
  if (!modal) return;

  var variant = (p.variants && p.variants[0]) || { label: "Standard", price: 0 };
  var variants = (p.variants || []).map(function (v, idx) {
    var pv = parseVariant(v);
    return '<button type="button" class="variant" data-variant="' + idx + '" aria-pressed="' + (idx === 0) + '">' +
             '<span class="variant__label">' + esc(pv.size) +
               '<small>' + pv.pack + ' vials &middot; ' + money(v.price) + ' per pack</small></span>' +
             '<span class="variant__price">' + money(pv.unit) + '<small>per vial</small></span>' +
           '</button>';
  }).join("");

  modal.innerHTML =
    '<div class="modal__backdrop" data-close></div>' +
    '<div class="modal__dialog" role="dialog" aria-modal="true" aria-labelledby="pm-title">' +
      '<button class="modal__close" data-close aria-label="Close">&times;</button>' +
      '<div class="modal__grid">' +
        '<div class="modal__media"><img src="' + esc(p.image || "") + '" alt="' + esc(p.name) + '"></div>' +
        '<div class="modal__body">' +
          (p.category ? '<div class="modal__cat">' + esc(p.category) + '</div>' : "") +
          '<h2 id="pm-title">' + esc(p.name) + '</h2>' +
          '<div class="product__tags">' +
            (p.purity ? '<span class="tag">' + esc(p.purity) + ' purity</span>' : "") +
          '</div>' +
          '<p class="modal__desc">' + esc(p.shortDescription || "") + '</p>' +
          ((p.alternateName && p.alternateName.length)
            ? '<p class="modal__alias">Also known as ' +
                p.alternateName.map(function (a) { return esc(a); }).join(" &middot; ") + '</p>'
            : "") +
          modalSpecs(p) +
          '<div class="field">' +
            '<span class="field__label">Select size</span>' +
            '<div class="variants" id="pm-variants">' + variants + '</div>' +
          '</div>' +
          '<div class="modal__actions">' +
            '<button class="btn btn--primary btn--lg btn--block" id="pm-add">' +
              'Add to order &middot; <span id="pm-price">' + money(variant.price) + '</span>' +
            '</button>' +
            '<p class="modal__unit" id="pm-unit" style="text-align:center;margin:-.4rem 0 0">' +
              'Charged per pack of ' + parseVariant(variant).pack + ' &middot; ' + money(variant.price) +
            '</p>' +
            '<a class="btn btn--ghost btn--block" id="pm-email">' +
              'Message us about this &rarr;' +
            '</a>' +
          '</div>' +
          '<ul class="modal__perks">' +
            '<li>' + SVG_TICK + '<span>Free worldwide shipping, tracked and insured</span></li>' +
            '<li>' + SVG_TICK + '<span>Certificate of analysis for this batch on request</span></li>' +
            '<li>' + SVG_TICK + '<span>Same-day dispatch, customs handled</span></li>' +
          '</ul>' +
          '<a class="modal__full" href="' + DETAIL_PAGE + '?slug=' + encodeURIComponent(p.slug) + '">' +
            'View full details, specs &amp; FAQ &rarr;' +
          '</a>' +
          '<p class="modal__note">' +
            'We do not take payment online. Add items and email your order, or message ' +
            '<strong>' + ORDER_EMAIL + '</strong> directly and we will reply with availability and totals.' +
          '</p>' +
        '</div>' +
      '</div>' +
    '</div>';

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  modalReturnFocus = document.activeElement;

  var variantsList = p.variants || [variant];
  var chosen = variantsList[0] || variant;

  $$("#pm-variants .variant", modal).forEach(function (btn) {
    btn.addEventListener("click", function () {
      var idx = Number(btn.getAttribute("data-variant"));
      chosen = variantsList[idx] || variantsList[0];
      $$("#pm-variants .variant", modal).forEach(function (b) {
        b.setAttribute("aria-pressed", String(b === btn));
      });
      $("#pm-price", modal).textContent = money(chosen.price);
      var unit = $("#pm-unit", modal);
      if (unit) {
        var pv = parseVariant(chosen);
        unit.innerHTML = "Charged per pack of " + pv.pack + " &middot; " + money(chosen.price);
      }
    });
  });

  $("#pm-add", modal).addEventListener("click", function () {
    addToCart({
      slug: p.slug,
      name: p.name,
      size: chosen.label.replace(/\s*\(.*$/, "") + " (\u00d7" + parseVariant(chosen).pack + ")",
      price: chosen.price,
      unit: parseVariant(chosen).unit,
      qty: 1,
      image: p.image
    });
    closeProductModal();
  });

  // "Message us about this" — pre-filled single-product email
  $("#pm-email", modal).setAttribute(
    "href",
    "mailto:" + ORDER_EMAIL +
      "?subject=" + encodeURIComponent("Enquiry: " + p.name) +
      "&body=" + encodeURIComponent(
        "Hello Miro Biotech,\n\n" +
        "I would like to know more about " + p.name + " (" + chosen.label + ").\n\n" +
        "Please send availability, pricing and shipping details.\n\n" +
        "Name:\nCountry:\n\nThank you,"
      )
  );

  $$("[data-close]", modal).forEach(function (el) {
    el.addEventListener("click", closeProductModal);
  });

  var closeBtn = $(".modal__close", modal);
  if (closeBtn) closeBtn.focus();
}

function closeProductModal() {
  var modal = $("#product-modal");
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = "";
  document.body.style.overflow = "";
  if (modalReturnFocus && modalReturnFocus.focus) modalReturnFocus.focus();
}

/* ---------- catalogue filtering ---------- */
function initFilters() {
  var bar = $("#filters");
  if (!bar) return;
  bar.addEventListener("click", function (e) {
    var chip = e.target.closest(".chip");
    if (!chip) return;
    var cat = chip.getAttribute("data-cat");
    $$(".chip", bar).forEach(function (c) {
      c.setAttribute("aria-pressed", String(c === chip));
    });
    $$("[data-category]").forEach(function (card) {
      var show = cat === "all" || card.getAttribute("data-category") === cat;
      card.style.display = show ? "" : "none";
    });
    var shown = $$("[data-category]").filter(function (c) { return c.style.display !== "none"; }).length;
    var counter = $("#filter-count");
    if (counter) counter.textContent = shown + (shown === 1 ? " product" : " products");
  });
}

/* ---------- boot ---------- */
document.addEventListener("DOMContentLoaded", function () {
  renderCart();

  // open cart
  $$("[data-open-cart]").forEach(function (b) {
    b.addEventListener("click", function (e) { e.preventDefault(); openDrawer(); });
  });
  $$("[data-close-cart]").forEach(function (b) {
    b.addEventListener("click", closeDrawer);
  });

  // cart line controls + email order (delegated: cart body is re-rendered)
  var drawer = $("#cart-drawer");
  if (drawer) {
    drawer.addEventListener("click", function (e) {
      var q = e.target.closest("[data-qty]");
      if (q) {
        var delta = Number(q.getAttribute("data-qty"));
        var slug = q.getAttribute("data-slug");
        var size = q.getAttribute("data-size");
        var cart = readCart();
        var cur = 0;
        cart.forEach(function (i) { if (i.slug === slug && i.size === size) cur = i.qty; });
        setQty(slug, size, cur + delta);
        return;
      }
      if (e.target.closest("#email-order")) { emailOrder(); }
    });
  }

  // product cards -> quick-view modal, or straight to the product page
  document.addEventListener("click", function (e) {
    var trigger = e.target.closest("[data-product]");
    if (!trigger) return;

    var slug = trigger.getAttribute("data-product");
    var isLink = trigger.tagName === "A" && trigger.getAttribute("href");
    var forcedModal = trigger.getAttribute("data-modal") === "true";
    var forcedPage = trigger.getAttribute("data-modal") === "false";
    var wantsModal = forcedModal || (!forcedPage && !isLink && CARD_MODE === "modal");

    if (wantsModal) {
      e.preventDefault();
      openProductModal(slug);
    } else if (isLink) {
      return; /* let the browser follow the real href */
    } else {
      e.preventDefault();
      window.location.href = DETAIL_PAGE + "?slug=" + encodeURIComponent(slug);
    }
  });

  // links that should open the quick view instead of navigating
  document.addEventListener("click", function (e) {
    var quick = e.target.closest("[data-quickview]");
    if (!quick) return;
    e.preventDefault();
    openProductModal(quick.getAttribute("data-quickview"));
  });

  // mobile nav
  var toggle = $(".nav-toggle");
  var nav = $("#nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  // escape closes overlays
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if ($("#product-modal") && $("#product-modal").classList.contains("is-open")) closeProductModal();
    if ($("#cart-drawer") && $("#cart-drawer").classList.contains("is-open")) closeDrawer();
  });

  initFilters();

  /* NOTE: the product detail page is rendered and wired up entirely by
     product.js. shop.js deliberately does not touch it — the old handler here
     read the inline #product-data blob, which no longer exists on product.html,
     and threw on every variant click. */
});

/* expose for inline handlers / debugging */
window.MiroShop = {
  getProducts: getProducts,
  fromPerVial: fromPerVial,
  openProduct: openProductModal,
  addToCart: addToCart,
  openCart: openDrawer,
  closeCart: closeDrawer,
  emailOrder: emailOrder,
  ORDER_EMAIL: ORDER_EMAIL
};

/* ---------- homepage hero search ---------- */
document.addEventListener("DOMContentLoaded", function () {
  var input = document.getElementById("hero-search");
  if (!input) return;

  var wrap = input.closest(".hero__search");
  var box = document.createElement("div");
  box.className = "hero__results";
  box.style.display = "none";
  wrap.parentNode.insertBefore(box, wrap.nextSibling);

  function render(q) {
    var products = getProducts();
    q = q.trim().toLowerCase();
    if (!q) { box.style.display = "none"; box.innerHTML = ""; return; }

    var hits = products.filter(function (p) {
      return (p.name + " " + p.category + " " + (p.alternateName || []).join(" ")).toLowerCase().indexOf(q) !== -1;
    }).slice(0, 6);

    box.innerHTML = hits.length
      ? hits.map(function (p) {
          return '<a href="/product?slug=' + encodeURIComponent(p.slug) + '">' +
                   '<b>' + esc(p.name) + '</b>' +
                   '<span>' + esc(p.purity) + ' &middot; from ' + money(fromPerVial(p)) + '/vial</span>' +
                 '</a>';
        }).join("")
      : '<p>No compounds match &ldquo;' + esc(q) + '&rdquo;. <a href="products.html">Browse all 31 &rarr;</a></p>';
    box.style.display = "block";
  }

  input.addEventListener("input", function () { render(input.value); });
  input.addEventListener("focus", function () { if (input.value.trim()) render(input.value); });
  document.addEventListener("click", function (e) {
    if (!box.contains(e.target) && e.target !== input) box.style.display = "none";
  });
  document.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); input.focus(); }
    if (e.key === "Escape") box.style.display = "none";
  });
});

/* ---------- contact page form (mailto, no server) ---------- */
document.addEventListener("DOMContentLoaded", function () {
  var form = document.getElementById("contact-form");
  if (!form) return;
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var v = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; };
    var name = v("cf-name"), email = v("cf-email"), country = v("cf-country"),
        product = v("cf-product"), message = v("cf-message");

    var body = [
      "Hello Miro Biotech,", "",
      message, "",
      "---",
      "Name: " + name,
      "Email: " + email,
      "Country: " + country,
      product ? "Product of interest: " + product : null,
      "", "Thank you,"
    ].filter(function (l) { return l !== null; }).join("\n");

    window.location.href = "mailto:" + ORDER_EMAIL +
      "?subject=" + encodeURIComponent("Website enquiry" + (product ? ": " + product : "") + (name ? " — " + name : "")) +
      "&body=" + encodeURIComponent(body);
    toast("Opening your email app…");
  });
});
