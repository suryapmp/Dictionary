/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { DictionaryResponse } from "../types";

const getGeminiKey = () => import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const getOpenRouterKey = () => import.meta.env.VITE_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;

const geminiKey = getGeminiKey();
const ai = geminiKey ? new GoogleGenAI({ apiKey: geminiKey }) : null;

// DEFINITIVE LIST OF STABLE FREE MODELS ON OPENROUTER (April 2026)
const MODELS = [
  "google/gemma-2-9b-it:free",
  "mistralai/mistral-7b-instruct:free",
  "qwen/qwen-2-7b-instruct:free",
  "microsoft/phi-3-medium-128k-instruct:free",
  "meta-llama/llama-3.1-8b-instruct:free"
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

function extractJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```([\s\S]*?)```/);
    if (match && match[1]) {
      try { return JSON.parse(match[1]); } catch { /* ignore */ }
    }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      return JSON.parse(text.substring(start, end + 1));
    }
    throw new Error("Could not parse AI response as JSON");
  }
}

async function callOpenRouter(model: string, messages: any[]) {
  const key = getOpenRouterKey();
  if (!key) throw new Error("VITE_OPENROUTER_API_KEY missing");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
      "HTTP-Referer": window.location.origin,
      "X-Title": "Technical Lexicon",
    },
    body: JSON.stringify({ model, messages }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenRouter (${response.status}): ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
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

export async function getSearchSuggestions(prefix: string): Promise<string[]> {
  if (!prefix.trim()) return [];

  const key = getOpenRouterKey();
  if (key) {
    for (const model of MODELS.slice(0, 2)) {
      try {
        const content = await callOpenRouter(model, [
          { role: "user", content: `List 4 technical terms starting with "${prefix}". Return JSON string array only.` }
        ]);
        const data = extractJson(content);
        return Array.isArray(data) ? data : data.suggestions || Object.values(data)[0];
      } catch { continue; }
    }
  }

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: `Provide 4 technical terms starting with: "${prefix}". JSON string array only.`,
      });
      const text = response.text || "";
      return JSON.parse(text.substring(text.indexOf('['), text.lastIndexOf(']') + 1));
    } catch { return []; }
  }

  return [];
}

export async function searchTechnicalTerm(query: string): Promise<DictionaryResponse> {
  if (!navigator.onLine) throw new Error("Offline");

  const reports: string[] = [];

  // 1. Try OpenRouter (Multi-Model Cycle)
  const orKey = getOpenRouterKey();
  if (orKey) {
    for (const model of MODELS) {
      try {
        console.log(`[ENGINE] Trying ${model}...`);
        const content = await callOpenRouter(model, [
          { role: "system", content: SYSTEM_INSTRUCTION + JSON_SCHEMA_PROMPT },
          { role: "user", content: `Technical record for: "${query}"` }
        ]);
        console.log(`[ENGINE] Success with ${model}`);
        return extractJson(content) as DictionaryResponse;
      } catch (e: any) {
        console.warn(`[ENGINE] ${model} failed:`, e.message);
        reports.push(`${model}: ${e.message}`);
        if (e.message.includes("401") || e.message.includes("403")) break;
      }
    }
  }

  // 2. Try Gemini Fallback
  if (ai) {
    try {
      console.log("[ENGINE] Falling back to Gemini...");
      return await fetchFromGemini(query);
    } catch (e: any) {
      reports.push(`Gemini: ${e.message}`);
    }
  }

  throw new Error(`All engines failed. Details: ${reports.join(" | ")}`);
}
