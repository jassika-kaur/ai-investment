Setup
-----

1) Copy `.env.example` to `.env` and fill values (do NOT commit `.env`).

2) Recommended env vars:
- `ALPHA_VANTAGE_KEY` — your Alpha Vantage API key (optional but gives more reliable time series + fundamentals).
- `DATABASE_URL` — Postgres connection string to enable caching (optional).
- `GEMINI_API_KEY` — Google/Gemini API key used by the LangChain agent.

3) Install and run:

```bash
cd backend
npm install --legacy-peer-deps
npm run dev
```

Notes
-----
- The backend will attempt to use Alpha Vantage when `ALPHA_VANTAGE_KEY` is set, fall back to Yahoo Finance otherwise, and finally generate a synthetic fallback series if neither provider returns data.
- If you provide `DATABASE_URL` and a reachable Postgres instance, the server will create a `market_cache` table and cache results for 6 hours.
- Keep API keys private. Do not paste them into chat.

Troubleshooting
---------------
- If `marketCap` or `peRatio` remain empty, ensure the provider returned fundamentals or that `ALPHA_VANTAGE_KEY` is set. You can also restart the backend after updating `.env`.
- The code requires Node 18+ for the global `fetch` API.
