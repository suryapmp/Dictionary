/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { DictionaryResponse } from "../types";
import OpenAI from "openai";

const getGeminiKey = () => import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const getOpenRouterKey = () => import.meta.env.VITE_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;

const geminiKey = getGeminiKey();
const openRouterKey = getOpenRouterKey();

const ai = geminiKey ? new GoogleGenAI({ apiKey: geminiKey }) : null;
const openai = openRouterKey ? new OpenAI({
  apiKey: openRouterKey,
  baseURL: "https://openrouter.ai/api/v1",
  dangerouslyAllowBrowser: true,
  defaultHeaders: {
    "HTTP-Referer": window.location.origin,
    "X-Title": "Technical Lexicon EN-KN",
  }
}) : null;

const SYSTEM_INSTRUCTION = `You are a Fast Bilingual Technical Dictionary (EN-KN).
Return strictly valid JSON.
Fields: english_term, kannada_term, kannada_phonetic, kannada_ipa, etymology, technical_definition (object {english, kannada}), synonyms (array), antonyms (array), related_terms (array), context_use.
Be concise. Avoid filler words. Use formal Kannada.
Case: For non-technical queries, return {"error": "Non-Technical"}.`;

const JSON_SCHEMA_PROMPT = `
Output format must be JSON:
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
  if (!prefix.trim()) return [];

  // Try OpenRouter First
  if (openai) {
    try {
      const response = await openai.chat.completions.create({
        model: "google/gemma-2-9b-it:free",
        messages: [{ role: "user", content: `List 4 technical terms starting with "${prefix}". Return JSON string array only.` }],
        response_format: { type: "json_object" }
      });
      const content = response.choices[0].message.content;
      if (content) {
        const data = JSON.parse(content);
        return Array.isArray(data) ? data : data.suggestions || Object.values(data)[0];
      }
    } catch (e) {
      console.warn("OpenRouter Suggestions Failed, falling back to Gemini", e);
    }
  }

  // Fallback to Gemini
  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Provide 4 technical terms starting with: "${prefix}". Return JSON string array only.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });
      return JSON.parse(response.text || "[]");
    } catch (error) {
      console.error("Gemini Suggestions Error:", error);
    }
  }

  return [];
}

async function fetchFromOpenRouter(query: string): Promise<DictionaryResponse> {
  if (!openai) throw new Error("OpenRouter Key Missing (VITE_OPENROUTER_API_KEY)");
  
  // Attempt with user-specified model first, fallback to standard free model
  const models = ["google/gemma-2-9b-it:free", "google/gemma-2-27b-it:free", "meta-llama/llama-3-8b-instruct:free"];
  
  let lastError = null;
  for (const model of models) {
    try {
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
      return JSON.parse(content) as DictionaryResponse;
    } catch (e: any) {
      console.warn(`OpenRouter model ${model} failed:`, e?.message);
      lastError = e;
    }
  }
  
  throw lastError || new Error("OpenRouter engines failed to return data");
}

async function fetchFromGemini(query: string): Promise<DictionaryResponse> {
  if (!ai) throw new Error("Gemini Key Missing");

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Identify core technical term and provide scholarly record for: "${query}"`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          english_term: { type: Type.STRING },
          kannada_term: { type: Type.STRING },
          kannada_phonetic: { type: Type.STRING },
          kannada_ipa: { type: Type.STRING },
          etymology: { type: Type.STRING },
          technical_definition: {
            type: Type.OBJECT,
            properties: {
              english: { type: Type.STRING },
              kannada: { type: Type.STRING }
            },
            required: ["english", "kannada"]
          },
          synonyms: { type: Type.ARRAY, items: { type: Type.STRING } },
          antonyms: { type: Type.ARRAY, items: { type: Type.STRING } },
          related_terms: { type: Type.ARRAY, items: { type: Type.STRING } },
          context_use: { type: Type.STRING },
          error: { type: Type.STRING }
        }
      }
    }
  });

  const text = response.text?.trim();
  if (!text) throw new Error("Empty response from Gemini");
  return JSON.parse(text) as DictionaryResponse;
}

export async function searchTechnicalTerm(query: string): Promise<DictionaryResponse> {
  if (!navigator.onLine) {
    throw new Error("You are offline. Please reconnect.");
  }

  const reports: string[] = [];
  
  // PRIMARY: OpenRouter (Multi-Model Strategy)
  if (openai) {
    try {
      return await fetchFromOpenRouter(query);
    } catch (error: any) {
      const msg = `OpenRouter Engine Unavailable: ${error?.message || "Unknown error"}`;
      console.warn(msg);
      reports.push(msg);
    }
  } else {
    reports.push("OpenRouter is not configured (VITE_OPENROUTER_API_KEY missing)");
  }

  // SECONDARY: Gemini
  if (ai) {
    try {
      return await fetchFromGemini(query);
    } catch (error: any) {
      console.error("Gemini Fallback Error:", error);
      if (error?.message?.includes("quota")) {
        reports.push("Gemini Engine: Quota Exceeded");
        const summary = reports.join(" | ");
        throw new Error(`All AI engines exhausted. Status: ${summary}. Please verify your API Keys in Netlify settings.`);
      }
      throw error;
    }
  } else {
    reports.push("Gemini is not configured (VITE_GEMINI_API_KEY missing)");
  }

  const finalStatus = reports.join(" | ");
  throw new Error(`No AI Engines available. Diagnostics: ${finalStatus}`);
}
