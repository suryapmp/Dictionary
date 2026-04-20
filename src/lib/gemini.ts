/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { DictionaryResponse } from "../types";

const getApiKey = () => {
  return import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
};

const apiKey = getApiKey();
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const SYSTEM_INSTRUCTION = `You are a Fast Bilingual Technical Dictionary (EN-KN).
1. Return strictly structured JSON.
2. Content: Etymology, IPA, Definition (EN/KN), Synonyms, Antonyms, Related Terms, and Context.
3. Be concise. Avoid filler words. Use formal Kannada.
4. Extract core term from phrases like "what is...".
5. For non-technical queries, return {"error": "Non-Technical"}.`;

export async function getSearchSuggestions(prefix: string): Promise<string[]> {
  if (!prefix.trim() || !ai) return [];

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

    const text = response.text?.trim();
    if (!text) return [];
    return JSON.parse(text);
  } catch (error) {
    console.error("Suggestions Error:", error);
    return [];
  }
}

export async function searchTechnicalTerm(query: string): Promise<DictionaryResponse> {
  if (!ai) {
    throw new Error("Missing Gemini API Key. Ensure VITE_GEMINI_API_KEY is set in Netlify or GEMINI_API_KEY is in the AI Studio Secrets panel.");
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Identify the core technical term in the following user request and provide its scholarly technical record. User request: "${query}"`,
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
    if (!text) {
      throw new Error("The AI Engine returned an empty response. Please try again or use a different term.");
    }

    const result = JSON.parse(text);
    return result as DictionaryResponse;
  } catch (error: any) {
    console.error("Gemini Search Error:", error);
    
    // Check for specific error types
    if (error?.message?.includes("API_KEY_INVALID")) {
      throw new Error("Invalid API Key. Please check your Gemini API key in the Secrets panel.");
    }
    
    if (error?.message?.includes("quota")) {
      throw new Error("API Quota exceeded. Please try again in a few minutes.");
    }

    const message = error?.message || "Connectivity error: Failed to reach the dictionary indexing engine.";
    throw new Error(message);
  }
}
