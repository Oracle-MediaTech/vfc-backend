; import { config } from 'dotenv';
import path from 'path';

const envPath = path.resolve(__dirname, '..', '..', '.env');
config({ path: envPath, override: true });

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
  DB_TYPE, HOST, DB_USER, DB_PASSWORD,
  DATABASE_ID, SYNC_API_KEY, SYNC_REMOTE_URL,
  LOG_FORMAT, LOG_DIR, GPT_KEY, SENDGRID_API_KEY,
  JWT_SECRET_KEY, JWT_EXPIRATION_HOURS, SENDER_NUMBER,
  TWILIO_SID, TWILIO_TOKEN, CONTENT_SID,
  JWT_ISSUER, JWT_REFRESH_TOKEN_EXPIRES,
  SENDER_EMAIL, JWT_ACCESS_TOKEN_EXPIRES,
  SMTP_HOSTNAME, SMTP_USERNAME, SMTP_PASSWORD, SMTP_PORT, SMTP_SECURE,
  APP_NAME, APP_URL, APP_LOGO, APP_EMAIL, BANK_NAME, BANK_CODE, COIN_MARKET_API_KEY
} = { ...process.env, APP_LOGO: '' } as any;

