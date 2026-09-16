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
}

export const userContextStore = new AsyncLocalStorage<UserContext>();

const getPoolConfig = () => {
  const connectionString = process.env.DATABASE_URL;
  const hasDiscreteConfig = Boolean(
    process.env.DB_HOST || process.env.DB_PORT || process.env.DB_USER || process.env.DB_NAME
  );

  if (hasDiscreteConfig) {
    return {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'BrainCare',
    };
  }

  if (connectionString) {
    return { connectionString };
  }

  return {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'BrainCare',
  };
};

export const getPool = () => {
  if (!pool) {
    pool = new Pool(getPoolConfig());
    pool.on('connect', (client) => {
      client.query('SET search_path TO public').catch((error) => {
        void error;
      });
    });
  }
  return pool;
};

export const query = async (text: string, params: any[] = []) => {
  const ctx = userContextStore.getStore();
  if (ctx?.client) {
    return ctx.client.query(text, params);
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
    await query('SELECT 1');
  } catch (error) {
    process.exit(1);
  }
};
