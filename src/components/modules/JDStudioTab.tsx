import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useModel } from '../../lib/ModelContext';
import { Job } from '../../types';
import { JDStudioSidebar } from './JDStudioPanel';
import { JDAnalysisPanel } from './JDAnalysisPanel';
import { Wand2, FileCheck2, MessageSquare, Cpu, Sparkles } from 'lucide-react';

interface JDStudioTabProps {
  jobs?: Job[];
}

type SubTab = 'generate' | 'analysis' | 'chat';

export const JDStudioTab: React.FC<JDStudioTabProps> = ({ jobs = [] }) => {
  const { selectedModel, models, refreshModels } = useModel();

  // Shared state — the sidebar, analysis and chat panels all read/write this.
  const [sessionId, setSessionId] = useState<string>(() => `js_${Date.now()}`);
  const [jdText, setJdText] = useState<string>('');
  const [jdFilename, setJdFilename] = useState<string>('');

  const [activeSubTab, setActiveSubTab] = useState<SubTab>('analysis');

  // Seed the active JD from the most recently created job if the user has one,
  // so the tab works sensibly even on first open.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || jobs.length === 0) return;
    // Pick the newest job (jobs array is typically sorted by creation)
    const newest = [...jobs].sort((a, b) => {
      const at = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bt - at;
    })[0];
    if (newest?.jd_text && newest.jd_text.length > 50) {
      const file = newest.jd_filename || `${newest.title || 'job'}.md`;
      setJdText(prev => prev || newest.jd_text);
      setJdFilename(prev => prev || file);
    }
    seededRef.current = true;
  }, [jobs]);

  const onJdLoaded = useCallback((text: string, filename: string) => {
    setJdText(text);
    setJdFilename(filename);
  }, []);

  const onJdUpdated = useCallback((text: string, filename: string) => {
    setJdText(text);
    setJdFilename(filename);
  }, []);

  const onSessionLoaded = useCallback((id: string, text: string, filename: string) => {
    setSessionId(id);
    setJdText(text);
    setJdFilename(filename);
  }, []);

  const subTabs: Array<{ id: SubTab; label: string; icon: typeof Sparkles }> = [
    { id: 'analysis', label: 'Analyze JD', icon: FileCheck2 },
    { id: 'generate', label: 'Generate / Refine', icon: Wand2 },
    { id: 'chat', label: 'Chat with JD', icon: MessageSquare },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Wand2 className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-white">JD Studio</h2>
            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono ${jdText ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-400'}`}>
              {jdText ? 'JD LOADED' : 'AWAITING INPUT'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Upload, generate, analyze and iterate on job descriptions. Sessions are saved to your history.
          </p>
          <div className="flex items-center gap-2 mt-3 text-[11px] text-slate-400 font-mono">
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            <span>Active model:</span>
            <span className="text-indigo-300">{selectedModel || 'none loaded'}</span>
            {models.length > 0 && (
              <button
                onClick={refreshModels}
                className="ml-2 text-slate-500 hover:text-indigo-300 transition-colors"
              >
                refresh
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <JDStudioSidebar
            sessionId={sessionId}
            jdText={jdText}
            jdFilename={jdFilename}
            selectedModel={selectedModel}
            onJdLoaded={onJdLoaded}
            onSessionLoaded={onSessionLoaded}
            activeTab={activeSubTab}
          />
        </div>
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-slate-900/40 border border-white/10 rounded-xl p-1.5 flex space-x-1 shadow-sm">
            {subTabs.map(({ id, label, icon: Icon }) => {
              const isActive = activeSubTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveSubTab(id)}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg font-semibold text-xs transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <JDAnalysisPanel
            sessionId={sessionId}
            jdText={jdText}
            jdFilename={jdFilename}
            selectedModel={selectedModel}
            onJdUpdated={onJdUpdated}
            externalActiveSubTab={activeSubTab}
            onExternalSubTabChange={setActiveSubTab}
          />
        </div>
      </div>
    </div>
  );
};
