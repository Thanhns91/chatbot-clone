import dotenv from "dotenv";
import { HfInference } from "@huggingface/inference";

dotenv.config();

export const hf = new HfInference(process.env.HF_TOKEN);

export async function embedText(text) {
  const result = await hf.featureExtraction({
    model: "sentence-transformers/all-MiniLM-L6-v2",
    inputs: text,
  });

  return Array.isArray(result[0]) ? result[0] : result;
}

export async function generateAnswer(prompt) {
  const result = await hf.chatCompletion({
    model: "HuggingFaceH4/zephyr-7b-beta",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    max_tokens: 300,
    temperature: 0.3,
  });

  return result.choices[0].message.content;
}