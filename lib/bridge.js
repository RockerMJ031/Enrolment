// postMessage bridge: iframe ↔ parent Velo wrapper.
// Auto-detects mock mode when no parent window or ?mock=true.

const DEBUG = false;
const dbg = (...args) => { if (DEBUG) console.log('[bridge]', ...args); };

const pending = new Map();
const MOCK_MODE = window.parent === window || new URLSearchParams(location.search).has('mock');

let memberInfo = null;
const memberReady = new Promise((resolve) => {
  if (MOCK_MODE) {
    memberInfo = {
      memberId: 'mock-member-id',
      email: 'mock@purpleruler.com',
      name: 'Mock Commissioner',
      persona: 'academy_admin',
      organisationName: 'Mock Academy Trust',
    };
    resolve(memberInfo);
  } else {
    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'auth:member') {
        memberInfo = e.data.payload;
        resolve(memberInfo);
      }
    });
  }
});

window.addEventListener('message', (e) => {
  const { type, id, payload, error } = e.data || {};
  if (!type) return;
  if (type.endsWith(':reply') && pending.has(id)) {
    const { resolve, reject } = pending.get(id);
    pending.delete(id);
    error ? reject(new Error(error)) : resolve(payload);
  }
});

export function isMock() { return MOCK_MODE; }
export function getMember() { return memberReady; }

export function call(type, payload = {}) {
  if (MOCK_MODE) return mockCall(type, payload);
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID ? crypto.randomUUID() : `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    pending.set(id, { resolve, reject });
    dbg('send', type, id);
    window.parent.postMessage({ type, id, payload }, '*');
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`${type} timed out after 30s`));
      }
    }, 30000);
  });
}

export function navigate(to) {
  if (MOCK_MODE) { dbg('[mock] navigate to', to); return; }
  window.parent.postMessage({ type: 'ui:navigate', payload: { to } }, '*');
}

export function scrollOuterToTop() {
  if (MOCK_MODE) { try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) {} return; }
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) {}
  try { window.parent.postMessage({ type: 'ui:scrollTop' }, '*'); } catch (_) {}
}

// ====== Mock data loader ======
async function mockCall(type, payload) {
  await new Promise(r => setTimeout(r, 150));
  if (type === 'api:listProducts') {
    const res = await fetch('./mock/products.json');
    return res.json();
  }
  if (type === 'api:listAddons') {
    const res = await fetch('./mock/addons.json');
    const all = await res.json();
    return all.filter(a => a.productId === payload.productId);
  }
  if (type === 'api:getMemberContext') {
    return memberInfo;
  }
  if (type === 'api:submitEnrolment') {
    return {
      requestId: 'PR-REQ-MOCK01',
      status: payload.paymentPath === 'pay_stripe' ? 'pending_payment' : 'po_pending',
      clientSecret: payload.paymentPath === 'pay_stripe' ? 'pi_mock_secret_xxx' : null,
    };
  }
  if (type === 'api:getRequestStatus') {
    return {
      requestId: payload.requestId || 'PR-REQ-MOCK01',
      status: 'paid_pending_setup',
      paymentPath: 'pay_stripe',
      total: 1339.50,
      submittedAt: new Date().toISOString(),
      paidAt: new Date().toISOString(),
    };
  }
  if (type === 'api:getStripePublishableKey') {
    return { publishableKey: 'pk_test_MOCK_FAKE_KEY_FOR_LOCAL_DEV_ONLY' };
  }
  throw new Error(`mock: unknown type ${type}`);
}
