import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function generateAnswer(prompt, options = {}) {
  const response = await groq.chat.completions.create({
    model: options.model || "llama-3.1-8b-instant",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens || options.max_tokens || 300,
  });

  return response.choices[0].message.content;
}
