/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DictionaryResponse } from "../types";
import OpenAI from "openai";

const getOpenRouterKey = () => import.meta.env.VITE_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
const openRouterKey = getOpenRouterKey();

const openai = openRouterKey ? new OpenAI({
  apiKey: openRouterKey,
  baseURL: "https://openrouter.ai/api/v1",
  dangerouslyAllowBrowser: true,
  defaultHeaders: {
    "HTTP-Referer": window.location.origin,
    "X-Title": "Technical Lexicon EN-KN",
  }
}) : null;

// DEFINITIVE LIST OF FREE MODELS ON OPENROUTER (April 2026)
const MODELS = [
  "google/gemma-2-9b-it:free",
  "mistralai/mistral-7b-instruct:free",
  "meta-llama/llama-3-8b-instruct:free",
  "qwen/qwen-2.5-7b-instruct:free",
  "huggingfaceh4/zephyr-7b-beta:free"
];

const SYSTEM_INSTRUCTION = `You are a Fast Bilingual Technical Dictionary (EN-KN).
Return strictly valid JSON.
Fields: english_term, kannada_term, kannada_phonetic, kannada_ipa, etymology, technical_definition (object {english, kannada}), synonyms (array), antonyms (array), related_terms (array), context_use.
Provide scholarly technical records only.`;

const JSON_SCHEMA_PROMPT = `
Output must be a plain JSON object with this structure:
{
  "english_term": "string",
  "kannada_term": "string",
  "kannada_phonetic": "string",
  "kannada_ipa": "string",
  "etymology": "string",
  "technical_definition": { "english": "string", "kannada": "string" },
  "synonyms": ["string"],
  "antonyms": ["string"],
  "related_terms": ["string"],
  "context_use": "string"
}
`;

export async function getSearchSuggestions(prefix: string): Promise<string[]> {
  if (!prefix.trim() || !openai) return [];

  for (const model of MODELS.slice(0, 2)) { // Only try first 2 for suggestions to be fast
    try {
      const response = await openai.chat.completions.create({
        model: model,
        messages: [{ role: "user", content: `List 4 technical terms starting with "${prefix}". Return JSON string array only.` }],
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      if (content) {
        const data = JSON.parse(content);
        return Array.isArray(data) ? data : data.suggestions || Object.values(data)[0];
      }
    } catch (e) {
      console.warn(`Suggestions model ${model} failed`, e);
    }
  }
  return [];
}

export async function searchTechnicalTerm(query: string): Promise<DictionaryResponse> {
  if (!navigator.onLine) {
    throw new Error("You are offline. Please reconnect.");
  }

  if (!openai) {
    throw new Error("OpenRouter API Key (VITE_OPENROUTER_API_KEY) is missing. Check your Netlify settings.");
  }

  let lastError: any = null;

  for (const model of MODELS) {
    try {
      console.log(`[AI SERVICE] Attempting indexing with model: ${model}`);
      const response = await openai.chat.completions.create({
        model: model,
        messages: [
          { role: "system", content: SYSTEM_INSTRUCTION + JSON_SCHEMA_PROMPT },
          { role: "user", content: `Technical record for: "${query}"` }
        ],
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      if (!content) continue;
      
      const result = JSON.parse(content);
      console.log(`[AI SERVICE] Successfully indexed term using ${model}`);
      return result as DictionaryResponse;
    } catch (error: any) {
      console.warn(`[AI SERVICE] Model ${model} failed:`, error?.message || error);
      lastError = error;
      
      // If it's an auth error, don't bother trying other models
      if (error?.status === 401 || error?.status === 403) {
        throw new Error(`OpenRouter Authentication Failed. Please check VITE_OPENROUTER_API_KEY. Details: ${error.message}`);
      }
    }
  }

  throw new Error(`All OpenRouter Endpoints failed. Last Error: ${lastError?.message || "Connectivity Issue"}. Please verify your API Key and check if OpenRouter is down.`);
}
