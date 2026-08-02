import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Add prisma client to the NodeJS global type
// Helps with managing connections in development with HMR
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not defined. Check that the backend .env file has been loaded."
  );
}

const schemaMatch = connectionString.match(/[?&]schema=([^&]+)/);
const schema = schemaMatch ? schemaMatch[1] : 'public';

const pool = new Pool({
  connectionString,
  options: `-c search_path=${schema}`,
});
const adapter = new PrismaPg(pool);
const prismaClient = global.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prismaClient;
}

process.on('beforeExit', async () => {
  await prismaClient.$disconnect();
});

export default prismaClient;
