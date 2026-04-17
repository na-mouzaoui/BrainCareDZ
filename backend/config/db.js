import pg from 'pg';

const { Pool } = pg;

let pool = null;

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
      database: process.env.DB_NAME || 'psychology_practice',
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
    database: 'psychology_practice',
  };
};

const getPool = () => {
  if (!pool) {
    pool = new Pool(getPoolConfig());
  }
  return pool;
};

export const query = (text, params = []) => getPool().query(text, params);

export const closePool = async () => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};

export const connectDB = async () => {
  try {
    await query('SELECT 1');
    console.log('PostgreSQL connected');
  } catch (error) {
    console.error(`PostgreSQL connection error: ${error.message}`);
    process.exit(1);
  }
};
