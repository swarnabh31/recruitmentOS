import React, { useState } from 'react';
import {
  Wand2,
  FileCheck2,
  MessageSquare,
  Download,
  Copy,
  ExternalLink,
  Check,
  Send,
  Trash2,
  Sparkles,
  Loader2,
  Code2,
} from 'lucide-react';
import { MarkdownView } from '../MarkdownView';
import {
  generateJD,
  reviseJD,
  analyzeJD,
  chatJD,
  saveSession,
} from '../../lib/api';
import { JDAnalysis, ChatMessage } from '../../types';

interface JDAnalysisTabProps {
  sessionId: string;
  jdText: string;
  jdFilename: string;
  selectedModel: string;
  onJdUpdated: (text: string, filename: string) => void;
  externalActiveSubTab?: 'generate' | 'analysis' | 'chat';
  onExternalSubTabChange?: (sub: 'generate' | 'analysis' | 'chat') => void;
}

export const JDAnalysisPanel: React.FC<JDAnalysisTabProps> = ({
  sessionId,
  jdText,
  jdFilename,
  selectedModel,
  onJdUpdated,
  externalActiveSubTab,
  onExternalSubTabChange,
}) => {
  const [activeSubTab, setActiveSubTabLocal] = useState<'generate' | 'analysis' | 'chat'>('analysis');
  const setActiveSubTab = (sub: 'generate' | 'analysis' | 'chat') => {
    setActiveSubTabLocal(sub);
    onExternalSubTabChange?.(sub);
  };

  // Stay in sync if the parent drives the active sub-tab (e.g. JD Studio nav row)
  React.useEffect(() => {
    if (externalActiveSubTab) {
      setActiveSubTabLocal(externalActiveSubTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalActiveSubTab]);


  // Subtab 1: Generate JD state
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedJdText, setGeneratedJdText] = useState('');
  const [revisionChat, setRevisionChat] = useState<Array<{ role: string; content: string }>>([]);
  const [revisionInput, setRevisionInput] = useState('');
  const [isRevising, setIsRevising] = useState(false);

  // Subtab 2: Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<JDAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [copiedSearchIdx, setCopiedSearchIdx] = useState<number | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Subtab 3: Chat with JD state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);

  // ---------------------------------------------------------------------------
  // Generate JD Handler
  // ---------------------------------------------------------------------------
  const handleGenerateJd = async () => {
    if (!generatePrompt.trim()) return;
    setIsGenerating(true);
    setRevisionChat([]);

    const res = await generateJD(generatePrompt, selectedModel);
    setIsGenerating(false);

    if (res.success && res.text) {
      setGeneratedJdText(res.text);
      onJdUpdated(res.text, 'AI_Generated_JD.md');
      await saveSession({
        id: sessionId,
        jd_text: res.text,
        jd_filename: 'AI_Generated_JD.md',
        model: selectedModel,
      });
    } else {
      alert(res.error || 'Failed to generate job description.');
    }
  };

  // Revision handler
  const handleReviseJd = async () => {
    if (!revisionInput.trim() || !generatedJdText) return;
    const userMsg = revisionInput.trim();
    setRevisionInput('');
    setRevisionChat((prev) => [...prev, { role: 'user', content: userMsg }]);

    setIsRevising(true);
    const res = await reviseJD(generatedJdText, userMsg, selectedModel);
    setIsRevising(false);

    if (res.success && res.text) {
      setGeneratedJdText(res.text);
      setRevisionChat((prev) => [
        ...prev,
        { role: 'assistant', content: 'Job Description updated with requested changes.' },
      ]);
      onJdUpdated(res.text, 'AI_Generated_JD.md');
      await saveSession({
        id: sessionId,
        jd_text: res.text,
        jd_filename: 'AI_Generated_JD.md',
        model: selectedModel,
      });
    } else {
      setRevisionChat((prev) => [
        ...prev,
        { role: 'assistant', content: `Error revising JD: ${res.error}` },
      ]);
    }
  };

  // ---------------------------------------------------------------------------
  // Analyze JD Handler
  // ---------------------------------------------------------------------------
  const handleAnalyzeJd = async () => {
    if (!jdText || jdText.length < 50) return;
    setIsAnalyzing(true);
    setAnalysisError(null);

    const res = await analyzeJD(jdText, selectedModel);
    setIsAnalyzing(false);

    if (res.success && res.data) {
      setAnalysisResult(res.data);
    } else {
      setAnalysisError(res.error || 'Failed to analyze job description.');
    }
  };

  // Helper for Google X-ray URLs
  const getXrayUrl = (searchStr: string) => {
    let clean = searchStr.trim();
    if (!clean.startsWith('site:linkedin.com/in')) {
      clean = `site:linkedin.com/in/ ${clean}`;
    }
    return `https://www.google.com/search?q=${encodeURIComponent(clean)}`;
  };

  const copyToClipboard = (text: string, type: 'search' | 'email', idx?: number) => {
    navigator.clipboard.writeText(text);
    if (type === 'search' && idx !== undefined) {
      setCopiedSearchIdx(idx);
      setTimeout(() => setCopiedSearchIdx(null), 2000);
    } else if (type === 'email') {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  // Download helpers
  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---------------------------------------------------------------------------
  // Chat with JD Handler
  // ---------------------------------------------------------------------------
  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || !jdText) return;
    const userMsg = chatInput.trim();
    setChatInput('');

    const newChat: ChatMessage[] = [
      ...chatMessages,
      { id: Date.now().toString(), role: 'user', content: userMsg },
    ];
    setChatMessages(newChat);

    setIsChatting(true);
    const res = await chatJD(
      jdText,
      userMsg,
      newChat.map((m) => ({ role: m.role, content: m.content })),
      selectedModel
    );
    setIsChatting(false);

    if (res.success && res.text) {
      setChatMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', content: res.text },
      ]);
    } else {
      setChatMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', content: `Error: ${res.error}` },
      ]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Subtab Navigation Header — hidden when a parent drives the active sub-tab (JD Studio tab) */}
      {!onExternalSubTabChange && (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-1.5 flex space-x-1 shadow-sm">
        <button
          onClick={() => setActiveSubTab('analysis')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg font-semibold text-xs transition-all ${
            activeSubTab === 'analysis'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <FileCheck2 className="w-4 h-4" />
          <span>Analysis</span>
        </button>

        <button
          onClick={() => setActiveSubTab('generate')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg font-semibold text-xs transition-all ${
            activeSubTab === 'generate'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Wand2 className="w-4 h-4" />
          <span>Generate JD</span>
        </button>

        <button
          onClick={() => setActiveSubTab('chat')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg font-semibold text-xs transition-all ${
            activeSubTab === 'chat'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Chat with JD</span>
        </button>
      </div>
      )}

      {/* SUBTAB 1: ANALYSIS */}
      {activeSubTab === 'analysis' && (
        <div className="space-y-6">
          {!jdText ? (
            <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl p-8 text-center space-y-3">
              <FileCheck2 className="w-10 h-10 text-amber-500 mx-auto" />
              <h3 className="text-base font-bold text-amber-200">
                No Active Job Description
              </h3>
              <p className="text-xs text-amber-400 max-w-md mx-auto">
                Please upload a job description in the sidebar or use the "Generate JD" tab to create a new one.
              </p>
            </div>
          ) : (
            <>
              {/* Trigger & Export Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 p-4 border border-slate-800 rounded-xl shadow-sm">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    Active Job Description Analysis
                  </h3>
                  <p className="text-xs text-slate-400">
                    {jdFilename || 'Job Description'} ({jdText.length.toLocaleString()} characters)
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleAnalyzeJd}
                    disabled={isAnalyzing}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-semibold px-5 py-2.5 rounded-lg shadow-sm flex items-center space-x-2 transition-all"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Analyzing JD...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Analyze Job Description</span>
                      </>
                    )}
                  </button>

                  {analysisResult && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() =>
                          downloadFile(
                            JSON.stringify(analysisResult, null, 2),
                            'jd_analysis.json',
                            'application/json'
                          )
                        }
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium px-3 py-2 rounded-lg border border-slate-700 flex items-center space-x-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>JSON</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {analysisError && (
                <div className="bg-red-950/40 border border-red-800 text-red-200 text-xs p-4 rounded-xl">
                  {analysisError}
                </div>
              )}

              {/* Analysis Results View */}
              {analysisResult && (
                <div className="space-y-6">
                  {/* Role Summary */}
                  <div className="bg-slate-900 p-6 border border-slate-800 rounded-xl shadow-sm space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                      Role Summary
                    </h4>
                    <p className="text-sm font-medium text-slate-200 leading-relaxed">
                      {analysisResult.role_summary}
                    </p>
                  </div>

                  {/* Skills Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Must-Have Skills */}
                    <div className="bg-slate-900 p-6 border border-slate-800 rounded-xl shadow-sm space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                        <Check className="w-4 h-4" /> Must-Have Skills
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {analysisResult.must_have_skills?.map((skill, idx) => (
                          <span
                            key={idx}
                            className="bg-emerald-950/60 text-emerald-300 border border-emerald-800 text-xs font-medium px-2.5 py-1 rounded-md"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Good-To-Have Skills */}
                    <div className="bg-slate-900 p-6 border border-slate-800 rounded-xl shadow-sm space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4" /> Good-To-Have Skills
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {analysisResult.good_to_have_skills?.map((skill, idx) => (
                          <span
                            key={idx}
                            className="bg-sky-950/60 text-sky-300 border border-sky-800 text-xs font-medium px-2.5 py-1 rounded-md"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Experience & Target Companies */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-900 p-5 border border-slate-800 rounded-xl shadow-sm">
                      <span className="text-xs font-bold text-slate-500 uppercase">
                        Experience Required:
                      </span>
                      <p className="text-sm font-semibold text-slate-200 mt-1">
                        {analysisResult.experience_required}
                      </p>
                    </div>

                    <div className="bg-slate-900 p-5 border border-slate-800 rounded-xl shadow-sm">
                      <span className="text-xs font-bold text-slate-500 uppercase">
                        Target Company Types:
                      </span>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {analysisResult.target_company_types?.map((type, idx) => (
                          <span
                            key={idx}
                            className="bg-slate-800 text-slate-300 text-xs px-2.5 py-1 rounded-md"
                          >
                            {type}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* LinkedIn X-Ray Search Strings */}
                  <div className="bg-slate-900 p-6 border border-slate-800 rounded-xl shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                        <Code2 className="w-4 h-4" /> LinkedIn X-Ray Search Strings
                      </h4>
                      <span className="text-xs text-slate-400">
                        Click "Search →" to run directly in Google
                      </span>
                    </div>

                    <div className="space-y-3">
                      {analysisResult.linkedin_xray_searches?.map((searchStr, idx) => {
                        let cleanStr = searchStr.trim();
                        if (!cleanStr.startsWith('site:linkedin.com/in')) {
                          cleanStr = `site:linkedin.com/in/ ${cleanStr}`;
                        }
                        return (
                          <div
                            key={idx}
                            className="bg-slate-900 text-slate-200 p-3.5 rounded-lg border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono"
                          >
                            <span className="break-all select-all">{cleanStr}</span>
                            <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                              <button
                                onClick={() => copyToClipboard(cleanStr, 'search', idx)}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded border border-slate-700 flex items-center gap-1 font-sans text-xs"
                              >
                                {copiedSearchIdx === idx ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>

                              <a
                                href={getXrayUrl(cleanStr)}
                                target="_blank"
                                rel="noreferrer"
                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded font-sans text-xs font-medium flex items-center gap-1 shadow-sm"
                              >
                                <span>Search →</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Interview Questions */}
                  <div className="bg-slate-900 p-6 border border-slate-800 rounded-xl shadow-sm space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                      Tailored Screening & Technical Questions
                    </h4>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-slate-300">
                      {analysisResult.interview_questions?.map((q, idx) => (
                        <li key={idx} className="p-2 rounded hover:bg-slate-800/50">
                          {q}
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Outreach Email Template */}
                  <div className="bg-slate-900 p-6 border border-slate-800 rounded-xl shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                        Candidate Outreach Email Template
                      </h4>
                      <button
                        onClick={() =>
                          copyToClipboard(analysisResult.outreach_email_template || '', 'email')
                        }
                        className="bg-slate-800 text-slate-300 text-xs font-medium px-3 py-1.5 rounded-md border border-slate-700 flex items-center gap-1.5"
                      >
                        {copiedEmail ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Copied Email</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Template</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs font-mono whitespace-pre-wrap text-slate-200">
                      {analysisResult.outreach_email_template}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* SUBTAB 2: GENERATE JD */}
      {activeSubTab === 'generate' && (
        <div className="space-y-6">
          <div className="bg-slate-900 p-6 border border-slate-800 rounded-xl shadow-sm space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-indigo-400" />
                AI Job Description Generator
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Describe your ideal candidate (role, skills, experience, company culture) and let AI draft a full professional JD.
              </p>
            </div>

            <textarea
              value={generatePrompt}
              onChange={(e) => setGeneratePrompt(e.target.value)}
              placeholder="e.g. I need a senior frontend engineer with 5+ years of React experience, familiar with TypeScript and Next.js. They should have experience building design systems and working in a product-led growth startup. Remote-friendly, based in IST timezone."
              className="w-full h-36 p-3.5 text-xs text-slate-200 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-sans"
            />

            <div className="flex justify-end">
              <button
                onClick={handleGenerateJd}
                disabled={isGenerating || !generatePrompt.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-semibold px-6 py-2.5 rounded-lg shadow-sm flex items-center space-x-2 transition-all"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating JD...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    <span>Generate Job Description</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Generated JD Display */}
          {generatedJdText && (
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-slate-800">
                  <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-emerald-500" />
                    Generated Job Description
                  </h4>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => downloadFile(generatedJdText, 'generated_jd.md', 'text/markdown')}
                      className="bg-slate-800 text-slate-300 text-xs font-medium px-3 py-1.5 rounded-md border border-slate-700 flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .md</span>
                    </button>

                    <button
                      onClick={() => setGeneratedJdText('')}
                      className="text-red-500 hover:text-red-600 p-1.5 rounded"
                      title="Clear Generated JD"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="bg-slate-950 p-6 rounded-xl border border-slate-800">
                  <MarkdownView content={generatedJdText} />
                </div>
              </div>

              {/* Refine with Chat */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm p-6 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> Refine & Revise JD with AI Chat
                </h4>
                <p className="text-xs text-slate-400">
                  Request adjustments (e.g. "Add Kubernetes requirement", "Make the tone more relaxed", "Lower experience to 3 years")
                </p>

                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {revisionChat.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg text-xs ${
                        msg.role === 'user'
                          ? 'bg-indigo-950/50 text-indigo-200 border border-indigo-800'
                          : 'bg-slate-800 text-slate-200'
                      }`}
                    >
                      <span className="font-bold block mb-0.5 capitalize">{msg.role}:</span>
                      {msg.content}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={revisionInput}
                    onChange={(e) => setRevisionInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleReviseJd()}
                    placeholder="Suggest a change to the job description..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={handleReviseJd}
                    disabled={isRevising || !revisionInput.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                  >
                    {isRevising ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Revise</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: CHAT WITH JD */}
      {activeSubTab === 'chat' && (
        <div className="space-y-6">
          {!jdText ? (
            <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl p-8 text-center space-y-3">
              <MessageSquare className="w-10 h-10 text-amber-500 mx-auto" />
              <h3 className="text-base font-bold text-amber-200">
                No Active Job Description
              </h3>
              <p className="text-xs text-amber-400 max-w-md mx-auto">
                Upload or generate a JD to start chatting with context.
              </p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm flex flex-col h-[520px]">
              {/* Chat Header */}
              <div className="p-4 border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-indigo-600" />
                    Recruiter Q&A Chat
                  </h3>
                  <p className="text-xs text-slate-400">
                    Ask questions about candidate requirements, screening criteria, or strategy.
                  </p>
                </div>

                {chatMessages.length > 0 && (
                  <button
                    onClick={() =>
                      downloadFile(
                        chatMessages.map((m) => `**${m.role.toUpperCase()}**: ${m.content}`).join('\n\n'),
                        'chat_log.md',
                        'text/markdown'
                      )
                    }
                    className="text-xs text-slate-400 border border-slate-700 px-3 py-1.5 rounded-md flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Export Log
                  </button>
                )}
              </div>

              {/* Chat Messages */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center text-xs text-slate-400 italic">
                    Type a question to start chatting about the active job description.
                  </div>
                ) : (
                  chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        msg.role === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl p-4 text-xs shadow-sm ${
                          msg.role === 'user'
                            ? 'bg-indigo-600 text-white rounded-br-none'
                            : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700'
                        }`}
                      >
                        <MarkdownView content={msg.content} />
                      </div>
                    </div>
                  ))
                )}
                {isChatting && (
                  <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-800 p-3 rounded-xl w-32">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                    <span>Thinking...</span>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="p-4 border-slate-800 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                  placeholder="Ask about candidate requirements, skills to look for, etc..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={handleSendChatMessage}
                  disabled={isChatting || !chatInput.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
