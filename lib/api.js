import { call } from './bridge.js';

export const listProducts = () => call('api:listProducts');
export const listAddons = (productId) => call('api:listAddons', { productId });
export const getMemberContext = () => call('api:getMemberContext');
export const submitEnrolment = (payload) => call('api:submitEnrolment', payload);
export const getRequestStatus = (requestId) => call('api:getRequestStatus', { requestId });
export const getStripePublishableKey = () => call('api:getStripePublishableKey');
