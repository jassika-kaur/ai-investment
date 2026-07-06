import { Pool } from 'pg';
declare let pool: Pool | null;
export declare function ensureTable(): Promise<void>;
export declare function getCache(ticker: string): Promise<any>;
export declare function setCache(ticker: string, numbers: any, chart: any): Promise<void>;
export { pool };
//# sourceMappingURL=cache.d.ts.map