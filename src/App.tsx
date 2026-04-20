/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, Loader2, BookOpen, AlertTriangle, X, ChevronRight, Volume2 } from "lucide-react";
import { searchTechnicalTerm, getSearchSuggestions } from "./lib/gemini";
import { DictionaryResponse, DictionaryEntry } from "./types";

export default function App() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [entry, setEntry] = useState<DictionaryResponse | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem("search_history");
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Save history when it changes
  useEffect(() => {
    localStorage.setItem("search_history", JSON.stringify(history));
  }, [history]);

  // Auto-suggestions logic
  useEffect(() => {
    const handler = setTimeout(async () => {
      if (query.trim().length > 0) {
        setSuggestionsLoading(true);
        const results = await getSearchSuggestions(query);
        setSuggestions(results);
        setSuggestionsLoading(false);
      } else {
        setSuggestions([]);
      }
    }, 400); // Reduced debounce to 400ms for snappier feedback

    return () => clearTimeout(handler);
  }, [query]);

  // Handle clicks outside suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = async (val: string) => {
    if (!val.trim()) return;
    setQuery(val);
    setShowSuggestions(false);
    setLoading(true);
    setEntry(null);
    
    try {
      const result = await searchTechnicalTerm(val);
      setEntry(result);
      // Add to history if successful and not already there
      if (!("error" in result)) {
        setHistory(prev => {
          const filtered = prev.filter(h => h.toLowerCase() !== val.toLowerCase());
          return [val, ...filtered].slice(0, 5); // Keep last 5
        });
      }
    } catch (error: any) {
      console.error(error);
      setEntry({ error: error.message || "Engine Error: The technical indexing process was interrupted." });
    } finally {
      setLoading(false);
    }
  };

  const speak = (text: string, lang: string = "en-US") => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    
    // Spelling the word first
    const characters = text.split("").join("... ");
    const spellUtterance = new SpeechSynthesisUtterance(characters);
    spellUtterance.lang = lang;
    spellUtterance.rate = 0.8;
    
    // Then pronouncing it normally
    const wordUtterance = new SpeechSynthesisUtterance(text);
    wordUtterance.lang = lang;
    wordUtterance.rate = 0.9;
    
    spellUtterance.onend = () => {
      window.speechSynthesis.speak(wordUtterance);
    };
    
    window.speechSynthesis.speak(spellUtterance);
  };

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  return (
    <div className="layout-root">
        <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-red-600 text-white text-[10px] uppercase tracking-widest font-bold py-1.5 text-center sticky top-0 z-[60] shadow-lg"
          >
            Offline Mode • Searching Cached Library Only
          </motion.div>
        )}
      </AnimatePresence>

      {/* PROFESSIONAL HEADER */}
      <header className="header flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div className="text-center">
            <h1 className="font-extrabold text-2xl tracking-tighter uppercase">Technical Lexicon</h1>
            <p className="text-[10px] opacity-60 tracking-[0.2em] font-mono">EN-KN DATA REPOSITORY v3.0</p>
          </div>
        </div>
        
        <div className="w-full max-w-2xl relative" ref={searchContainerRef}>
          <form onSubmit={onFormSubmit} className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              className="w-full bg-[#1E293B] border-2 border-slate-700 text-white pl-12 pr-12 py-4 rounded-xl text-lg focus:outline-none focus:border-blue-500 transition-all shadow-lg"
              placeholder="Enter technical term (e.g., Fourier Transform)..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
            />
            
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(""); setSuggestions([]); }}
                  className="p-1 hover:bg-slate-700 rounded-full transition-colors text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
              {loading && <Loader2 className="w-5 h-5 animate-spin text-blue-500" />}
            </div>
          </form>

          {/* HISTORY BAR */}
          {!showSuggestions && history.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 px-2">
              <span className="text-[10px] uppercase font-bold text-slate-500 mt-1.5 mr-1">Recent:</span>
              {history.map((h, i) => (
                <button
                  key={i}
                  onClick={() => handleSearch(h)}
                  className="text-xs px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-slate-300 hover:bg-blue-600 hover:text-white transition-all"
                >
                  {h}
                </button>
              ))}
              <button 
                onClick={() => setHistory([])}
                className="text-[9px] uppercase font-bold text-slate-500 hover:text-red-400 mt-1.5 ml-1"
              >
                Clear
              </button>
            </div>
          )}

          {/* AUTO SUGGESTIONS */}
          {showSuggestions && (suggestions.length > 0 || suggestionsLoading) && (
            <div className="suggestion-box">
              {suggestionsLoading ? (
                <div className="p-4 flex items-center gap-2 text-slate-400 text-sm italic">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing library...
                </div>
              ) : (
                suggestions.map((s, idx) => (
                  <div
                    key={idx}
                    className="suggestion-item"
                    onClick={() => handleSearch(s)}
                  >
                    <Search className="w-4 h-4 text-slate-300" />
                    <span className="font-medium text-slate-700">{s}</span>
                    <ChevronRight className="w-4 h-4 ml-auto text-slate-200" />
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </header>

      {/* MAIN CONTENT SPACE */}
      <main className="main-container">
        <AnimatePresence mode="wait">
          {!entry && !loading ? (
            <motion.div 
              key="intro"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="h-[40vh] flex flex-col items-center justify-center text-center space-y-6"
            >
              <div className="p-10 border-2 border-dashed border-slate-200 rounded-3xl opacity-30">
                <BookOpen className="w-20 h-20 mb-4 mx-auto" />
                <p className="font-serif italic text-xl max-w-sm">
                  "Technical terminology is the foundation of scientific precision."
                </p>
                <p className="text-xs uppercase tracking-widest mt-4 font-mono">Awaiting Input Parameters</p>
              </div>
            </motion.div>
          ) : loading ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-[40vh] flex flex-col items-center justify-center animate-pulse"
            >
              <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-400">Synthesizing Records</p>
            </motion.div>
          ) : entry && "error" in entry ? (
            <motion.div 
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-3xl mx-auto"
            >
              <div className="card border-red-200 bg-red-50 p-8 flex gap-6 items-center">
                <AlertTriangle className="w-12 h-12 text-red-500 shrink-0" />
                <div>
                  <h2 className="text-red-800 font-bold text-xl mb-2">
                    {entry.error === "Non-Technical" ? "Lexical Violation" : "System Engine Exception"}
                  </h2>
                  <p className="text-red-700 text-sm opacity-80 leading-relaxed">
                    {entry.error === "Non-Technical" 
                      ? `The term "${query}" does not meet scientific classification requirements for this Lexicon.`
                      : entry.error}
                  </p>
                  {entry.error !== "Non-Technical" && (
                    <button 
                      onClick={() => handleSearch(query)}
                      className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 text-xs font-bold rounded-lg transition-colors"
                    >
                      Retry Indexing
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ) : entry && !("error" in entry) ? (
            <motion.div 
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8"
            >
            {/* RECORD DETAILS */}
            <div className="space-y-8">
              <div className="border-b-4 border-slate-900 pb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="label-micro text-blue-600 font-bold mb-0">Dictionary Record</div>
                  {(entry as any)._offline && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-black uppercase rounded tracking-tighter border border-amber-200">
                      Offline Cache
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 leading-none">{entry.english_term}</h2>
                    <button 
                      onClick={() => speak(entry.english_term, "en-US")}
                      className="p-2 bg-slate-100 hover:bg-blue-100 text-slate-400 hover:text-blue-600 rounded-full transition-all"
                      title="Pronounce English Term"
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-4">
                      <div 
                        className="text-2xl md:text-3xl font-serif text-blue-600 font-medium cursor-help relative group/ipa"
                        title={`IPA Pronunciation: ${entry.kannada_ipa}`}
                      >
                        / {entry.kannada_term} /
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-1.5 bg-slate-800 text-white text-[10px] font-mono rounded opacity-0 group-hover/ipa:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl z-50">
                          <span className="text-blue-400 font-bold mr-2">IPA:</span>
                          {entry.kannada_ipa}
                        </div>
                      </div>
                      <button 
                        onClick={() => speak(entry.kannada_term, "kn-IN")}
                        className="p-2 bg-slate-100 hover:bg-blue-100 text-slate-400 hover:text-blue-600 rounded-full transition-all"
                        title="Pronounce Kannada Term"
                      >
                        <Volume2 className="w-5 h-5" />
                      </button>
                      <div className="px-3 py-1 bg-slate-100 rounded text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                        Trans: {entry.kannada_phonetic}
                      </div>
                    </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                    <span className="font-bold opacity-50 uppercase text-[9px]">IPA:</span>
                    <span>{entry.kannada_ipa}</span>
                  </div>
                </div>
              </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <section className="space-y-4">
                  <div>
                    <div className="label-micro">Origin & Etymology</div>
                    <div className="p-4 bg-slate-50 rounded-lg text-sm italic text-slate-600 leading-relaxed border border-slate-100">
                      {entry.etymology}
                    </div>
                  </div>
                  
                  <div>
                    <div className="label-micro">Thesaurus (Technical)</div>
                    <div className="space-y-4 pt-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold opacity-30 block mb-1">Synonyms</span>
                        <div className="flex flex-wrap gap-2">
                          {(entry.synonyms || []).map((s, i) => (
                            <span key={i} className="text-[11px] font-medium border-b border-slate-300 hover:border-blue-500 cursor-default">{s}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold opacity-30 block mb-1">Antonyms</span>
                        <div className="flex flex-wrap gap-2">
                          {(entry.antonyms || []).map((a, i) => (
                            <span key={i} className="text-[11px] font-medium border-b border-slate-300 hover:border-red-500 cursor-default">{a}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="label-micro">Full-Scale Definition</div>
                  <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl space-y-4">
                    <div>
                      <p className="text-[9px] uppercase font-bold text-blue-400 mb-2">English Lexicon</p>
                      <p className="text-sm leading-relaxed opacity-90">{entry.technical_definition?.english || "Definition pending scholarly verification."}</p>
                    </div>
                    <div className="h-px bg-slate-800" />
                    <div>
                      <p className="text-[9px] uppercase font-bold text-emerald-400 mb-2">ಕನ್ನಡ ಪ್ರಾಧಿಕಾರ</p>
                      <p className="text-base leading-relaxed tracking-wide font-medium">{entry.technical_definition?.kannada || "ವಿವರಣೆ ಪ್ರಕ್ರಿಯೆಯಲ್ಲಿದೆ."}</p>
                    </div>
                  </div>
                </section>
              </div>

              <div>
                <div className="label-micro">Contextual Usage</div>
                <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-r-2xl">
                  <p className="text-slate-800 font-serif text-lg leading-relaxed italic">
                    "{entry.context_use}"
                  </p>
                </div>
              </div>
            </div>

            {/* SIDE METADATA */}
            <aside className="space-y-6">
              <div className="card !rounded-2xl">
                <div className="label-micro">Related Technical Terms</div>
                <div className="flex flex-col gap-1 mt-3">
                  {(entry.related_terms || []).map((rt, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => handleSearch(rt)}
                      className="text-left text-xs px-4 py-3 rounded-xl hover:bg-blue-600 hover:text-white transition-all flex items-center justify-between group bg-slate-50 border border-slate-100"
                    >
                      <span className="font-semibold">{rt}</span>
                      <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>
            </aside>
        </motion.div>
      ) : null}
        </AnimatePresence>
      </main>

      {/* FOOTER METADATA - REMOVED COPYRIGHT */}
      <footer className="p-6 text-center border-t border-slate-100">
      </footer>
    </div>
  );
}
