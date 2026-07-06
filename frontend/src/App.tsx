import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import './index.css';

interface ChartDataPoint {
  date: string;
  price: number;
}

interface NumbersData {
  price: number;
  change: number;
  marketCap: number;
  peRatio: number | null;
  revenue?: number | null;
  netProfit?: number | null;
  eps?: number | null;
  debtToEquity?: number | null;
  revenueGrowth?: number | null;
  profitMargin?: number | null;
  roe?: number | null;
  currency: string;
}

interface ResultData {
  decision: string;
  confidence?: number;
  reasoning: string;
  risk?: string;
  growth?: string;
  numbers: NumbersData | null;
  chartData: ChartDataPoint[];
  overview?: {
    name?: string;
    ticker?: string;
    industry?: string;
    sector?: string;
    ceo?: string;
    headquarters?: string;
    website?: string;
    description?: string;
  };
  news?: Array<{ title: string; summary: string }>;
  aiSummary?: string[];
  explainRecommendation?: string;
  followUpQuestions?: string[];
  timeline?: string[];
  metadata?: {
    ticker?: string;
    source?: string;
    lastUpdated?: string;
  };
}

function App() {
  const [shares, setShares] = useState<number>(10);
  const [company, setCompany] = useState('');
  const [treatAsTicker, setTreatAsTicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ResultData | null>(null);
  const [error, setError] = useState('');
  const [followUpInput, setFollowUpInput] = useState('');
  const [followUpQuestionsAsked, setFollowUpQuestionsAsked] = useState<string[]>([]);
  const [followUpAnswers, setFollowUpAnswers] = useState<Array<{ question: string; answer: string }>>([]);
  const [followUpLoading, setFollowUpLoading] = useState(false);

  const handleResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim()) return;

    setIsLoading(true);
    setResult(null);
    setError('');

    try {
      const response = await fetch('http://localhost:3001/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: company.trim(), treatAsTicker }),
      });

      if (!response.ok) {
        let body: any = null;
        try {
          body = await response.json();
        } catch (parseErr) {
          // ignore
        }
        const msg = body?.error || body?.message || `Request failed: ${response.status} ${response.statusText}`;
        throw new Error(msg);
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred during research.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatLargeNumber = (num?: number | null) => {
    if (num === null || num === undefined || Number.isNaN(num)) return 'Unknown';
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    return num.toLocaleString();
  };

  const handleFollowUpSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const question = followUpInput.trim();
    if (!question || !result) return;

    setFollowUpLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:3001/api/follow-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: result.overview?.name || company, question, result }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Unable to answer the follow-up question.');
      }

      const data = await response.json();
      setFollowUpQuestionsAsked((prev) => [...prev, question]);
      setFollowUpAnswers((prev) => [...prev, { question, answer: data.answer }]);
      setFollowUpInput('');
    } catch (err: any) {
      setError(err.message || 'Unable to answer the follow-up question.');
    } finally {
      setFollowUpLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div>
        <h1>AI Investment Agent</h1>
        <p className="subtitle">Enter a company name to get autonomous financial research & analysis.</p>
      </div>

      <form className="search-box" onSubmit={handleResearch}>
        <input
          type="text"
          className="search-input"
          placeholder="e.g. Apple, Tesla, Microsoft..."
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          disabled={isLoading}
        />
        <label style={{ marginLeft: 8, fontSize: 12, color: '#cbd5e1', display: 'flex', alignItems: 'center' }}>
          <input type="checkbox" checked={treatAsTicker} onChange={(e) => setTreatAsTicker(e.target.checked)} style={{ marginRight: 6 }} /> Treat input as ticker (e.g. AAPL)
        </label>
        <button type="submit" className="search-btn" disabled={isLoading || !company.trim()}>
          {isLoading ? 'Researching...' : 'Analyze'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      {isLoading && (
        <div className="loading-container">
          <div className="spinner"></div>
          <p className="loading-text">Agent is researching the web, fetching stock charts, and gathering sentiment...</p>
        </div>
      )}

      {result && !isLoading && (
        <div className="result-card">
          <div className="header-row">
            <div className={`decision-badge ${result.decision.toLowerCase() === 'invest' ? 'invest' : result.decision.toLowerCase() === 'hold' ? 'hold' : 'pass'}`}>
              {result.decision.toUpperCase()}
            </div>
            <div className="meta-badges">
              {result.metadata?.ticker && <div className="meta-item">Ticker: <strong>{result.metadata.ticker}</strong></div>}
              {result.metadata?.source && <div className="meta-item">Source: <strong>{result.metadata.source === 'fallback' ? 'Fallback (synthetic)' : result.metadata.source}</strong></div>}
              {result.metadata?.lastUpdated && <div className="meta-item">Updated: <strong>{new Date(result.metadata.lastUpdated).toLocaleString()}</strong></div>}
            </div>

            {result.numbers && (
              <div className="numbers-grid">
                <div className="number-stat">
                  <span>Price</span>
                  <strong>{result.numbers.price !== undefined && result.numbers.price !== null ? result.numbers.price.toFixed(2) : 'Unknown'} {result.numbers.currency || ''}</strong>
                </div>
                <div className="number-stat">
                  <span>24h Change</span>
                  <strong className={result.numbers.change >= 0 ? 'text-success' : 'text-danger'}>
                    {result.numbers.change > 0 ? '+' : ''}{result.numbers.change?.toFixed(2)}%
                  </strong>
                </div>
                <div className="number-stat">
                  <span>Market Cap</span>
                  <strong>{formatLargeNumber(result.numbers.marketCap)}</strong>
                </div>
                <div className="number-stat">
                  <span>P/E Ratio</span>
                  <strong>{typeof result.numbers.peRatio === 'number' ? result.numbers.peRatio.toFixed(2) : 'Unknown'}</strong>
                </div>
              </div>
            )}
          </div>

          {result.chartData && result.chartData.length > 0 && (
            <div className="chart-container">
              <h3>6 Month Historical Price</h3>
              {result.metadata?.source === 'fallback' && (
                <div className="warning-note">Note: Showing synthetic fallback data because live data was not available.</div>
              )}
              <div className="shares-input">
                <label>Shares:&nbsp;</label>
                <input
                  type="number"
                  min={1}
                  value={shares}
                  onChange={(e) => setShares(Number(e.target.value) || 0)}
                  style={{ width: 80 }}
                />
              </div>
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={340}>
                  <LineChart data={result.chartData.map((d) => ({ ...d, investment: Number((d.price * shares).toFixed(2)) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#94a3b8"
                      tickFormatter={(tick) => {
                        const d = new Date(tick);
                        return d.toLocaleDateString(undefined, { month: 'short' });
                      }}
                      minTickGap={30}
                    />
                    <YAxis stroke="#94a3b8" domain={['auto', 'auto']} tickFormatter={(tick) => `$${tick}`} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e1b4b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} itemStyle={{ color: '#6366f1' }} />
                    <Line type="monotone" dataKey="price" stroke="#6366f1" strokeWidth={3} dot={false} activeDot={{ r: 8 }} />
                    <Line type="monotone" dataKey="investment" stroke="#10b981" strokeWidth={2} dot={false} yAxisId="investment" />
                    <YAxis yAxisId="investment" orientation="right" stroke="#10b981" tickFormatter={(tick) => `$${tick}`} domain={['auto', 'auto']} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {result.overview && (
            <div className="reasoning-container">
              <h3>Company Overview</h3>
              <p><strong>{result.overview.name || 'Unknown'}</strong> • {result.overview.industry || 'Unknown'} • {result.overview.sector || 'Unknown'}</p>
              <p><strong>CEO:</strong> {result.overview.ceo || 'Unknown'}</p>
              <p><strong>Headquarters:</strong> {result.overview.headquarters || 'Unknown'}</p>
              <p><strong>Website:</strong> {result.overview.website || 'Unknown'}</p>
              <p>{result.overview.description}</p>
            </div>
          )}

          <div className="reasoning-container">
            <h3>AI Recommendation</h3>
            <p><strong>{result.decision}</strong> • Confidence: {result.confidence ?? 60}%</p>
            <ReactMarkdown>{result.reasoning}</ReactMarkdown>
          </div>

          {result.risk && (
            <div className="reasoning-container">
              <h3>Risk Analysis</h3>
              <p>{result.risk}</p>
            </div>
          )}

          {result.growth && (
            <div className="reasoning-container">
              <h3>Growth Opportunities</h3>
              <p>{result.growth}</p>
            </div>
          )}

          {result.aiSummary && result.aiSummary.length > 0 && (
            <div className="reasoning-container">
              <h3>AI Summary</h3>
              <ul>{result.aiSummary.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          )}

          {result.news && result.news.length > 0 && (
            <div className="reasoning-container">
              <h3>Latest News</h3>
              <ul>{result.news.map((item) => <li key={item.title}><strong>{item.title}</strong>: {item.summary}</li>)}</ul>
            </div>
          )}

          {result.followUpQuestions && result.followUpQuestions.length > 0 && (
            <div className="reasoning-container">
              <h3>Ask Follow-up Questions</h3>
              <form onSubmit={handleFollowUpSubmit} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  type="text"
                  value={followUpInput}
                  onChange={(e) => setFollowUpInput(e.target.value)}
                  placeholder="Ask a follow-up question..."
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid #475569' }}
                />
                <button type="submit" className="search-btn" style={{ padding: '8px 12px' }} disabled={followUpLoading}>
                  {followUpLoading ? 'Answering...' : 'Ask'}
                </button>
              </form>
              <ul>
                {result.followUpQuestions.map((item) => (
                  <li key={item}>
                    <button type="button" onClick={() => setFollowUpInput(item)} style={{ background: 'transparent', border: 'none', color: '#c7d2fe', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
              {followUpQuestionsAsked.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <strong>Asked:</strong>
                  <ul>{followUpQuestionsAsked.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              )}
              {followUpAnswers.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <strong>Answers:</strong>
                  <ul>{followUpAnswers.map((item) => <li key={`${item.question}-${item.answer}`}><strong>{item.question}</strong><br />{item.answer}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
