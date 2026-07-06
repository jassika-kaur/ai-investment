import { Router } from 'express';
import { answerFollowUpQuestion, runResearchAgent } from './agent';

const router = Router();

router.post('/research', async (req, res) => {
  try {
    const { company, treatAsTicker } = req.body;

    if (!company) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    const result = await runResearchAgent(company, treatAsTicker);

    return res.json(result);
  } catch (error: any) {
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

    const answer = await answerFollowUpQuestion(question, company, result);
    return res.json({ question, answer });
  } catch (error: any) {
    console.error('Follow-up error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
