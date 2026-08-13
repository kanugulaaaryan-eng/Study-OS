import "dotenv/config";
import { invokeLLM } from './server/_core/llm.js';

async function test() {
  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: "You are a patient, encouraging teacher." },
        { role: "user", content: "Explain supervised learning like I'm a beginner." }
      ],
      maxTokens: 1200
    });
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Error:', e);
    if (e instanceof Error) {
      console.error('Stack:', e.stack);
    }
  }
}

test();