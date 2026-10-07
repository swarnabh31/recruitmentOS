import React, { useState } from 'react';
import { useModel } from '../../lib/ModelContext';
import { agenticResearch, extractTextFromFile } from '../../lib/api';
import { Globe, Send, Loader2, BookOpen, ExternalLink, Upload, Trash2, Sparkles, Terminal } from 'lucide-react';
import { MarkdownView } from '../MarkdownView';
import { KBDocument, ResearchMessage } from '../../types';

export const SourcingIntelligenceModule: React.FC = () => {
  const { selectedModel } = useModel();
  const [kbDocs, setKbDocs] = useState<KBDocument[]>([]);
  const [isUploadingKb, setIsUploadingKb] = useState(false);
  const [messages, setMessages] = useState<ResearchMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleKbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploadingKb(true);
    const newDocs: KBDocument[] = [...kbDocs];
    for (let i = 0; i < files.length; i++) {
      const res = await extractTextFromFile(files[i]);
      if (res.success) {
        newDocs.push({ id: `kb_${Date.now()}_${i}`, name: files[i].name, size: files[i].size, charCount: res.text.length, content: res.text });
      }
    }
    setIsUploadingKb(false);
    setKbDocs(newDocs);
  };

  const removeKbDoc = (id: string) => setKbDocs((prev) => prev.filter((d) => d.id !== id));

  const handleSubmit = async () => {
    if (!inputPrompt.trim()) return;
    setError(null);
    const userText = inputPrompt.trim();
    setInputPrompt('');

    const newMessages: ResearchMessage[] = [
      ...messages,
      { id: Date.now().toString(), role: 'user', content: userText },
    ];
    setMessages(newMessages);

    setIsSearching(true);
    setSearchStatus('Searching web...');
    const res = await agenticResearch(
      userText,
      kbDocs,
      newMessages.map((m) => ({ role: m.role, content: m.content }))
    );
    setIsSearching(false);
    setSearchStatus('');

    if (res.success) {
      let content = res.text || 'No response generated. Check that Ollama is running.';
      const hasSources = res.sources && res.sources.length > 0;
      content = content.replace(/\[Source\s*(\d+)\]/gi, (match, num) => {
        if (hasSources) {
          const idx = parseInt(num, 10) - 1;
          const src = res.sources[idx];
          if (src && src.url) return `[${match}](${src.url})`;
        }
        return `**${match}**`;
      });
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content,
          sources: res.sources,
          isSearching: res.searched,
        },
      ]);
    } else {
      setError(res.error || 'Request failed. Is Ollama running?');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Globe className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-white">Agentic Research Lab</h2>
            <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-mono px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Globe className="w-3 h-3 animate-pulse" /> Live Grounding
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Market Research | Document Memory | Live Web Search</p>
        </div>
        <div className="flex items-center space-x-2 font-mono text-[11px] text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span>Status: {isSearching ? 'Searching...' : 'Ready'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-indigo-400" /> Knowledge Base
            </h3>
            <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono">{kbDocs.length} doc(s)</span>
          </div>

          <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-lg cursor-pointer bg-slate-950/50 transition-all">
            <Upload className="w-5 h-5 text-indigo-400 mb-1" />
            <span className="text-xs font-medium text-slate-300">{isUploadingKb ? 'Uploading...' : 'Add Docs to Memory'}</span>
            <span className="text-[10px] text-slate-400 mt-0.5">PDF, DOCX, TXT</span>
            <input type="file" multiple accept=".pdf,.docx,.doc,.txt" onChange={handleKbUpload} disabled={isUploadingKb} className="hidden" />
          </label>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {kbDocs.map((doc) => (
              <div key={doc.id} className="bg-slate-800/60 border border-slate-700 p-2.5 rounded-lg flex items-center justify-between text-xs">
                <div className="truncate mr-2">
                  <span className="font-semibold text-slate-200 block truncate">{doc.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{doc.charCount.toLocaleString()} chars</span>
                </div>
                <button onClick={() => removeKbDoc(doc.id)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl flex flex-col h-[600px]">
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                <SearchIcon />
                <h4 className="text-sm font-bold text-slate-200">Ask for Market Reports, Salary Benchmarks, or Industry Intelligence</h4>
                <p className="text-xs text-slate-400 max-w-md">Example: "Generate a market report on AI Engineer salaries in India for 2026", or "What are the key hiring trends for React developers?"</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isReport = msg.role === 'assistant' && (msg.content.includes('Executive Summary') || msg.content.length > 500);
                return (
                  <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[90%] rounded-2xl p-5 shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none'
                        : isReport
                        ? 'bg-slate-950 text-slate-200 border border-indigo-500/30 rounded-bl-none shadow-xl'
                        : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700'
                    }`}>
                      {msg.isSearching && (
                        <div className="flex items-center space-x-1.5 text-[11px] text-emerald-400 font-mono mb-3 bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-800/60">
                          <Globe className="w-3.5 h-3.5 animate-spin" />
                          <span>Grounding with Web Search</span>
                        </div>
                      )}
                      <MarkdownView content={msg.content} />
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-700 space-y-1.5 font-sans">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Grounding Sources ({msg.sources.length}):</span>
                          <div className="flex flex-wrap gap-2">
                            {msg.sources.map((src, i) => (
                              <a key={i} href={src.url} target="_blank" rel="noreferrer" className="bg-slate-900 hover:bg-slate-800 text-indigo-300 border border-slate-700 text-[10px] px-2 py-1 rounded flex items-center gap-1 font-mono transition-colors">
                                <span>[{i + 1}] {src.title || 'Source'}</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {isSearching && (
              <div className="bg-slate-900 text-emerald-400 p-4 rounded-xl border border-slate-800 font-mono text-xs flex items-center space-x-3 shadow-lg">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                <span>{searchStatus || 'Processing...'}</span>
              </div>
            )}

            {error && (
              <div className="bg-red-950/60 border border-red-500/40 rounded-xl p-4">
                <p className="text-xs text-red-200">{error}</p>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-700 flex gap-2">
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Ask a market research question..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={handleSubmit}
              disabled={isSearching || !inputPrompt.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function SearchIcon() {
  return (
    <svg className="w-10 h-10 text-indigo-400 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}
