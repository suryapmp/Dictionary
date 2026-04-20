/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Dexie, { Table } from 'dexie';
import { DictionaryEntry } from '../types';

export interface CachedTerm extends DictionaryEntry {
  query: string;
  cachedAt: number;
}

export class TechnicalLexiconDB extends Dexie {
  terms!: Table<CachedTerm>;

  constructor() {
    super('TechnicalLexiconDB');
    this.version(1).stores({
      terms: 'query, english_term, cachedAt'
    });
  }
}

export const db = new TechnicalLexiconDB();
