/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TechnicalDefinition {
  english: string;
  kannada: string;
}

export interface DictionaryEntry {
  english_term: string;
  kannada_term: string;
  kannada_phonetic: string;
  kannada_ipa: string;
  etymology: string;
  technical_definition: TechnicalDefinition;
  synonyms: string[];
  antonyms: string[];
  related_terms: string[];
  context_use: string;
}

export type DictionaryResponse = DictionaryEntry | { error: string };
