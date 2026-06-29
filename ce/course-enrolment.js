// course-enrolment — THIN light-DOM Custom Element (first-cut migration probe).
//
// Purpose: prove on the REAL Wix page that
//   (a) a light-DOM custom element registers + renders inside the Course Enrolment page,
//   (b) the bidirectional bridge works — CE -> Velo via CustomEvent, Velo -> CE via setAttribute,
//       reaching the real backend (listProducts) + member identity,
//   (c) the Wix page auto-grows when the element's content height changes (the "grow" button).
//
// Deliberately self-contained (NO es-module imports) so Wix can load it from a single
// source URL with no module-loader assumptions. The full 3400-line wizard port comes AFTER
// this thin cut verifies the mechanics on the live site.
//
// Mode: ?mock in the URL -> offline mock (standalone test harness). Otherwise -> live bridge.
// NOTE: we must NOT use `window.parent === window` for mock detection here — a light-DOM CE
// runs in the top window, so that check is always true. Mock is gated on ?mock only.

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
    static get observedAttributes() { return ['member', 'api-reply']; }

    constructor() {
      super();
      this._pending = new Map();
      this._member = null;
      var self = this;
      this._memberReady = new Promise(function (resolve) { self._memberResolve = resolve; });
    }

    connectedCallback() {
      this._renderShell();
      if (MOCK) {
        this._member = { name: 'Mock Commissioner', organisationName: 'Mock Academy Trust' };
        this._memberResolve(this._member);
      }
      this._boot();
    }

    attributeChangedCallback(name, oldV, newV) {
      if (newV == null || newV === oldV) return;
      if (name === 'member') {
        try { this._member = JSON.parse(newV); this._memberResolve(this._member); } catch (e) { /* ignore */ }
      } else if (name === 'api-reply') {
        var msg;
        try { msg = JSON.parse(newV); } catch (e) { return; }
        var p = this._pending.get(msg.id);
        if (p) {
          this._pending.delete(msg.id);
          msg.error ? p.reject(new Error(msg.error)) : p.resolve(msg.payload);
        }
      }
    }

    // ---- bridge: CE -> Velo (CustomEvent 'apiCall'), Velo -> CE (attribute 'api-reply') ----
    _call(type, payload) {
      payload = payload || {};
      if (MOCK) return this._mockCall(type, payload);
      var self = this;
      return new Promise(function (resolve, reject) {
        var id = (crypto.randomUUID && crypto.randomUUID()) ||
          ('req-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10));
        self._pending.set(id, { resolve: resolve, reject: reject });
        self.dispatchEvent(new CustomEvent('apiCall', { detail: { type: type, id: id, payload: payload } }));
        setTimeout(function () {
          if (self._pending.has(id)) { self._pending.delete(id); reject(new Error(type + ' timed out after 30s')); }
        }, 30000);
      });
    }

    _mockCall(type, payload) {
      return new Promise(function (r) { setTimeout(r, 150); }).then(function () {
        if (type === 'api:listProducts') return fetch('../mock/products.json').then(function (r) { return r.json(); });
        if (type === 'api:getMemberContext') return null;
        throw new Error('mock: unknown type ' + type);
      });
    }

    _boot() {
      var self = this;
      this._memberReady
        .then(function () { self._setWelcome(); return self._call('api:listProducts'); })
        .then(function (products) { self._renderProducts(products || []); })
        .catch(function (e) { self._setStatus('Boot failed: ' + (e && e.message), true); });
    }

    // ---- rendering (light DOM; styles scoped by the `course-enrolment` tag prefix) ----
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
        'course-enrolment .ce-btn{margin-top:18px;border:1px solid #4b2fae;background:#4b2fae;color:#fff;border-radius:8px;padding:9px 14px;font-size:14px;cursor:pointer}' +
        '</style>' +
        '<div class="ce-root">' +
        '<div class="ce-h">Course enrolment</div>' +
        '<div class="ce-sub" data-ce="welcome"></div>' +
        '<div class="ce-status" data-ce="status">Loading…</div>' +
        '<div class="ce-grid" data-ce="grid"></div>' +
        '<button class="ce-btn" data-ce="grow" type="button">Add a tall block (auto-height test)</button>' +
        '<div data-ce="tall"></div>' +
        '</div>';
      var self = this;
      this.querySelector('[data-ce="grow"]').addEventListener('click', function () { self._grow(); });
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

    _renderProducts(products) {
      var grid = this.querySelector('[data-ce="grid"]');
      if (!products.length) { this._setStatus('No products returned from backend.', true); return; }
      this._setStatus('Loaded ' + products.length + ' products from the backend bridge.');
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
      block.textContent = 'Tall block (+600px) — the Wix page should grow to fit, with NO inner scrollbar.';
      tall.appendChild(block);
    }
  }

  customElements.define(TAG, CourseEnrolment);
})();
