# AI Investment Research Agent

This project is an autonomous AI Investment Research Agent that takes a company name as input, conducts real-time web research, synthesizes financial data and sentiment, and provides a clear "Invest" or "Pass" decision along with detailed reasoning.

## Overview — What it does

The agent acts as an automated financial analyst. When given a company name (e.g., "Tesla" or "Apple"), it triggers a LangGraph workflow that uses the DuckDuckGo search API to gather the latest news, earnings reports, and market sentiment. It then feeds this raw data into Google's Gemini LLM, which is instructed with a specific persona to analyze the data and make a final investment decision. The output is a beautifully formatted markdown response displayed on a premium, glassmorphism UI.

## How to run it

### Prerequisites
- Node.js (v18+)
- A Google Gemini API Key (Available for free at [Google AI Studio](https://aistudio.google.com/))

### Setup Steps
1. **Clone/Download the repository** and navigate to the `ai-investment-agent` folder.
2. **Add your API Key**:
   Open the `backend/.env` file and insert your API key:
   ```env
   PORT=3001
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
   *(Note: The system automatically maps this to `GOOGLE_API_KEY` internally for Langchain).*
3. **Install Dependencies**:
   Open a terminal and run:
   ```bash
   cd backend
   npm install
   ```
   Open a second terminal and run:
   ```bash
   cd frontend
   npm install
   ```

### Running the App
1. **Start the Backend**:
   In the `backend` terminal, run:
   ```bash
   npm run dev
   ```
   The backend will start on `http://localhost:3001`.

2. **Start the Frontend**:
   In the `frontend` terminal, run:
   ```bash
   npm run dev
   ```
   The frontend will start on `http://localhost:5173`. Open this URL in your browser to interact with the agent.

## How it works — Approach and Architecture

The architecture is split into a React frontend and a Node.js/Express backend, ensuring a clean separation of concerns.

- **Frontend (React + Vite)**: 
  Built using modern React hooks. It manages the state (loading, error, result) and makes a simple `POST` request to the backend. The UI is designed from scratch using vanilla CSS (no Tailwind) to achieve a premium, dark-mode glassmorphism aesthetic. It uses `recharts` to render a 6-month historical stock price line chart and `react-markdown` to safely render the LLM's formatted output.
  
- **Backend (Node.js + Express + LangGraph)**:
  Exposes a single `/api/research` endpoint. The core logic resides in `agent.ts`, which leverages **LangGraph.js** to define a state machine workflow:
  1. **Quantitative Data Collection**: Uses the `yahoo-finance2` package to resolve the company ticker, fetch current market numbers (Price, Market Cap, P/E Ratio), and pull 6 months of historical chart data.
  2. **Qualitative Research Node**: Uses the `@langchain/community` DuckDuckGo tool to scrape the web for the latest company news.
  3. **Analysis Node**: Passes all quantitative and qualitative data into the **Gemini** model via `@langchain/google-genai`. A strict system prompt forces the LLM to output a binary "Invest" or "Pass" decision, followed by detailed markdown reasoning.
  
## Key decisions & trade-offs

- **React + Node.js (Express) vs. Next.js Fullstack**: 
  I initially proposed a Next.js fullstack app for simplicity, but shifted to a decoupled React (Vite) and Node.js architecture based on user feedback. This provides better separation and allows the backend to be scaled independently.
- **DuckDuckGo Search vs. Paid APIs (Tavily/AlphaVantage)**: 
  I chose DuckDuckGo for the research node because it is free and doesn't require the user to configure additional API keys, making the setup much easier. The trade-off is that it might hit rate limits or lack the precision of structured financial data APIs.
- **Vanilla CSS vs. Tailwind**: 
  I deliberately avoided Tailwind CSS to demonstrate the ability to craft a highly customized, premium UI system from scratch using CSS variables, keyframe animations, and backdrop filters.
- **Google Gemini**: 
  Chosen based on user preference. I implemented backward compatibility in the `agent.ts` to map the `GEMINI_API_KEY` to `GOOGLE_API_KEY` and explicitly used the `gemini-1.5-flash` model to ensure maximum speed and compatibility with the provided key.

## Example runs

### 1. Apple Inc. (AAPL)
- **Decision**: Invest
- **Reasoning**: "Despite the lack of real-time data feeds, Apple Inc. (NASDAQ: AAPL) remains one of the most resilient, cash-rich companies globally. Recent sentiment highlights strong services revenue growth and stabilization in iPhone sales in key markets like China. The ecosystem lock-in provides an unparalleled moat."

### 2. Tesla (TSLA)
- **Decision**: Pass
- **Reasoning**: "While Tesla (TSLA) remains the undisputed leader in the global electric vehicle (EV) market, recent margin compressions due to aggressive price cuts raise short-term profitability concerns. Additionally, increasing competition from legacy automakers and Chinese EV startups presents significant headwinds."

## What I would improve with more time

1. **Better Data Sources**: Integrate Alpha Vantage or Yahoo Finance APIs to pull exact stock prices, P/E ratios, and historical charts to feed the LLM hard quantitative data alongside qualitative news.
2. **Multi-Agent Workflow**: Use LangGraph to create multiple agents—e.g., a "Fundamental Analyst" and a "Sentiment Analyst"—who debate the stock before a "Portfolio Manager" makes the final call.
3. **Caching / Database**: Implement Redis or MongoDB to cache research results for a few hours to prevent hitting search API rate limits and to reduce LLM token costs.

## BONUS: LLM Chat Session Transcript

As requested for bonus points, the complete, unedited chat session transcript demonstrating the thought process and interactions with the LLM during the building of this project has been saved to [LLM_CHAT_LOGS.md](./LLM_CHAT_LOGS.md) in this repository.
