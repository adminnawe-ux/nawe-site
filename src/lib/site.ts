export const SITE_NAME = 'Nawe';
export const SITE_DOMAIN = 'nawe.co.ke';
const DEFAULT_APP_URL = typeof window !== 'undefined' ? window.location.origin : `https://${SITE_DOMAIN}`;
export const APP_URL = import.meta.env.VITE_APP_URL ?? DEFAULT_APP_URL;
export const AUTH_REDIRECT_URL = `${APP_URL.replace(/\/$/, '')}/auth-redirect`;
export const SUPPORT_PHONE = '+254716231112';
export const SUPPORT_PHONE_TEL = 'tel:+254716231112';
export const SUPPORT_EMAIL = 'support@nawe.co.ke';
export const PRIVACY_EMAIL = 'privacy@nawe.co.ke';
