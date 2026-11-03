/* ==========================================================================
   Miro Biotech — checkout
   --------------------------------------------------------------------------
   Two steps: shipping details, then payment method.

   Nothing is charged here. There is no payment processor, no card fields and
   no server. The flow ends the same way the rest of the site does: the order
   leaves as an email the customer sends from their own mail app.

   Bitcoin is the one method with a real address on the page. The amount shown
   is derived from USD at a reference rate defined below — it is indicative
   ONLY, and the copy says so, because we cannot quote a live BTC price from a
   static page.
   ========================================================================== */

(function () {
  "use strict";

  /* ---------- config ---------- */
  var ORDER_EMAIL = (window.MiroShop && window.MiroShop.ORDER_EMAIL) || "team@mirobiotech.org";
  var BTC_ADDRESS = "bc1qh6l9xxaehfldawqcu6lyvm3d5rrdlgv27we509";

  /* Indicative conversion only. Update this figure when the rate moves, or the
     BTC amount shown on the page drifts from reality. The email always states
     that the final amount is confirmed by the team. */
  var USD_PER_BTC = 90000;

  var SHIP_KEY = "miro-shipping";

  /* ---------- helpers ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function money(n) {
    return "$" + (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " USD";
  }
  function btc(n) {
    return (Number(n) || 0).toFixed(8).replace(/0+$/, "").replace(/\.$/, "") + " BTC";
  }
  function readCart() {
    try { return JSON.parse(localStorage.getItem("miro-cart") || "[]") || []; }
    catch (e) { return []; }
  }
  function total() {
    return readCart().reduce(function (n, i) { return n + i.price * i.qty; }, 0);
  }

  var COUNTRIES = [
    // North America
    "United States","Canada","Mexico",
    // Europe
    "United Kingdom","Ireland","Germany","France","Italy","Spain","Portugal","Netherlands","Belgium","Luxembourg","Austria","Switzerland","Sweden","Norway","Denmark","Finland","Iceland","Poland","Czech Republic","Slovakia","Hungary","Romania","Bulgaria","Greece","Croatia","Slovenia","Serbia","Bosnia and Herzegovina","North Macedonia","Albania","Montenegro","Estonia","Latvia","Lithuania","Malta","Cyprus","Ukraine","Moldova","Georgia","Armenia",
    // Middle East
    "Turkey","Israel","United Arab Emirates","Saudi Arabia","Qatar","Kuwait","Bahrain","Oman","Jordan","Lebanon","Iraq",
    // Asia
    "India","Pakistan","Bangladesh","Sri Lanka","Nepal","China","Hong Kong","Taiwan","Japan","South Korea","Singapore","Malaysia","Thailand","Vietnam","Philippines","Indonesia","Kazakhstan","Uzbekistan",
    // Oceania
    "Australia","New Zealand","Fiji",
    // Africa
    "Cameroon","Nigeria","Ghana","Kenya","South Africa","Egypt","Morocco","Algeria","Tunisia","Libya","Ethiopia","Tanzania","Uganda","Rwanda","Senegal","Ivory Coast","Benin","Togo","Gabon","Congo","Democratic Republic of the Congo","Angola","Mozambique","Zambia","Zimbabwe","Botswana","Namibia","Mauritius","Madagascar","Sudan",
    // Latin America & Caribbean
    "Brazil","Argentina","Chile","Colombia","Peru","Venezuela","Ecuador","Bolivia","Paraguay","Uruguay","Costa Rica","Panama","Guatemala","Honduras","El Salvador","Nicaragua","Dominican Republic","Jamaica","Trinidad and Tobago",
    // Other
    "Other"
  ];

  var ship = null;

  /* ---------- boot ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    var cart = readCart();
    if (!cart.length) {
      $("#checkout-root").innerHTML =
        '<section class="section"><div class="wrap center" style="padding:70px 0">' +
          '<p class="eyebrow">Checkout</p>' +
          '<h1>Your order is empty</h1>' +
          '<p class="muted">Add compounds to your list and come back here to check out.</p>' +
          '<p class="mt-2"><a class="btn btn--primary" href="/products">Browse the catalogue</a></p>' +
        '</div></section>';
      return;
    }

    /* country list */
    var sel = $("#co-country");
    COUNTRIES.forEach(function (c) {
      var o = document.createElement("option");
      o.value = c; o.textContent = c; sel.appendChild(o);
    });

    renderSummary("co-items", "co-subtotal", "co-grand");
    renderSummary("co-items-2", "co-subtotal-2", "co-grand-2");

    /* restore anything typed before a reload */
    try {
      var saved = JSON.parse(localStorage.getItem(SHIP_KEY) || "null");
      if (saved) {
        ["name","email","org","addr1","addr2","city","state","post","country","phone","notes"].forEach(function (k) {
          var el = document.getElementById("co-" + k);
          if (el && saved[k]) el.value = saved[k];
        });
      }
    } catch (e) {}

    /* ---------- step 1 ---------- */
    $("#ship-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var data = {};
      ["name","email","org","addr1","addr2","city","state","post","country","phone","notes"].forEach(function (k) {
        var el = document.getElementById("co-" + k);
        data[k] = el ? el.value.trim() : "";
      });

      var missing = [];
      if (!data.name) missing.push("full name");
      if (!/^\S+@\S+\.\S+$/.test(data.email)) missing.push("a valid email");
      if (!data.addr1) missing.push("address line 1");
      if (!data.city) missing.push("city");
      if (!data.post) missing.push("postcode");
      if (!data.country) missing.push("country");

      var err = $("#co-error");
      if (missing.length) {
        err.hidden = false;
        err.textContent = "Please add " + missing.join(", ") + ".";
        err.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      err.hidden = true;

      ship = data;
      try { localStorage.setItem(SHIP_KEY, JSON.stringify(data)); } catch (e2) {}

      $("#step-details").hidden = true;
      $("#step-payment").hidden = false;
      $("#step-pill-1").classList.add("is-done");
      $("#step-pill-1").classList.remove("is-active");
      $("#step-pill-2").classList.add("is-active");
      window.scrollTo({ top: 0, behavior: "smooth" });

      refreshMailLinks();
      $("#btc-amount").textContent = btc(total() / USD_PER_BTC);
      $("#btc-open").setAttribute("href", "bitcoin:" + BTC_ADDRESS + "?amount=" + (total() / USD_PER_BTC).toFixed(8));
      $("#co-ship-to").innerHTML =
        '<p class="co-ship__label">Shipping to</p>' +
        "<p><b>" + esc(data.name) + "</b><br>" + esc(data.addr1) +
        (data.addr2 ? "<br>" + esc(data.addr2) : "") +
        "<br>" + esc(data.city) + (data.state ? ", " + esc(data.state) : "") + " " + esc(data.post) +
        "<br>" + esc(data.country) +
        '<span class="co-ship__email">' + esc(data.email) + "</span></p>";
    });

    $("#back-to-details").addEventListener("click", function () {
      $("#step-payment").hidden = true;
      $("#step-details").hidden = false;
      $("#step-pill-2").classList.remove("is-active");
      $("#step-pill-1").classList.add("is-active");
      $("#step-pill-1").classList.remove("is-done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    /* ---------- step 2 : payment choice ---------- */
    function choose(which) {
      ["btc", "email"].forEach(function (k) {
        var btn = $("#pay-" + k + "-btn");
        var panel = $("#pay-" + k + "-panel");
        var on = k === which;
        btn.setAttribute("aria-checked", String(on));
        btn.classList.toggle("is-selected", on);
        panel.hidden = !on;
      });
    }
    $("#pay-btc-btn").addEventListener("click", function () { choose("btc"); });
    $("#pay-email-btn").addEventListener("click", function () { choose("email"); });

    /* copy address */
    $("#btc-copy").addEventListener("click", function () {
      var btn = $("#btc-copy");
      var done = function () { btn.textContent = "Copied"; setTimeout(function () { btn.textContent = "Copy"; }, 1800); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(BTC_ADDRESS).then(done, function () { fallbackCopy(); });
      } else { fallbackCopy(); }
      function fallbackCopy() {
        var t = document.createElement("textarea");
        t.value = BTC_ADDRESS; t.setAttribute("readonly", "");
        t.style.position = "absolute"; t.style.left = "-9999px";
        document.body.appendChild(t); t.select();
        try { document.execCommand("copy"); done(); } catch (e) {}
        document.body.removeChild(t);
      }
    });

    /* ---------- order email builders ---------- */
    function orderLines() {
      return readCart().map(function (i) {
        return "- " + i.name + " — " + i.size + " — qty " + i.qty +
               " — " + money(i.price) + " each — " + money(i.price * i.qty);
      });
    }

    function shippingLines() {
      if (!ship) return [];
      return [
        "---", "",
        "Ship to:",
        ship.name,
        ship.org ? ship.org : null,
        ship.addr1,
        ship.addr2 ? ship.addr2 : null,
        ship.city + (ship.state ? ", " + ship.state : "") + " " + ship.post,
        ship.country,
        "Email: " + ship.email,
        ship.phone ? "Phone: " + ship.phone : null,
        ship.notes ? "Notes: " + ship.notes : null
      ].filter(function (l) { return l !== null; });
    }

    function emailHref() {
      var body = ["Hello Miro Biotech,", "",
        "I would like to place the following order:", "",
        orderLines().join("\n"), "",
        "Total: " + money(total()), ""]
        .concat(shippingLines())
        .concat(["", "Preferred payment: PayPal / CashApp / Zelle / Card — please send the details.", "", "Thank you,"])
        .join("\n");

      return "mailto:" + ORDER_EMAIL +
        "?subject=" + encodeURIComponent("Order — " + readCart().length + " item(s) — " + money(total())) +
        "&body=" + encodeURIComponent(body);
    }

    function btcHref() {
      var body = ["Hello Miro Biotech,", "",
        "I have paid the following order in Bitcoin and would like it confirmed.", "",
        orderLines().join("\n"), "",
        "Total: " + money(total()),
        "BTC amount sent (approx): " + btc(total() / USD_PER_BTC),
        "Bitcoin address used: " + BTC_ADDRESS,
        "Transaction ID (txid): ", "",]
        .concat(shippingLines())
        .concat(["", "Please confirm receipt and dispatch.", "", "Thank you,"])
        .join("\n");

      return "mailto:" + ORDER_EMAIL +
        "?subject=" + encodeURIComponent("Bitcoin order — " + money(total()) + " — txid enclosed") +
        "&body=" + encodeURIComponent(body);
    }

    /* Both confirm buttons are plain mailto links, so the order leaves from the
       customer's own mail app — no server, no stored data. */
    function refreshMailLinks() {
      var e = $("#email-confirm"), b = $("#btc-confirm");
      if (e) e.setAttribute("href", emailHref());
      if (b) b.setAttribute("href", btcHref());
    }
    refreshMailLinks();

    ["#email-confirm", "#btc-confirm"].forEach(function (sel) {
      var el = $(sel);
      if (el) el.addEventListener("click", function () {
        if (window.MiroShop && window.MiroShop.toast) window.MiroShop.toast("Opening your email app…");
      });
    });

  });

  /* ---------- summary rendering ---------- */
  function renderSummary(itemsId, subId, grandId) {
    var cart = readCart();
    var box = document.getElementById(itemsId);
    if (!box) return;
    box.innerHTML = cart.map(function (i) {
      return '<div class="co-item">' +
               (i.image ? '<img src="' + esc(i.image) + '" alt="" loading="lazy">' : "") +
               '<div class="co-item__body">' +
                 '<p class="co-item__name">' + esc(i.name) + "</p>" +
                 '<p class="co-item__meta">' + esc(i.size) + " &middot; qty " + i.qty +
                   (i.unit ? " &middot; " + money(i.unit) + "/vial" : "") + "</p>" +
               "</div>" +
               '<span class="co-item__price">' + money(i.price * i.qty) + "</span>" +
             "</div>";
    }).join("");
    var t = total();
    var s = document.getElementById(subId);
    var g = document.getElementById(grandId);
    if (s) s.textContent = money(t);
    if (g) g.textContent = money(t);
  }
})();
