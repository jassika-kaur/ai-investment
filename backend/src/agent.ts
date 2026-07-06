import { StateGraph, Annotation } from '@langchain/langgraph';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { DuckDuckGoSearch } from '@langchain/community/tools/duckduckgo_search';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import YahooFinance from 'yahoo-finance2';
import dotenv from 'dotenv';
import { ensureTable, getCache, setCache } from './cache';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

function formatLargeNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'Unknown';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return value.toLocaleString();
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'Unknown';
  return `${value.toFixed(2)}%`;
}

function buildFallbackAnalysis(companyName: string, numbers: any, overview: any, researchData: string) {
  const price = numbers?.price ?? 0;
  const change = typeof numbers?.change === 'number' ? numbers.change : 0;
  const marketCap = numbers?.marketCap ?? 0;
  const marketCapFmt = marketCap >= 1e12 ? `${(marketCap / 1e12).toFixed(2)}T` : marketCap >= 1e9 ? `${(marketCap / 1e9).toFixed(2)}B` : marketCap >= 1e6 ? `${(marketCap / 1e6).toFixed(2)}M` : marketCap;
  const decision = (typeof change === 'number' && change > 0 && marketCap > 1e9) ? 'Invest' : (change > -5 ? 'Hold' : 'Pass');
  const confidence = decision === 'Invest' ? 72 : decision === 'Hold' ? 68 : 64;
  const risk = marketCap < 1e9
    ? `${companyName} shows a relatively small market cap and higher uncertainty, so downside risk is elevated.`
    : 'The company appears to have a reasonable scale, but valuation and sector risk should still be monitored carefully.';
  const growth = overview?.industry
    ? `${companyName} appears to operate in ${overview.industry}. This profile is consistent with a business that can benefit from product expansion, pricing power, or new market entry.`
    : 'Growth potential is tied to improving revenue trajectory, product expansion, and execution in the company’s core market.';
  const reasoning = `## Recommendation\n${decision === 'Invest' ? 'The company shows enough positive momentum and scale to merit an investment case.' : decision === 'Hold' ? 'The company is not clearly attractive yet, but the setup is stable enough to monitor before committing more capital.' : 'The current data does not support a bullish recommendation.'}\n\n- Current price: ${price.toFixed(2)}\n- 24h change: ${change > 0 ? '+' : ''}${change.toFixed(2)}%\n- Market cap: ${marketCapFmt}\n- Data source: ${researchData ? 'market data + recent research context' : 'market data only'}\n\nThis summary is generated from available quantitative data and a lightweight heuristic because the AI model was not fully available.`;

  return {
    decision,
    confidence,
    reasoning,
    risk,
    growth,
    aiSummary: [
      `${companyName} is tracked through price, market-cap, and valuation signals.`,
      `The current setup suggests ${decision.toLowerCase() === 'invest' ? 'a favorable outlook' : decision.toLowerCase() === 'hold' ? 'cautious optimism' : 'a conservative stance'}.`,
      `Momentum, valuation, and liquidity should be monitored before adding size.`,
    ],
    explainRecommendation: `${decision === 'Invest' ? 'We recommend INVEST because the company is showing positive momentum and a healthy market scale.' : decision === 'Hold' ? 'We recommend HOLD because the company is not yet showing a clear enough catalyst to justify a full investment case.' : 'We recommend PASS because the current data does not support a bullish position.'}`,
    followUpQuestions: [
      `Why is the risk profile for ${companyName} elevated?`,
      `Compare ${companyName} with a peer in the same sector.`,
      'What are the biggest growth catalysts right now?',
      'How does the current valuation compare to historical levels?',
    ],
    timeline: ['Company identified', 'Financial data collected', 'Risk and growth signals reviewed', 'Recommendation generated'],
  };
}

function extractNewsItems(researchData: string) {
  if (!researchData) {
    return [
      { title: 'Market context', summary: 'Recent headlines are not available right now, so the agent is using the latest market data snapshot.' },
    ];
  }

  const normalized = researchData
    .replace(/\r/g, '')
    .split(/\n|\s{2,}/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/Could not retrieve latest data\.?/i.test(line));

  const items = normalized.slice(0, 5).map((line, index) => ({
    title: `Signal ${index + 1}`,
    summary: line.length > 140 ? `${line.slice(0, 137)}...` : line,
  }));

  if (items.length === 0) {
    return [{ title: 'Market context', summary: 'No news snippets were returned by the search layer.' }];
  }

  return items;
}

function parseModelOutput(content: string | undefined, fallback: any) {
  if (!content) return fallback;

  const decisionMatch = content.match(/DECISION:\s*(Invest|Hold|Pass)/i);
  const decision = decisionMatch ? decisionMatch[1] : fallback.decision;

  const confidenceMatch = content.match(/CONFIDENCE:\s*(\d+)/i);
  const confidence = confidenceMatch ? Number(confidenceMatch[1]) : fallback.confidence;

  const riskMatch = content.match(/RISK:\s*(.*?)(?=GROWTH:|REASONING:|$)/is);
  const growthMatch = content.match(/GROWTH:\s*(.*?)(?=REASONING:|$)/is);
  const reasoningMatch = content.match(/REASONING:\s*(.*)/is);

  return {
    decision,
    confidence,
    reasoning: reasoningMatch ? (reasoningMatch[1]?.trim() ?? fallback.reasoning) : fallback.reasoning,
    risk: riskMatch ? (riskMatch[1]?.trim() ?? fallback.risk) : fallback.risk,
    growth: growthMatch ? (growthMatch[1]?.trim() ?? fallback.growth) : fallback.growth,
  };
}

async function generateFollowUpAnswer(question: string, companyName: string, result: any) {
  const name = companyName || result?.overview?.name || 'the company';
  const q = question.toLowerCase();

  const fallbackAnswer = (() => {
    if (q.includes('risk')) {
      return result?.risk || `The main risk for ${name} appears to be valuation sensitivity and execution risk.`;
    }
    if (q.includes('growth') || q.includes('catalyst') || q.includes('opportunity')) {
      return result?.growth || `Growth potential for ${name} appears to be tied to product expansion, market-share gains, and execution.`;
    }
    if (q.includes('price') || q.includes('valuation') || q.includes('pe')) {
      return `The latest context points to a price of ${result?.numbers?.price ?? 'Unknown'} and a P/E ratio of ${result?.numbers?.peRatio ?? 'Unknown'}.`;
    }
    if (q.includes('news') || q.includes('latest')) {
      return result?.news?.[0]?.summary || `Recent headlines are limited, but the current research still supports a measured outlook.`;
    }

    const summary = result?.reasoning ? result.reasoning.replace(/\n+/g, ' ').slice(0, 220) : '';
    return summary
      ? `Based on the latest analysis for ${name}, ${summary}...`
      : `The current research for ${name} suggests a balanced outlook, and the investment case should be monitored against price, valuation, and execution updates.`;
  })();

  try {
    const model = getModel();
    const response = await model.invoke([
      new SystemMessage('You are a concise investment research assistant. Answer the user question using the provided research context. Keep the reply brief, practical, and grounded in the data.'),
      new HumanMessage(`Company: ${name}\nQuestion: ${question}\nResearch Summary: ${result?.reasoning || 'No summary available.'}\nRisk: ${result?.risk || 'Unknown'}\nGrowth: ${result?.growth || 'Unknown'}\nNumbers: ${JSON.stringify(result?.numbers || {})}`),
    ]);

    const content = response.content.toString().trim();
    return content || fallbackAnswer;
  } catch (error) {
    console.warn('Follow-up answer generation failed, using fallback:', error);
    return fallbackAnswer;
  }
}

export async function answerFollowUpQuestion(question: string, companyName: string, result: any) {
  return generateFollowUpAnswer(question, companyName, result);
}

// Define the state for the LangGraph
const StateAnnotation = Annotation.Root({
  companyName: Annotation<string>(),
  researchData: Annotation<string>(),
  financialData: Annotation<string>(),
  decision: Annotation<string>(),
  reasoning: Annotation<string>(),
});

// Initialize the Gemini model
const getModel = () => {
  if (process.env.GEMINI_API_KEY) {
    process.env.GOOGLE_API_KEY = process.env.GEMINI_API_KEY;
  }
  return new ChatGoogleGenerativeAI({
    model: 'gemini-flash-latest',
    temperature: 0.2,
  });
};

// Node: Research
const researchNode = async (state: typeof StateAnnotation.State) => {
  const { companyName } = state;
  const tool = new DuckDuckGoSearch({ maxResults: 5 });

  const query = `${companyName} stock market news latest financial earnings sentiment`;
  let researchData = '';
  try {
    researchData = await tool.invoke(query);
  } catch (error) {
    console.error('Error during search:', error);
    researchData = 'Could not retrieve latest data. Relying on general knowledge.';
  }

  return { researchData };
};

// Node: Analyze and Decide
const analyzeNode = async (state: typeof StateAnnotation.State) => {
  const { companyName, researchData, financialData } = state;
  const model = getModel();

  const systemPrompt = `You are an expert AI Investment Research Agent.
Your task is to analyze the provided recent information and financial numbers about a company and make a clear investment decision: "Invest", "Hold", or "Pass".
Provide a detailed reasoning behind your decision, focusing on financials, market sentiment, and recent news.
Output your response in the following strict format:

DECISION: [Invest, Hold, or Pass]
CONFIDENCE: [0-100]
RISK: [short risk analysis]
GROWTH: [short growth analysis]
REASONING:
[Your detailed reasoning here in Markdown format]`;

  const humanPrompt = `Company: ${companyName}\nRecent Research Data:\n${researchData}\n\nFinancial Data:\n${financialData}\n\nPlease analyze and decide.`;

  const response = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(humanPrompt),
  ]);

  const content = response.content.toString();
  return parseModelOutput(content, {
    decision: 'Pass',
    confidence: 60,
    reasoning: 'Unable to produce a full AI analysis.',
    risk: 'Risk analysis unavailable.',
    growth: 'Growth analysis unavailable.',
  });
};

// Define and compile the graph
const workflow = new StateGraph(StateAnnotation)
  .addNode('research', researchNode)
  .addNode('analyze', analyzeNode)
  .addEdge('__start__', 'research')
  .addEdge('research', 'analyze')
  .addEdge('analyze', '__end__');

const app = workflow.compile();

dotenv.config();

async function fetchAlphaVantage(ticker: string) {
  const key = process.env.ALPHA_VANTAGE_KEY;
  if (!key) throw new Error('No Alpha Vantage key');

  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${encodeURIComponent(ticker)}&outputsize=full&apikey=${key}`;
  const res = await fetch(url);
  const data = await res.json();
  const series = data['Time Series (Daily)'];
  if (!series) throw new Error('Alpha Vantage returned no series');

  const entries = Object.keys(series).map((date) => ({ date, price: Number(series[date]['4. close']) }));
  entries.sort((a, b) => a.date.localeCompare(b.date));
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const filtered = entries.filter((entry) => new Date(entry.date) >= sixMonthsAgo);

  const latestEntry = entries[entries.length - 1];
  const prevEntry = entries[entries.length - 2];
  const latestPrice = latestEntry ? latestEntry.price : null;
  const previousPrice = prevEntry ? prevEntry.price : null;

  let marketCap: number | null = null;
  let peRatio: number | null = null;
  try {
    const ovUrl = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(ticker)}&apikey=${key}`;
    const ovRes = await fetch(ovUrl);
    const ov = await ovRes.json();
    if (ov && ov.MarketCapitalization) marketCap = Number(ov.MarketCapitalization);
    if (ov && ov.PERatio) peRatio = Number(ov.PERatio);
  } catch (err) {
    console.warn('Alpha Vantage overview fetch failed:', err);
  }

  return { chartData: filtered, latestPrice, previousPrice, marketCap, peRatio };
}

async function enrichFundamentalsFromYahoo(ticker: string, numbers: any) {
  try {
    const q: any = await yahooFinance.quote(ticker);
    if (q) {
      if (q.marketCap) numbers.marketCap = q.marketCap;
      if (q.trailingPE !== undefined && q.trailingPE !== null) numbers.peRatio = q.trailingPE;
      if (q.currency) numbers.currency = q.currency;
      if (q.regularMarketChangePercent !== undefined && q.regularMarketChangePercent !== null) numbers.change = q.regularMarketChangePercent;
      if (q.regularMarketPrice !== undefined && q.regularMarketPrice !== null) numbers.price = q.regularMarketPrice;
    }
  } catch (err) {
    // ignore enrichment failures
  }
}

async function fetchOverviewAndFinancials(ticker: string, companyName: string) {
  const overview = {
    name: companyName,
    ticker,
    industry: 'Unknown',
    sector: 'Unknown',
    ceo: 'Unknown',
    headquarters: 'Unknown',
    website: 'Unknown',
    description: 'Company profile is being filled from available market data.',
  };

  const numbers: Record<string, any> = {};

  try {
    const quoteSummary: any = await yahooFinance.quoteSummary(ticker, {
      modules: ['price', 'assetProfile', 'financialData', 'defaultKeyStatistics'],
    });

    const profile = quoteSummary.assetProfile;
    const financials = quoteSummary.financialData;
    const stats = quoteSummary.defaultKeyStatistics;
    const price = quoteSummary.price;

    overview.name = price?.shortName || companyName;
    overview.industry = profile?.industry || 'Unknown';
    overview.sector = profile?.sector || 'Unknown';
    overview.ceo = profile?.companyOfficers?.[0]?.name || 'Unknown';
    overview.headquarters = [profile?.city, profile?.country].filter(Boolean).join(', ') || 'Unknown';
    overview.website = profile?.website || 'Unknown';
    overview.description = profile?.longBusinessSummary || 'No description available.';

    numbers.price = price?.regularMarketPrice ?? null;
    numbers.change = price?.regularMarketChangePercent ?? null;
    numbers.marketCap = price?.marketCap ?? null;
    numbers.peRatio = price?.regularMarketTrailingPE ?? null;
    numbers.currency = price?.currency || 'USD';
    numbers.revenue = financials?.totalRevenue ?? null;
    numbers.netProfit = financials?.netIncomeToCommon ?? null;
    numbers.eps = stats?.trailingEps ?? null;
    numbers.debtToEquity = financials?.debtToEquity ?? null;
    numbers.revenueGrowth = financials?.revenueGrowth ?? null;
    numbers.profitMargin = financials?.profitMargins ?? null;
    numbers.roe = financials?.returnOnEquity ?? null;
  } catch (err) {
    console.warn('Overview enrichment failed:', err);
  }

  return { overview, numbers };
}

export const runResearchAgent = async (companyName: string, treatAsTicker = false) => {
  let financialString = 'No quantitative financial data available.';
  let chartData: any[] = [];
  let numbers: Record<string, any> | null = null;
  let overview: Record<string, any> | null = null;
  let metadata: { ticker?: string; source?: string; lastUpdated?: string } | undefined = undefined;
  let researchData = '';

  metadata = { ticker: companyName, source: 'fallback', lastUpdated: new Date().toISOString() };

  await ensureTable();

  try {
    const maybeTicker = companyName.trim();
    const isLikelyTicker = /^[A-Za-z\.]{1,6}$/.test(maybeTicker) && maybeTicker.toUpperCase() === maybeTicker;
    const preferTicker = treatAsTicker || isLikelyTicker;
    let searchResult: any = { quotes: [] };

    if (preferTicker) {
      try {
        const ticker = maybeTicker;
        const cached = await getCache(ticker);
        if (cached) {
          const fetchedAt = new Date(cached.fetched_at);
          const ageMs = Date.now() - fetchedAt.getTime();
          const sixHours = 1000 * 60 * 60 * 6;
          if (ageMs < sixHours) {
            numbers = cached.numbers;
            chartData = cached.chart;
            metadata = { ticker, source: 'cache', lastUpdated: fetchedAt.toISOString() };
            if ((!numbers?.marketCap || numbers.marketCap === 0) || (numbers?.peRatio === null || numbers?.peRatio === undefined)) {
              await enrichFundamentalsFromYahoo(ticker, numbers);
              await setCache(ticker, numbers, chartData);
            }
          }
        }

        if ((!chartData || chartData.length === 0) && process.env.ALPHA_VANTAGE_KEY) {
          try {
            const av = await fetchAlphaVantage(ticker);
            chartData = av.chartData;
            const change = (av.previousPrice && av.latestPrice) ? ((av.latestPrice - av.previousPrice) / av.previousPrice) * 100 : 0;
            numbers = numbers || { price: av.latestPrice, change, marketCap: av.marketCap ?? 0, peRatio: av.peRatio ?? null, currency: 'USD' };
            if ((!numbers.marketCap || numbers.marketCap === 0) || (numbers.peRatio === null || numbers.peRatio === undefined)) {
              await enrichFundamentalsFromYahoo(ticker, numbers);
            }
            metadata = { ticker, source: 'alpha-vantage', lastUpdated: new Date().toISOString() };
            await setCache(ticker, numbers, chartData);
          } catch (err) {
            console.error('AlphaVantage fetch failed:', err);
          }
        }

        if (!chartData || chartData.length === 0) {
          const quote: any = await yahooFinance.quote(ticker);
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
          const today = new Date();
          const queryOptions = { period1: sixMonthsAgo, period2: today, interval: '1d' as const };
          const historical: any = await yahooFinance.historical(ticker, queryOptions);

          numbers = {
            price: quote.regularMarketPrice,
            change: quote.regularMarketChangePercent,
            marketCap: quote.marketCap,
            peRatio: quote.trailingPE,
            currency: quote.currency,
          };

          chartData = historical.map((day: any) => ({ date: day.date.toISOString().split('T')[0], price: day.close }));
          metadata = { ticker, source: 'yahoo', lastUpdated: new Date().toISOString() };
          await setCache(ticker, numbers, chartData);
        }
      } catch (err) {
        console.error('Direct ticker fetch failed, falling back to search:', err);
      }
    }

    if (!chartData || chartData.length === 0) {
      searchResult = await yahooFinance.search(companyName);
    }

    if (searchResult.quotes && searchResult.quotes.length > 0) {
      const quotes = searchResult.quotes;
      const preferred = quotes.find((quote: any) => {
        const exch = (quote.exchange || quote.exch || '').toString().toUpperCase();
        return exch.includes('NASDAQ') || exch === 'NMS' || exch.includes('NYSE') || exch.includes('ARCA');
      });
      const ticker = (preferred && preferred.symbol) || quotes[0].symbol;
      const cached = await getCache(ticker);
      if (cached) {
        const fetchedAt = new Date(cached.fetched_at);
        const ageMs = Date.now() - fetchedAt.getTime();
        const sixHours = 1000 * 60 * 60 * 6;
        if (ageMs < sixHours) {
          numbers = cached.numbers;
          chartData = cached.chart;
          metadata = { ticker, source: 'cache', lastUpdated: fetchedAt.toISOString() };
          if ((!numbers?.marketCap || numbers.marketCap === 0) || (numbers?.peRatio === null || numbers?.peRatio === undefined)) {
            await enrichFundamentalsFromYahoo(ticker, numbers);
            await setCache(ticker, numbers, chartData);
          }
        }
      }

      if (!chartData || chartData.length === 0) {
        if (process.env.ALPHA_VANTAGE_KEY) {
          try {
            const av = await fetchAlphaVantage(ticker);
            chartData = av.chartData;
            const change = (av.previousPrice && av.latestPrice) ? ((av.latestPrice - av.previousPrice) / av.previousPrice) * 100 : 0;
            numbers = numbers || { price: av.latestPrice, change, marketCap: av.marketCap ?? 0, peRatio: av.peRatio ?? null, currency: 'USD' };
            metadata = { ticker, source: 'alpha-vantage', lastUpdated: new Date().toISOString() };
            await setCache(ticker, numbers, chartData);
          } catch (err) {
            console.error('AlphaVantage fetch failed for search ticker:', err);
          }
        }
      }

      if (!chartData || chartData.length === 0) {
        const quote: any = await yahooFinance.quote(ticker);
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const today = new Date();
        const queryOptions = { period1: sixMonthsAgo, period2: today, interval: '1d' as const };
        const historical: any = await yahooFinance.historical(ticker, queryOptions);

        numbers = {
          price: quote.regularMarketPrice,
          change: quote.regularMarketChangePercent,
          marketCap: quote.marketCap,
          peRatio: quote.trailingPE,
          currency: quote.currency,
        };

        financialString = `Ticker: ${ticker}\nPrice: ${quote.regularMarketPrice} ${quote.currency}\nP/E Ratio: ${quote.trailingPE}\nMarket Cap: ${quote.marketCap}`;
        chartData = historical.map((day: any) => ({ date: day.date.toISOString().split('T')[0], price: day.close }));
        metadata = { ticker, source: 'yahoo', lastUpdated: new Date().toISOString() };
        if ((!numbers.marketCap || numbers.marketCap === 0) || (numbers.peRatio === null || numbers.peRatio === undefined)) {
          await enrichFundamentalsFromYahoo(ticker, numbers);
        }
        await setCache(ticker, numbers, chartData);
      }
    }
  } catch (err) {
    console.error('Failed to fetch yahoo finance data:', err);
  }

  if (!chartData || chartData.length === 0) {
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const days: Date[] = [];
    for (let d = new Date(sixMonthsAgo); d <= today; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }

    const basePrice = numbers?.price ?? 100;
    chartData = days.map((dt, index) => {
      const noise = Math.sin(index / 10) * 2 + (Math.random() - 0.5) * 1.5;
      const drift = index * (basePrice * 0.0005);
      const price = Number((basePrice + drift + noise).toFixed(2));
      return { date: dt.toISOString().split('T')[0], price };
    });

    if (!numbers) {
      const lastPrice = chartData[chartData.length - 1].price;
      const prevPrice = chartData.length > 1 ? chartData[chartData.length - 2].price : null;
      const change = prevPrice ? ((lastPrice - prevPrice) / prevPrice) * 100 : 0;
      numbers = {
        price: lastPrice,
        change,
        marketCap: 0,
        peRatio: null,
        currency: 'USD',
      } as any;
      try {
        if (metadata?.ticker) {
          await enrichFundamentalsFromYahoo(metadata.ticker, numbers);
        }
      } catch (err) {
        // ignore
      }
    }
    metadata = { ticker: metadata?.ticker || companyName, source: 'fallback', lastUpdated: new Date().toISOString() };
  }

  const searchTool = new DuckDuckGoSearch({ maxResults: 5 });
  try {
    researchData = await searchTool.invoke(`${companyName} stock market news latest financial earnings sentiment`);
  } catch (err) {
    console.error('Research search failed:', err);
    researchData = '';
  }

  if (metadata?.ticker) {
    const overviewPayload = await fetchOverviewAndFinancials(metadata.ticker, companyName);
    overview = overviewPayload.overview;
    numbers = {
      ...(numbers || {}),
      ...(overviewPayload.numbers || {}),
      price: numbers?.price ?? overviewPayload.numbers?.price ?? null,
      change: numbers?.change ?? overviewPayload.numbers?.change ?? null,
      marketCap: numbers?.marketCap ?? overviewPayload.numbers?.marketCap ?? 0,
      peRatio: numbers?.peRatio ?? overviewPayload.numbers?.peRatio ?? null,
      currency: numbers?.currency ?? overviewPayload.numbers?.currency ?? 'USD',
    };
    financialString = `Ticker: ${metadata.ticker}\nPrice: ${numbers.price} ${numbers.currency}\nMarket Cap: ${numbers.marketCap}\nP/E Ratio: ${numbers.peRatio}\nRevenue: ${numbers.revenue}\nNet Profit: ${numbers.netProfit}\nEPS: ${numbers.eps}\nDebt to Equity: ${numbers.debtToEquity}\nRevenue Growth: ${numbers.revenueGrowth}\nProfit Margin: ${numbers.profitMargin}\nROE: ${numbers.roe}`;
  }

  const initialState = {
    companyName,
    researchData,
    financialData: financialString,
    decision: '',
    reasoning: '',
  };

  let modelResult: any = null;
  try {
    modelResult = await app.invoke(initialState);
  } catch (err: any) {
    console.error('Model invocation failed, continuing with available data. Error stack:', err && err.stack ? err.stack : err);
    modelResult = null;
  }

  try {
    if (metadata?.ticker && numbers && ((!numbers.marketCap || numbers.marketCap === 0) || (numbers.peRatio === null || numbers.peRatio === undefined))) {
      await enrichFundamentalsFromYahoo(metadata.ticker, numbers);
      if (metadata.ticker) await setCache(metadata.ticker, numbers, chartData);
    }
  } catch (err) {
    // ignore enrichment errors
  }

  try {
    if (metadata?.ticker && numbers) {
      const q: any = await yahooFinance.quote(metadata.ticker);
      if (q) {
        if (q.marketCap) numbers.marketCap = q.marketCap;
        if (q.trailingPE !== undefined && q.trailingPE !== null) numbers.peRatio = q.trailingPE;
        if (q.currency) numbers.currency = q.currency;
        await setCache(metadata.ticker, numbers, chartData);
      }
    }
  } catch (err) {
    // ignore
  }

  const fallbackAnalysis = buildFallbackAnalysis(companyName, numbers, overview, researchData);
  const aiOutput = modelResult ? parseModelOutput(modelResult.reasoning, fallbackAnalysis) : fallbackAnalysis;
  const newsItems = extractNewsItems(researchData);

  const decision = (modelResult?.decision || aiOutput?.decision || fallbackAnalysis.decision).toString();
  const reasoning = (typeof modelResult?.reasoning === 'string' && modelResult.reasoning.trim())
    ? modelResult.reasoning
    : (typeof aiOutput?.reasoning === 'string' && aiOutput.reasoning.trim())
      ? aiOutput.reasoning
      : fallbackAnalysis.reasoning;

  return {
    decision,
    confidence: typeof aiOutput?.confidence === 'number' ? aiOutput.confidence : fallbackAnalysis.confidence,
    reasoning,
    risk: aiOutput?.risk || fallbackAnalysis.risk,
    growth: aiOutput?.growth || fallbackAnalysis.growth,
    numbers,
    chartData,
    metadata,
    overview: overview || {
      name: companyName,
      ticker: metadata?.ticker || companyName,
      industry: 'Unknown',
      sector: 'Unknown',
      ceo: 'Unknown',
      headquarters: 'Unknown',
      website: 'Unknown',
      description: 'The agent is using a fallback summary because extra profile details were not available.',
    },
    news: newsItems,
    aiSummary: fallbackAnalysis.aiSummary,
    explainRecommendation: aiOutput?.explainRecommendation || fallbackAnalysis.explainRecommendation,
    followUpQuestions: fallbackAnalysis.followUpQuestions,
    timeline: fallbackAnalysis.timeline,
  };
};
