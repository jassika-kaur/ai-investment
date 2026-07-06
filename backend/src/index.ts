import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import researchRouter from './routes';

console.log("KEY IS:", process.env.GEMINI_API_KEY);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api', researchRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
