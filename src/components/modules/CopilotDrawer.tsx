import React, { useState, useRef, useEffect } from 'react';
import { useModel } from '../../lib/ModelContext';
import { advancedChat, extractTextFromFile } from '../../lib/api';
import { Send, Loader2, X, Cpu, Globe, GlobeLock, MessageSquare, BookOpen, Paperclip, FileText } from 'lucide-react';
import { MarkdownView } from '../MarkdownView';
import { Job, ResearchSource } from '../../types';

interface CopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: Job[];
}

interface ChatEntry {
  role: 'user' | 'assistant';
  content: string;
  sources?: ResearchSource[];
  isSearching?: boolean;
  attachedFile?: { name: string };
}

export const CopilotDrawer: React.FC<CopilotDrawerProps> = ({ isOpen, onClose, jobs }) => {
  const { selectedModel } = useModel();
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatEntry[]>([
    {
      role: 'assistant',
      content: buildWelcomeMessage(jobs),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeJobs = jobs.filter((j) => j.status === 'Open');
  const onHoldJobs = jobs.filter((j) => j.status === 'On Hold');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isOpen) return;
    setMessages([
      {
        role: 'assistant',
        content: buildWelcomeMessage(jobs),
      },
    ]);
    setAttachedFile(null);
  }, [isOpen, jobs]);

  if (!isOpen) return null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    try {
      const result = await extractTextFromFile(file);
      if (result.success && result.text) {
        setAttachedFile({ name: result.filename, content: result.text });
      } else {
        alert(`Failed to extract text: ${result.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Error reading file: ${err.message}`);
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!prompt.trim() && !attachedFile) || isLoading) return;

    const userText = prompt;
    setPrompt('');

    const userEntry: ChatEntry = { role: 'user', content: userText };
    if (attachedFile) userEntry.attachedFile = { name: attachedFile.name };

    const newMessages: ChatEntry[] = [...messages, userEntry];
    if (webSearch) {
      newMessages.push({ role: 'assistant', content: '', isSearching: true });
    }
    setMessages(newMessages);
    setIsLoading(true);

    const fileToSend = attachedFile;
    setAttachedFile(null);

    try {
      const historyForApi = newMessages
        .filter((m) => !m.isSearching)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await advancedChat(userText, historyForApi, selectedModel, webSearch, fileToSend || undefined);

      if (res.success && res.text) {
        const finalMessages = webSearch
          ? newMessages.slice(0, -1)
          : [...newMessages];

        setMessages([
          ...finalMessages,
          {
            role: 'assistant',
            content: res.text,
            sources: res.sources,
          },
        ]);
      } else {
        const finalMessages = webSearch
          ? newMessages.slice(0, -1)
          : [...newMessages];

        setMessages([
          ...finalMessages,
          {
            role: 'assistant',
            content: `Error: ${res.error || 'Request failed. Check that Ollama is running and a model is selected.'}`,
          },
        ]);
      }
    } catch (err: any) {
      const finalMessages = webSearch
        ? newMessages.slice(0, -1)
        : [...newMessages];

      setMessages([
        ...finalMessages,
        {
          role: 'assistant',
          content: `Unexpected error: ${err.message || 'Unknown error'}.`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-stretch justify-center p-3 sm:p-6 lg:p-8 animate-fadeIn">
      <div className="bg-slate-900 border border-white/15 w-full max-w-3xl h-full rounded-2xl overflow-hidden flex flex-col shadow-2xl relative">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-white/10 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-tr from-emerald-600 to-teal-600 rounded-xl shadow-lg ring-1 ring-white/20">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                Advanced Chat Bot
              </h3>
              <p className="text-[11px] text-slate-400 flex items-center gap-1">
                <Cpu className="w-3 h-3" />
                Model: {selectedModel || <span className="text-amber-400">Not connected</span>}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Context Awareness Bar */}
        <div className="px-4 py-2.5 bg-slate-950 border-b border-white/10 flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
            <BookOpen className="w-3.5 h-3.5" />
            <span className="font-semibold">
              {activeJobs.length} Active{onHoldJobs.length > 0 ? `, ${onHoldJobs.length} On Hold` : ''}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
            <span className="font-semibold">{jobs.length} Total Requisitions</span>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setWebSearch(!webSearch)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
              webSearch
                ? 'bg-blue-600/20 border-blue-500/30 text-blue-300'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            {webSearch ? (
              <Globe className="w-3.5 h-3.5" />
            ) : (
              <GlobeLock className="w-3.5 h-3.5" />
            )}
            {webSearch ? 'Web Search ON' : 'Web Search'}
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`p-4 rounded-2xl max-w-[90%] leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-none shadow-lg'
                    : 'bg-slate-950 border border-white/10 text-slate-200 rounded-bl-none shadow-md'
                }`}
              >
                {m.isSearching ? (
                  <div className="flex items-center space-x-2 text-blue-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs font-semibold">Searching the web...</span>
                  </div>
                ) : m.role === 'assistant' ? (
                  <MarkdownView content={m.content} />
                ) : (
                  <>
                    {m.attachedFile && (
                      <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded-lg bg-white/10 text-emerald-200 text-[10px] font-semibold w-fit">
                        <FileText className="w-3 h-3" />
                        <span className="truncate max-w-[200px]">{m.attachedFile.name}</span>
                      </div>
                    )}
                    <p>{m.content || '(file attached)'}</p>
                  </>
                )}
              </div>

              {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
                <div className="mt-1.5 px-4 py-2 max-w-[90%]">
                  <details className="group">
                    <summary className="text-[10px] text-blue-400 font-semibold cursor-pointer hover:text-blue-300 flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      {m.sources.length} web sources
                    </summary>
                    <div className="mt-1.5 space-y-1">
                      {m.sources.map((s, si) => (
                        <a
                          key={si}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-[10px] text-slate-400 hover:text-blue-300 truncate"
                        >
                          [{si + 1}] {s.title || s.url}
                        </a>
                      ))}
                    </div>
                  </details>
                </div>
              )}
            </div>
          ))}

          {isLoading && !webSearch && (
            <div className="flex items-center space-x-2 text-indigo-400 p-3 bg-slate-950 rounded-2xl border border-white/10 w-fit">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs font-semibold">Thinking...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* File Attachment Pill */}
        {attachedFile && (
          <div className="px-4 py-1.5 bg-slate-950 border-t border-white/5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] font-medium">
              <FileText className="w-3.5 h-3.5" />
              <span className="flex-1 truncate">{attachedFile.name}</span>
              <button
                onClick={() => setAttachedFile(null)}
                className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-red-400 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Input Bar */}
        <form onSubmit={handleSend} className="p-4 border-t border-white/10 bg-slate-950/80 flex gap-2 items-center">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.xml,.yaml,.yml,.log,.cfg,.config,.ini,.env"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isExtracting}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-emerald-300 disabled:opacity-50 border border-white/10 transition-all"
            title="Attach file"
          >
            {isExtracting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Paperclip className="w-4 h-4" />
            )}
          </button>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              attachedFile
                ? 'Ask about this document or give instructions...'
                : 'Ask about requisitions, candidates, or attach a file...'
            }
            className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 placeholder-slate-500"
          />
          <button
            type="submit"
            disabled={isLoading || (!prompt.trim() && !attachedFile)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center disabled:opacity-50 transition-all"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

function buildWelcomeMessage(jobs: Job[]): string {
  const openJobs = jobs.filter((j) => j.status === 'Open');
  const highPrio = openJobs.filter((j) => j.priority === 'High');
  const depts = [...new Set(jobs.map((j) => j.department))];

  let msg = 'Welcome to the **Advanced Chat Bot**! I\'m aware of your entire recruitment ecosystem.\n\n';

  if (jobs.length === 0) {
    msg += 'No requisitions found yet. Create some jobs to get started!';
  } else {
    msg += `**Current Requisitions Overview:**\n`;
    msg += `- ${jobs.length} total requisitions across ${depts.length} departments\n`;
    msg += `- ${openJobs.length} actively open positions`;
    if (highPrio.length > 0) msg += ` (${highPrio.length} high priority)`;
    msg += '\n\n';

    if (openJobs.length > 0) {
      msg += '**Active Open Roles:**\n';
      openJobs.forEach((j) => {
        const prioIcon = j.priority === 'High' ? '🔥' : j.priority === 'Medium' ? '📌' : '📋';
        msg += `- ${prioIcon} **${j.title}** — ${j.department} | ${j.location} | Priority: ${j.priority} | ${j.candidate_count || 0} candidates\n`;
      });
    }

    msg += '\nI can help with:\n';
    msg += '- 📊 **Pipeline analysis** — bottlenecks, stage distribution, hiring velocity\n';
    msg += '- 🔍 **Candidate insights** — top matches, skill gaps, sourcing suggestions\n';
    msg += '- 🌐 **Internet research** — toggle web search on above for market data\n';
    msg += '- 📝 **JD review & strategy** — improve descriptions, refine requirements\n';
    msg += '- 📈 **Hiring metrics** — time-to-hire, acceptance rates, channel performance\n';
    msg += '- 📎 **File attachment** — attach a resume, JD, or any document for AI analysis\n\n';
    msg += 'What would you like to explore?';
  }

  return msg;
}
