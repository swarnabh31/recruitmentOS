import React, { useState, useEffect } from 'react';
import {
  Upload,
  FileText,
  History,
  AlertTriangle,
  CheckCircle,
  Eye,
  X,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sparkles,
  Cpu,
} from 'lucide-react';
import { extractTextFromFile, getSessions, getSession, saveSession } from '../lib/api';
import { Session } from '../types';

interface SidebarProps {
  sessionId: string;
  jdText: string;
  jdFilename: string;
  selectedModel: string;
  onModelChange: (model: string) => void;
  onJdLoaded: (text: string, filename: string) => void;
  onSessionLoaded: (sessionId: string, text: string, filename: string) => void;
  activeTab: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessionId,
  jdText,
  jdFilename,
  selectedModel,
  onModelChange,
  onJdLoaded,
  onSessionLoaded,
  activeTab,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showActiveJdModal, setShowActiveJdModal] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Load history sessions on mount and when sessionId changes
  useEffect(() => {
    loadHistorySessions();
  }, [sessionId]);

  const loadHistorySessions = async () => {
    const list = await getSessions();
    setSessions(list);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File exceeds 10MB limit.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const result = await extractTextFromFile(file);
    setIsUploading(false);

    if (result.success) {
      onJdLoaded(result.text, result.filename);
      // Save session to backend DB
      await saveSession({
        id: sessionId,
        jd_text: result.text,
        jd_filename: result.filename,
        model: selectedModel,
      });
      loadHistorySessions();
    } else {
      setUploadError(result.error || 'Failed to extract text from file.');
    }
  };

  const handleLoadSession = async (sId: string) => {
    if (!sId) return;
    setIsLoadingHistory(true);
    const data = await getSession(sId);
    setIsLoadingHistory(false);
    if (data && data.session) {
      onSessionLoaded(data.session.id, data.session.jd_text, data.session.jd_filename);
    }
  };

  const charCount = jdText.length;

  return (
    <aside className="w-80 bg-slate-900 border-r border-slate-800 text-slate-200 flex flex-col h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto">
      <div className="p-4 space-y-6 flex-1">
        {/* Model Selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            Select AI Model
          </label>
          <select
            value={selectedModel}
            onChange={(e) => onModelChange(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Auto (Ollama)</option>
          </select>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium pt-0.5">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Ollama Connected</span>
          </div>
        </div>

        <hr className="border-slate-800" />

        {/* Job Description Upload */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              Active Job Description
            </label>
            {jdText && (
              <button
                onClick={() => setShowActiveJdModal(true)}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
              >
                <Eye className="w-3 h-3" /> View
              </button>
            )}
          </div>

          <div className="relative">
            <label
              htmlFor="sidebar-jd-upload"
              className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                isUploading
                  ? 'border-indigo-500 bg-indigo-950/20'
                  : 'border-slate-700 hover:border-indigo-500 bg-slate-800/50 hover:bg-slate-800'
              }`}
            >
              <Upload className="w-6 h-6 text-slate-400 mb-1.5" />
              <span className="text-xs font-medium text-slate-300 text-center">
                {isUploading ? 'Extracting text...' : 'Upload JD (PDF, DOCX, TXT)'}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5">Max 10MB file size</span>
              <input
                id="sidebar-jd-upload"
                type="file"
                accept=".pdf,.docx,.doc,.txt"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="hidden"
              />
            </label>
          </div>

          {uploadError && (
            <div className="bg-red-950/80 border border-red-800 text-red-200 text-xs p-2.5 rounded-md flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Active JD Card */}
          {jdText ? (
            <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 truncate max-w-[160px]">
                  {jdFilename || 'Active Job Description'}
                </span>
                <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded text-[10px] font-mono">
                  {charCount.toLocaleString()} chars
                </span>
              </div>
              <p className="text-slate-400 text-[11px] line-clamp-3 italic">
                "{jdText.slice(0, 140)}..."
              </p>

              {charCount > 8000 && (
                <div className="bg-amber-950/80 border border-amber-800 text-amber-300 text-[11px] p-2 rounded flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Large JD (~{charCount} chars)</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-slate-500 text-xs italic">
              No active JD. Upload one above or use the "Generate JD" tab.
            </p>
          )}
        </div>

        <hr className="border-slate-800" />

        {/* History Panel */}
        <div className="space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-indigo-400" />
            Session History
          </label>

          {sessions.length > 0 ? (
            <div className="space-y-2">
              <select
                value={selectedSessionId}
                onChange={(e) => {
                  setSelectedSessionId(e.target.value);
                  handleLoadSession(e.target.value);
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Load previous session...</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.jd_filename || 'Untitled'} ({new Date(s.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-slate-500 text-xs italic">No saved sessions found.</p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950 text-[11px] text-slate-500 flex items-center justify-between font-mono">
        <span>Session ID:</span>
        <span className="text-indigo-400">{sessionId.slice(0, 10)}...</span>
      </div>

      {/* Active JD Full Content Modal */}
      {showActiveJdModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                {jdFilename || 'Active Job Description'}
              </h3>
              <button
                onClick={() => setShowActiveJdModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto font-sans text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-mono bg-slate-950/50 m-4 rounded-lg border border-slate-800">
              {jdText}
            </div>
            <div className="p-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowActiveJdModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-4 py-1.5 rounded-lg border border-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
