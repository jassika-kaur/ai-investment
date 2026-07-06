"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const agent_1 = require("./agent");
const router = (0, express_1.Router)();
router.post('/research', async (req, res) => {
    try {
        const { company, treatAsTicker } = req.body;
        if (!company) {
            return res.status(400).json({ error: 'Company name is required' });
        }
        const result = await (0, agent_1.runResearchAgent)(company, treatAsTicker);
        return res.json(result);
    }
    catch (error) {
        console.error('Research error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
});
router.post('/follow-up', async (req, res) => {
    try {
        const { company, question, result } = req.body;
        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }
        const answer = await (0, agent_1.answerFollowUpQuestion)(question, company, result);
        return res.json({ question, answer });
    }
    catch (error) {
        console.error('Follow-up error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=routes.js.map