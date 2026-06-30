import { randomBytes } from 'crypto';

const username = 'nawe_ncba_' + randomBytes(4).toString('hex');
const password = randomBytes(16).toString('hex');

console.log('NCBA_WEBHOOK_USERNAME:', username);
console.log('NCBA_WEBHOOK_PASSWORD:', password);
