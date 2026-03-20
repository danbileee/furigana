import OpenAI from "openai";

const apiKey = process.env["OPENAI_API_KEY"];

if (!apiKey) {
  throw new Error(`OPENAI_API_KEY environment variable is not set.
Add it to your .env file (see .env.example).
This variable must NEVER have a VITE_ prefix - it is server-only.`);
}

export const openaiClient: OpenAI = new OpenAI({ apiKey });
