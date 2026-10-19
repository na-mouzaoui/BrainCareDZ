import pg from 'pg';
import { AsyncLocalStorage } from 'async_hooks';

const { Pool } = pg;

let pool = null;

interface UserContext {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  userPseudo: string;
  client?: pg.PoolClient;
  queue?: Promise<unknown>;
}

export const userContextStore = new AsyncLocalStorage<UserContext>();

const getPoolConfig = () => {
  const connectionString = process.env.DATABASE_URL;

  // Railway / production
  if (connectionString) {
    return { connectionString };
  }

  // Local development
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'BrainCare',
  };
};
export const getPool = () => {
  if (!pool) {
    pool = new Pool(getPoolConfig());
  }
  return pool;
};

// Exécute une requête sur la connexion dédiée à la requête HTTP, en sérialisant
// les appels concurrents (évite « client.query() when the client is already
// executing a query » tout en conservant le contexte app.user_* pour l'audit).
export const runOnClient = (ctx: UserContext, text: string, params: any[] = []) => {
  const run = () => ctx.client!.query(text, params);
  const previous = ctx.queue ?? Promise.resolve();
  const next = previous.then(run, run);
  ctx.queue = next.catch(() => undefined);
  return next;
};

export const query = async (text: string, params: any[] = []) => {
  const ctx = userContextStore.getStore();
  if (ctx?.client) {
    return runOnClient(ctx, text, params);
  }
  return getPool().query(text, params);
};

export const getClient = async () => {
  const ctx = userContextStore.getStore();
  if (ctx?.client) {
    return ctx.client;
  }
  return getPool().connect();
};

export const closePool = async () => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};

export const connectDB = async () => {
  try {
    console.log('[db] DATABASE_URL exists:', Boolean(process.env.DATABASE_URL));
    console.log('[db] DB_HOST exists:', Boolean(process.env.DB_HOST));
    console.log('[db] DB_PORT exists:', Boolean(process.env.DB_PORT));
    console.log('[db] DB_USER exists:', Boolean(process.env.DB_USER));
    console.log('[db] DB_NAME exists:', Boolean(process.env.DB_NAME));

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('SELECT 1');
      console.log('[db] PostgreSQL connected successfully');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[db] Cannot connect to PostgreSQL');
    console.error('[db] Full error:', error);
    process.exit(1);
  }
};