;import { config } from 'dotenv';
import path from 'path';

// `override: true` is critical when PM2 launches us: PM2's daemon caches the
// env it was first started with, and without override that stale env (e.g. an
// outdated DATABASE_URL) would silently win over the freshly-edited .env file
// the user sees and edits. We treat .env as the source of truth.
//
// Resolve relative to the running file's directory so the script works whether
// PM2 sets cwd to the backend root (BACKEND_DIR in ecosystem.config.js) or
// not. In dev (ts-node) __dirname is src/config; in prod (compiled) it's
// dist/config. Either way, ../../.env points to the package root.
const envPath = path.resolve(__dirname, '..', '..', '.env');
config({ path: envPath, override: true });

// Masked startup log so we can verify which DB host the running process is
// actually pointing at — invaluable when PM2 logs are the only thing to read.
const _dbUrl = process.env.DATABASE_URL || '';
const _masked = _dbUrl.replace(/(:\/\/[^:]+:)[^@]+(@)/, '$1***$2');
// eslint-disable-next-line no-console
console.log(`[config] Loaded .env from: ${envPath}`);
// eslint-disable-next-line no-console
console.log(`[config] DATABASE_URL = ${_masked || '(unset)'}`);

// const CREDENTIALS = process.env.CREDENTIALS === 'true'
export const {
  NODE_ENV, PORT, DB_URI,
  DB_HOST, DB_PORT, DB_NAME,
  DB_TYPE, HOST, DB_USER, DB_PASSWORD
  , LOG_FORMAT, LOG_DIR, GPT_KEY, SENDGRID_API_KEY,
  JWT_SECRET_KEY, JWT_EXPIRATION_HOURS, SENDER_NUMBER,
  TWILIO_SID, TWILIO_TOKEN, CONTENT_SID,
  JWT_ISSUER, JWT_REFRESH_TOKEN_EXPIRES,
  SENDER_EMAIL, JWT_ACCESS_TOKEN_EXPIRES,
  SMTP_HOSTNAME, SMTP_USERNAME, SMTP_PASSWORD, SMTP_PORT, SMTP_SECURE,
  APP_NAME, APP_URL, APP_LOGO, APP_EMAIL, BANK_NAME, BANK_CODE, COIN_MARKET_API_KEY
} = { ...process.env, APP_LOGO: '' } as any;

