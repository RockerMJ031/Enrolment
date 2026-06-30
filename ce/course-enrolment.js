// course-enrolment — light-DOM Custom Element (FULL-BRIDGE probe).
//
// Read path (proven): Velo pushes a 'bootstrap' bundle via setAttribute; CE renders it.
// Write path (verifying): CE dispatches CustomEvent('rpcCall', {detail:{type,id,payload}}),
//   Velo replies via setAttribute('rpc-reply', {id, payload|error}). A "Test write (ping)"
//   button exercises this round-trip with no backend side effect.
//
// This site's CE: setAttribute works, getAttribute is MISSING, .on has been flaky (guarded
// on the Velo side). attributeChangedCallback can fire BEFORE connectedCallback, so attrs
// that arrive pre-render are stashed and applied once the shell exists.
//
// ?mock in the URL => offline standalone mode.

(function () {
  'use strict';
  var TAG = 'course-enrolment';
  if (customElements.get(TAG)) return;

  var MOCK = new URLSearchParams(location.search).has('mock');

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  class CourseEnrolment extends HTMLElement {
    static get observedAttributes() { return ['member', 'bootstrap', 'products', 'rpc-reply']; }

    constructor() {
      super();
      this._pending = new Map();
      this._member = null;
      var self = this;
      this._memberReady = new Promise(function (resolve) { self._memberResolve = resolve; });
      this._shellReady = false;
      this._bootstrapRaw = null;   // stash attrs that arrive before the shell is rendered
      this._productsRaw = null;
      this._addonsByProduct = {};  // kept for the full wizard port
      this._stripeKey = '';
    }

    connectedCallback() {
      this._renderShell();
      this._shellReady = true;
      if (this._bootstrapRaw != null) this._applyBootstrap(this._bootstrapRaw);
      else if (this._productsRaw != null) this._applyProducts(this._productsRaw);
      if (MOCK) {
        this._member = { name: 'Mock Commissioner', organisationName: 'Mock Academy Trust' };
        this._memberResolve(this._member);
      } else {
        var self = this;
        setTimeout(function () {
          if (!self._member) {
            self._setStatus("No 'member' attribute from Wix after 4s — site not re-published, " +
              "or element ID isn't #customElement1.", true);
          }
        }, 4000);
      }
      this._boot();
    }

    attributeChangedCallback(name, oldV, newV) {
      if (newV == null || newV === oldV) return;
      if (name === 'member') {
        try { this._member = JSON.parse(newV); this._memberResolve(this._member); } catch (e) { /* ignore */ }
      } else if (name === 'bootstrap') {
        this._bootstrapRaw = newV;
        if (this._shellReady) this._applyBootstrap(newV);
      } else if (name === 'products') {
        this._productsRaw = newV;
        if (this._shellReady) this._applyProducts(newV);
      } else if (name === 'rpc-reply') {
        var msg;
        try { msg = JSON.parse(newV); } catch (e) { return; }
        var p = this._pending.get(msg.id);
        if (p) {
          this._pending.delete(msg.id);
          if (p.timer) clearTimeout(p.timer);
          msg.error ? p.reject(new Error(msg.error)) : p.resolve(msg.payload);
        }
      }
    }

    // ---- WRITE bridge: CE -> Velo CustomEvent('rpcCall'); reply via setAttribute('rpc-reply') ----
    _rpc(type, payload) {
      payload = payload || {};
      if (MOCK) return this._mockCall(type, payload);
      var self = this;
      return new Promise(function (resolve, reject) {
        var id = (crypto.randomUUID && crypto.randomUUID()) ||
          ('req-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10));
        var rec = { resolve: resolve, reject: reject, timer: null };
        self._pending.set(id, rec);
        var attempts = 0, MAX = 6;
        function fire() {
          if (!self._pending.has(id)) return;
          attempts++;
          self.dispatchEvent(new CustomEvent('rpcCall', {
            detail: { type: type, id: id, payload: payload },
            bubbles: true, composed: true,
          }));
          rec.timer = setTimeout(attempts < MAX ? fire : function () {
            if (self._pending.has(id)) {
              self._pending.delete(id);
              reject(new Error(type + ': no reply after ' + MAX + ' tries (CE->Velo write channel down)'));
            }
          }, 2000);
        }
        fire();
      });
    }

    _mockCall(type, payload) {
      return new Promise(function (r) { setTimeout(r, 150); }).then(function () {
        if (type === 'api:listProducts') return fetch('../mock/products.json').then(function (r) { return r.json(); });
        if (type === 'ping') return { ok: true, echo: payload || null, from: 'mock' };
        throw new Error('mock: unknown type ' + type);
      });
    }

    _boot() {
      var self = this;
      this._memberReady.then(function () {
        self._setWelcome();
        if (MOCK) {
          self._setStatus('Member received — loading mock products…');
          self._mockCall('api:listProducts')
            .then(function (products) { self._renderProducts(products || []); })
            .catch(function (e) { self._setStatus('Mock load failed: ' + (e && e.message), true); });
        } else {
          self._setStatus('Member received — waiting for bootstrap from Wix…');
        }
      });
    }

    // ---- rendering (light DOM; styles scoped by the tag prefix) ----
    _renderShell() {
      this.innerHTML =
        '<style>' +
        'course-enrolment{display:block}' +
        'course-enrolment *{box-sizing:border-box}' +
        'course-enrolment .ce-root{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#1a1230;max-width:980px;margin:0 auto;padding:24px;line-height:1.45}' +
        'course-enrolment .ce-h{font-size:22px;font-weight:700;margin:0 0 4px}' +
        'course-enrolment .ce-sub{color:#6b6480;font-size:14px;margin:0 0 18px}' +
        'course-enrolment .ce-status{color:#6b6480;font-size:13px;padding:6px 0}' +
        'course-enrolment .ce-status.err{color:#b00020}' +
        'course-enrolment .ce-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}' +
        'course-enrolment .ce-card{border:1px solid #e7e3f0;border-radius:12px;padding:16px;background:#fff;box-shadow:0 1px 3px rgba(26,18,48,.06)}' +
        'course-enrolment .ce-card h3{margin:0 0 6px;font-size:16px}' +
        'course-enrolment .ce-card .price{color:#4b2fae;font-weight:700}' +
        'course-enrolment .ce-card .desc{color:#6b6480;font-size:13px;margin-top:6px}' +
        'course-enrolment .ce-btn{margin-top:14px;margin-right:8px;border:1px solid #4b2fae;background:#4b2fae;color:#fff;border-radius:8px;padding:9px 14px;font-size:14px;cursor:pointer}' +
        'course-enrolment .ce-btn.alt{background:#fff;color:#4b2fae}' +
        'course-enrolment .ce-rpcout{margin-top:10px;font-size:13px;font-family:ui-monospace,Menlo,monospace;white-space:pre-wrap}' +
        'course-enrolment .ce-rpcout.ok{color:#1a7f37}course-enrolment .ce-rpcout.err{color:#b00020}' +
        '</style>' +
        '<div class="ce-root">' +
        '<div class="ce-h">Course enrolment</div>' +
        '<div class="ce-sub" data-ce="welcome"></div>' +
        '<div class="ce-status" data-ce="status">Loading…</div>' +
        '<div class="ce-grid" data-ce="grid"></div>' +
        '<div>' +
        '<button class="ce-btn" data-ce="grow" type="button">Add a tall block (auto-height test)</button>' +
        '<button class="ce-btn alt" data-ce="rpc" type="button">Test write (ping)</button>' +
        '</div>' +
        '<div class="ce-rpcout" data-ce="rpcout"></div>' +
        '<div data-ce="tall"></div>' +
        '</div>';
      var self = this;
      this.querySelector('[data-ce="grow"]').addEventListener('click', function () { self._grow(); });
      this.querySelector('[data-ce="rpc"]').addEventListener('click', function () { self._testWrite(); });
    }

    _setWelcome() {
      var el = this.querySelector('[data-ce="welcome"]');
      if (!el) return;
      if (this._member && this._member.name) {
        el.textContent = 'Signed in as ' + this._member.name +
          (this._member.organisationName ? ' · ' + this._member.organisationName : '');
      } else {
        el.textContent = 'Member identity not yet received from Wix.';
      }
    }

    _setStatus(t, err) {
      var el = this.querySelector('[data-ce="status"]');
      if (el) { el.textContent = t; el.classList.toggle('err', !!err); }
    }

    _applyBootstrap(raw) {
      var b;
      try { b = JSON.parse(raw); } catch (e) { this._setStatus('Bad bootstrap payload', true); return; }
      if (b && b.error) { this._setStatus('Bootstrap failed: ' + b.error, true); return; }
      this._addonsByProduct = (b && b.addonsByProduct) || {};
      this._stripeKey = (b && b.stripeKey) || '';
      this._renderProducts((b && b.products) || []);
    }

    _applyProducts(raw) {
      var data;
      try { data = JSON.parse(raw); } catch (e) { this._setStatus('Bad products payload', true); return; }
      if (data && data.error) { this._setStatus('Products load failed: ' + data.error, true); return; }
      this._renderProducts(Array.isArray(data) ? data : []);
    }

    _renderProducts(products) {
      var grid = this.querySelector('[data-ce="grid"]');
      if (!grid) return;   // shell not ready — connectedCallback re-applies from the stash
      if (!products.length) { this._setStatus('No products returned.', true); return; }
      var addonCount = 0, self = this;
      products.forEach(function (p) { addonCount += ((self._addonsByProduct[p.productId] || []).length); });
      this._setStatus('Loaded ' + products.length + ' products' +
        (addonCount ? ' + ' + addonCount + ' add-ons' : '') +
        (this._stripeKey ? ' + Stripe key' : '') + ' from Wix.');
      grid.innerHTML = products.map(function (p) {
        var m = (p.configV2 && p.configV2.marketing) || {};
        var price = m.priceDisplay || (p.basePriceGbp != null ? '£' + p.basePriceGbp : '');
        return '<div class="ce-card"><h3>' + escapeHtml(p.displayName || p.productId) + '</h3>' +
          '<div class="price">' + escapeHtml(price) + '</div>' +
          '<div class="desc">' + escapeHtml(m.subtitle || p.description || '') + '</div></div>';
      }).join('');
    }

    _grow() {
      var tall = this.querySelector('[data-ce="tall"]');
      var block = document.createElement('div');
      block.style.cssText = 'height:600px;border:2px dashed #b9aee6;border-radius:12px;margin-top:14px;' +
        'display:flex;align-items:center;justify-content:center;color:#6b6480;font-size:14px';
      block.textContent = 'Tall block (+600px) — the Wix page should grow to fit, no inner scrollbar.';
      tall.appendChild(block);
    }

    _testWrite() {
      var out = this.querySelector('[data-ce="rpcout"]');
      out.className = 'ce-rpcout';
      out.textContent = 'Sending rpcCall ping → Velo…';
      var self = this;
      this._rpc('ping', { n: 1, hello: 'CE' })
        .then(function (reply) {
          out.className = 'ce-rpcout ok';
          out.textContent = '✅ WRITE round-trip OK. Velo replied: ' + JSON.stringify(reply);
        })
        .catch(function (e) {
          out.className = 'ce-rpcout err';
          out.textContent = '❌ WRITE failed: ' + (e && e.message);
        });
    }
  }

  customElements.define(TAG, CourseEnrolment);
})();
