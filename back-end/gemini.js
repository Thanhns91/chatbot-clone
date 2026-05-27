import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

console.log("Gemini key loaded:", !!process.env.GEMINI_API_KEY);

export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});