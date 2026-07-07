"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.ensureTable = ensureTable;
exports.getCache = getCache;
exports.setCache = setCache;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const connectionString = process.env.DATABASE_URL;
let pool = null;
exports.pool = pool;
if (connectionString) {
    exports.pool = pool = new pg_1.Pool({ connectionString });
}
async function ensureTable() {
    if (!pool)
        return;
    await pool.query(`
    CREATE TABLE IF NOT EXISTS market_cache (
      ticker TEXT PRIMARY KEY,
      fetched_at TIMESTAMP WITH TIME ZONE,
      numbers JSONB,
      chart JSONB
    )
  `);
}
async function getCache(ticker) {
    if (!pool)
        return null;
    const res = await pool.query('SELECT * FROM market_cache WHERE ticker = $1', [ticker]);
    if (res.rowCount === 0)
        return null;
    return res.rows[0];
}
async function setCache(ticker, numbers, chart) {
    if (!pool)
        return;
    const now = new Date();
    await pool.query(`INSERT INTO market_cache (ticker, fetched_at, numbers, chart)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (ticker) DO UPDATE SET fetched_at = EXCLUDED.fetched_at, numbers = EXCLUDED.numbers, chart = EXCLUDED.chart`, [ticker, now, numbers, chart]);
}
//# sourceMappingURL=cache.js.map