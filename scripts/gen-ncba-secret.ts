/**
 * Generates a random NCBA_SECRET_KEY.
 *
 * NCBA hash spec:
 *   SHA256(secretKey + TransType + TransID + TransTime + TransAmount +
 *          BusinessShortCode + BillRefNumber + Mobile + name + "1")
 *   → hex string → Base64-encode the hex bytes
 *
 * The secret is a 32-byte random value encoded as a 64-char hex string,
 * which is a common format for HMAC secrets and printable/pasteable.
 *
 * Usage: deno run temp/gen-ncba-secret.ts
 */

const bytes = new Uint8Array(32);
crypto.getRandomValues(bytes);

const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');

console.log('\nNCBA_SECRET_KEY (hex, 64 chars):');
console.log(hex);
console.log('\nCopy this value into:');
console.log('  1. Supabase edge function secrets  →  NCBA_SECRET_KEY');
console.log('  2. The STK Push request letter you send to NCBA\n');
