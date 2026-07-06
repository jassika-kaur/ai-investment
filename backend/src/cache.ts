import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
let pool: Pool | null = null;

if (connectionString) {
  pool = new Pool({ connectionString });
}

export async function ensureTable() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS market_cache (
      ticker TEXT PRIMARY KEY,
      fetched_at TIMESTAMP WITH TIME ZONE,
      numbers JSONB,
      chart JSONB
    )
  `);
}

export async function getCache(ticker: string) {
  if (!pool) return null;
  const res = await pool.query('SELECT * FROM market_cache WHERE ticker = $1', [ticker]);
  if (res.rowCount === 0) return null;
  return res.rows[0];
}

export async function setCache(ticker: string, numbers: any, chart: any) {
  if (!pool) return;
  const now = new Date();
  await pool.query(
    `INSERT INTO market_cache (ticker, fetched_at, numbers, chart)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (ticker) DO UPDATE SET fetched_at = EXCLUDED.fetched_at, numbers = EXCLUDED.numbers, chart = EXCLUDED.chart`,
    [ticker, now, numbers, chart]
  );
}

export { pool };
