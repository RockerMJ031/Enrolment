// Stripe Payment Element wrapper. Stripe.js loaded via <script src="https://js.stripe.com/v3/"> in index.html.
// Publishable key fetched from backend webMethod (which reads from Wix Secrets) — not hardcoded.
// First call lazy-fetches + caches; subsequent calls reuse the cached value.

import { call } from './bridge.js';

let _cachedPublishableKey = null;

async function getPublishableKey() {
  if (_cachedPublishableKey) return _cachedPublishableKey;
  const res = await call('api:getStripePublishableKey');
  if (!res || !res.publishableKey) {
    throw new Error('Stripe publishable key not returned by backend');
  }
  _cachedPublishableKey = res.publishableKey;
  return _cachedPublishableKey;
}

export async function initStripeElements(clientSecret) {
  if (!window.Stripe) throw new Error('Stripe.js not loaded — check <script src> in index.html');
  const pk = await getPublishableKey();
  const stripe = window.Stripe(pk);
  const elements = stripe.elements({ clientSecret, appearance: { theme: 'stripe' } });
  const paymentElement = elements.create('payment');
  paymentElement.mount('#stripe-payment-element');
  return { stripe, elements };
}

export async function confirmPayment(stripe, elements) {
  const result = await stripe.confirmPayment({
    elements,
    confirmParams: { return_url: window.location.origin + window.location.pathname + '?paid=1' },
    redirect: 'if_required',
  });
  return result;
}
