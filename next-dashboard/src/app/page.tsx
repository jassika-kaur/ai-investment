'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  Search,
  TrendingUp,
  AlertTriangle,
  Briefcase,
  Globe,
  MapPin,
  Users,
  CheckCircle2,
  Loader2,
  Activity,
} from 'lucide-react';

interface ChartDataPoint {
  date: string;
  price: number;
}

interface ResultData {
  decision: string;
  confidence: number;
  reasoning: string;
  risk: string;
  growth: string;
  numbers: any;
  overview: any;
  chartData: ChartDataPoint[];
  news?: Array<{ title: string; summary: string }>;
  aiSummary?: string[];
  explainRecommendation?: string;
  followUpQuestions?: string[];
  timeline?: string[];
}

const TimelineStep = ({ title, active, completed }: { title: string; active: boolean; completed: boolean }) => (
  <div className={`flex items-center gap-3 ${active ? 'text-indigo-400' : completed ? 'text-emerald-400' : 'text-slate-600'}`}>
    {completed ? <CheckCircle2 className="w-5 h-5" /> : active ? <Loader2 className="w-5 h-5 animate-spin" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-600" />}
    <span className={`text-sm font-medium ${active && 'animate-pulse'}`}>{title}</span>
  </div>
);

export default function Dashboard() {
  const [company, setCompany] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [result, setResult] = useState<ResultData | null>(null);
  const [error, setError] = useState('');
  const [shares, setShares] = useState<number>(10);
  const [treatAsTicker, setTreatAsTicker] = useState(false);
  const [followUpInput, setFollowUpInput] = useState('');
  const [followUpQuestionsAsked, setFollowUpQuestionsAsked] = useState<string[]>([]);
  const [followUpAnswers, setFollowUpAnswers] = useState<Array<{ question: string; answer: string }>>([]);
  const [followUpLoading, setFollowUpLoading] = useState(false);

  useEffect(() => {
    if (isLoading) {
      const steps = [
        { time: 500, step: 1 },
        { time: 2000, step: 2 },
        { time: 4000, step: 3 },
        { time: 7000, step: 4 },
      ];

      const timeouts = steps.map((s) => setTimeout(() => setProgressStep(s.step), s.time));
      return () => timeouts.forEach(clearTimeout);
    }
    setProgressStep(0);
  }, [isLoading]);

  const handleResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim()) return;

    setIsLoading(true);
    setResult(null);
    setError('');

    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: company.trim(), treatAsTicker }),
      });

      if (!response.ok) throw new Error('Failed to fetch research data');

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setProgressStep(5);
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred during research.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatLargeNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined || Number.isNaN(num)) return 'Unknown';
    if (num >= 1e12) return '$' + (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return '$' + (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return '$' + (num / 1e6).toFixed(2) + 'M';
    return num.toLocaleString();
  };

  const formatPercent = (num: number | null | undefined) => {
    if (num === null || num === undefined || Number.isNaN(num)) return 'Unknown';
    return (num * 100).toFixed(2) + '%';
  };

  const handleFollowUpSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const question = followUpInput.trim();
    if (!question || !result) return;

    setFollowUpLoading(true);
    setError('');

    try {
      const response = await fetch('/api/follow-up', {
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
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-indigo-500/30">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center mb-12 space-y-6 pt-10">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-indigo-500" />
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              AI Investment Analyst
            </h1>
          </div>

          <form onSubmit={handleResearch} className="w-full max-w-2xl relative group">
            <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
            <div className="relative flex items-center bg-slate-900 border border-slate-800 rounded-full p-2 shadow-2xl overflow-hidden transition-all duration-300 focus-within:border-indigo-500/50 focus-within:bg-slate-900/90">
              <Search className="w-6 h-6 text-slate-400 ml-4" />
              <input
                type="text"
                placeholder="Enter company name or ticker (e.g. AAPL, Tesla)..."
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none px-4 py-3 text-lg text-white placeholder-slate-500"
                disabled={isLoading}
              />
              <label className="text-sm text-slate-400 mr-4 flex items-center gap-2">
                <input type="checkbox" checked={treatAsTicker} onChange={(e) => setTreatAsTicker(e.target.checked)} className="w-4 h-4" />
                Treat input as ticker
              </label>
              <button
                type="submit"
                disabled={isLoading || !company.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-full px-8 py-3 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Analyze'}
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <label className="text-sm text-slate-400">Shares:</label>
              <input
                type="number"
                min={1}
                value={shares}
                onChange={(e) => setShares(Number(e.target.value) || 0)}
                className="w-24 rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white"
              />
            </div>
          </form>
        </div>

        {error && (
          <div className="max-w-2xl mx-auto mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-center flex items-center justify-center gap-2">
            <AlertTriangle className="w-5 h-5" /> {error}
          </div>
        )}

        {isLoading && (
          <div className="max-w-xl mx-auto p-8 rounded-3xl bg-slate-900/50 border border-slate-800/50 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-lg font-medium mb-6 text-slate-300 flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" /> Agent Thinking Process
            </h3>
            <div className="space-y-4">
              <TimelineStep title="Identifying company and ticker symbol" active={progressStep === 0} completed={progressStep > 0} />
              <TimelineStep title="Collecting raw financial data (Revenue, Debt, Margins)" active={progressStep === 1} completed={progressStep > 1} />
              <TimelineStep title="Analyzing latest news and market sentiment" active={progressStep === 2} completed={progressStep > 2} />
              <TimelineStep title="Calculating risk and growth opportunities" active={progressStep === 3} completed={progressStep > 3} />
              <TimelineStep title="Synthesizing final investment recommendation" active={progressStep === 4} completed={progressStep > 4} />
            </div>
          </div>
        )}

        {result && !isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-in fade-in duration-700 slide-in-from-bottom-8">
            <div className="md:col-span-4 space-y-6">
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-center relative overflow-hidden group">
                <div className={`absolute inset-0 opacity-10 transition-opacity group-hover:opacity-20 ${result.decision.toLowerCase() === 'invest' ? 'bg-emerald-500' : result.decision.toLowerCase() === 'hold' ? 'bg-amber-500' : 'bg-red-500'}`} />
                <h3 className="text-sm font-medium text-slate-400 uppercase tracking-widest mb-2 z-10">AI Recommendation</h3>
                <div className={`text-5xl font-black uppercase tracking-tight z-10 ${result.decision.toLowerCase() === 'invest' ? 'text-emerald-400' : result.decision.toLowerCase() === 'hold' ? 'text-amber-400' : 'text-red-400'}`}>
                  {result.decision}
                </div>
                <div className="mt-4 inline-flex items-center gap-2 bg-slate-950/50 rounded-full px-4 py-1.5 border border-slate-800 z-10">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm font-medium text-slate-300">Confidence: <span className="text-white">{result.confidence}%</span></span>
                </div>
                <div className="mt-4 flex gap-3 z-10">
                  {result.overview?.ticker && <div className="text-sm text-slate-300">Ticker: <strong className="text-white">{result.overview.ticker}</strong></div>}
                </div>
              </div>

              {result.overview && (
                <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-indigo-400" /> Company Profile
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-2xl font-semibold">{result.overview.name}</h4>
                      <p className="text-sm text-slate-400">({result.overview.ticker})</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800/50">
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Industry</p>
                        <p className="text-sm font-medium text-slate-200">{result.overview.industry}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Sector</p>
                        <p className="text-sm font-medium text-slate-200">{result.overview.sector}</p>
                      </div>
                    </div>
                    <div className="space-y-3 pt-4 border-t border-slate-800/50">
                      <div className="flex items-center gap-3 text-sm text-slate-300">
                        <Users className="w-4 h-4 text-slate-500" /> {result.overview.ceo || 'Unknown'}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-slate-300">
                        <MapPin className="w-4 h-4 text-slate-500" /> {result.overview.headquarters || 'Unknown'}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-slate-300">
                        <Globe className="w-4 h-4 text-slate-500" />
                        <a
                          href={result.overview.website && result.overview.website !== 'Unknown' ? result.overview.website : '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-400 hover:underline truncate"
                        >
                          {result.overview.website && result.overview.website !== 'Unknown' ? result.overview.website.replace(/^https?:\/\//i, '') : 'Unknown'}
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-6 rounded-3xl bg-red-950/20 border border-red-900/30">
                <h3 className="text-lg font-bold text-red-400 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" /> Risk Analysis
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">{result.risk}</p>
              </div>
            </div>

            <div className="md:col-span-8 space-y-6">
              {result.numbers && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                    <p className="text-xs text-slate-500 uppercase font-medium mb-1">Current Price</p>
                    <p className="text-2xl font-semibold">{result.numbers.price !== null && result.numbers.price !== undefined ? `$${result.numbers.price.toFixed(2)}` : 'Unknown'}</p>
                    <p className={`text-sm mt-1 ${result.numbers.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {result.numbers.change !== null && result.numbers.change !== undefined ? `${result.numbers.change > 0 ? '+' : ''}${result.numbers.change.toFixed(2)}%` : 'Unknown'}
                    </p>
                  </div>
                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                    <p className="text-xs text-slate-500 uppercase font-medium mb-1">Market Cap</p>
                    <p className="text-xl font-semibold">{formatLargeNumber(result.numbers.marketCap)}</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                    <p className="text-xs text-slate-500 uppercase font-medium mb-1">Revenue</p>
                    <p className="text-xl font-semibold">{formatLargeNumber(result.numbers.revenue)}</p>
                    <p className="text-sm mt-1 text-slate-400">Growth: {formatPercent(result.numbers.revenueGrowth)}</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                    <p className="text-xs text-slate-500 uppercase font-medium mb-1">P/E Ratio</p>
                    <p className="text-xl font-semibold">{result.numbers.peRatio !== null && result.numbers.peRatio !== undefined ? Number(result.numbers.peRatio).toFixed(2) : 'Unknown'}</p>
                    <p className="text-sm mt-1 text-slate-400">EPS: {result.numbers.eps !== null && result.numbers.eps !== undefined ? `$${result.numbers.eps}` : 'Unknown'}</p>
                  </div>
                </div>
              )}

              {result.chartData && result.chartData.length > 0 && (
                <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-indigo-400" /> 6 Month Price History
                    </h3>
                  </div>
                  <div className="h-[300px] w-full -ml-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={result.chartData}>
                        <defs>
                          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="date" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(tick) => new Date(tick).toLocaleDateString(undefined, { month: 'short' })} tickMargin={10} minTickGap={30} />
                        <YAxis stroke="#64748b" domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(tick) => `$${tick}`} width={60} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#f8fafc' }} itemStyle={{ color: '#818cf8', fontWeight: 600 }} labelStyle={{ color: '#94a3b8', marginBottom: '4px' }} />
                        <Area type="monotone" dataKey="price" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorPrice)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm text-slate-400">Estimated Investment Value ({shares} shares)</h4>
                </div>
                <div className="h-[180px] w-full -ml-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={result.chartData.map((d) => ({ ...d, investment: Number((d.price * shares).toFixed(2)) }))}>
                      <defs>
                        <linearGradient id="colorInvest" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#0b1220" vertical={false} />
                      <XAxis dataKey="date" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(t) => new Date(t).toLocaleDateString(undefined, { month: 'short' })} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #0b1220', borderRadius: '8px', color: '#f8fafc' }} />
                      <Area type="monotone" dataKey="investment" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorInvest)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-3xl bg-emerald-950/20 border border-emerald-900/30">
                  <h3 className="text-lg font-bold text-emerald-400 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" /> Growth Catalysts
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">{result.growth}</p>
                </div>

                <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800">
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-indigo-400" /> Investment Thesis
                  </h3>
                  <div className="text-sm text-slate-300 leading-relaxed prose prose-invert prose-p:leading-relaxed max-w-none">
                    <ReactMarkdown>{result.reasoning}</ReactMarkdown>
                  </div>
                </div>
              </div>

              {result.aiSummary && result.aiSummary.length > 0 && (
                <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800">
                  <h3 className="text-lg font-bold mb-3">AI Summary</h3>
                  <ul className="list-disc list-inside text-sm text-slate-300 space-y-2">
                    {result.aiSummary.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              )}

              {result.news && result.news.length > 0 && (
                <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800">
                  <h3 className="text-lg font-bold mb-3">Latest News</h3>
                  <div className="space-y-3 text-sm text-slate-300">
                    {result.news.map((item) => (
                      <div key={item.title} className="border-b border-slate-800 pb-3 last:border-b-0 last:pb-0">
                        <strong>{item.title}</strong>
                        <p className="mt-1">{item.summary}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.followUpQuestions && result.followUpQuestions.length > 0 && (
                <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800">
                  <h3 className="text-lg font-bold mb-3">Ask Follow-up Questions</h3>
                  <form onSubmit={handleFollowUpSubmit} className="flex flex-col sm:flex-row gap-3 mb-4">
                    <input
                      type="text"
                      value={followUpInput}
                      onChange={(e) => setFollowUpInput(e.target.value)}
                      placeholder="Ask a follow-up question..."
                      className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none focus:border-indigo-500"
                    />
                    <button type="submit" disabled={followUpLoading} className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed">
                      {followUpLoading ? 'Answering...' : 'Ask'}
                    </button>
                  </form>
                  <ul className="list-disc list-inside text-sm text-slate-300 space-y-2">
                    {result.followUpQuestions.map((item) => (
                      <li key={item}>
                        <button type="button" onClick={() => setFollowUpInput(item)} className="text-left text-indigo-300 hover:text-indigo-200">
                          {item}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {followUpQuestionsAsked.length > 0 && (
                    <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                      <p className="text-sm font-semibold text-slate-200">Asked:</p>
                      <ul className="mt-2 list-disc list-inside text-sm text-slate-400 space-y-1">
                        {followUpQuestionsAsked.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                  )}
                  {followUpAnswers.length > 0 && (
                    <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                      <p className="text-sm font-semibold text-slate-200">Answers:</p>
                      <ul className="mt-2 space-y-2 text-sm text-slate-400">
                        {followUpAnswers.map((item) => <li key={`${item.question}-${item.answer}`}><span className="font-medium text-slate-200">{item.question}</span><br />{item.answer}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
