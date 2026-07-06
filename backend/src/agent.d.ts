export declare function answerFollowUpQuestion(question: string, companyName: string, result: any): Promise<any>;
export declare const runResearchAgent: (companyName: string, treatAsTicker?: boolean) => Promise<{
    decision: any;
    confidence: any;
    reasoning: any;
    risk: any;
    growth: any;
    numbers: Record<string, any> | null;
    chartData: any[];
    metadata: {
        ticker?: string;
        source?: string;
        lastUpdated?: string;
    };
    overview: Record<string, any>;
    news: {
        title: string;
        summary: string;
    }[];
    aiSummary: string[];
    explainRecommendation: any;
    followUpQuestions: string[];
    timeline: string[];
}>;
//# sourceMappingURL=agent.d.ts.map