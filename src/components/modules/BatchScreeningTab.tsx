import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useModel } from '../../lib/ModelContext';
import { Job } from '../../types';
import { ResumeEvalPanel } from './ResumeEvalPanel';
import { Users, Cpu, Loader2, Sparkles } from 'lucide-react';

interface BatchScreeningTabProps {
  jobs?: Job[];
}

type BatchPhase = 'idle' | 'running' | 'done';

export const BatchScreeningTab: React.FC<BatchScreeningTabProps> = ({ jobs = [] }) => {
  const { selectedModel, models, refreshModels } = useModel();

  const [sessionId, setSessionId] = useState<string>(() => `batch_${Date.now()}`);
  const [jdText, setJdText] = useState<string>('');
  const [jdFilename, setJdFilename] = useState<string>('');
  const [phase, setPhase] = useState<BatchPhase>('idle');

  // Seed from latest job so the tab works without extra wiring
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || jobs.length === 0) return;
    const newest = [...jobs].sort((a, b) => {
      const at = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bt - at;
    })[0];
    if (newest?.jd_text && newest.jd_text.length > 50) {
      setJdText(prev => prev || newest.jd_text);
      setJdFilename(prev => prev || (newest.jd_filename || `${newest.title || 'job'}.md`));
    }
    seededRef.current = true;
  }, [jobs]);

  const onJdUpdated = useCallback((text: string, filename: string) => {
    setJdText(text);
    setJdFilename(filename);
  }, []);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
              <Users className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-white">Batch Resume Screening</h2>
            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono ${jdText ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-400'}`}>
              {jdText ? 'JD LOADED' : 'AWAITING INPUT'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Upload a batch of resumes and get ranked, scored scorecards against the active JD. Export results to CSV.
          </p>
          <div className="flex items-center gap-2 mt-3 text-[11px] text-slate-400 font-mono">
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            <span>Active model:</span>
            <span className="text-amber-300">{selectedModel || 'none loaded'}</span>
            {models.length > 0 && (
              <button
                onClick={refreshModels}
                className="ml-2 text-slate-500 hover:text-amber-300 transition-colors"
              >
                refresh
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-slate-900/40 border border-white/10 rounded-xl p-4 flex items-center justify-between">
        <div className="text-xs text-slate-400">
          <span className="text-slate-500">Active JD:</span>{' '}
          <span className={jdFilename ? 'text-emerald-400' : 'text-slate-500'}>
            {jdFilename || 'not provided'}
          </span>
        </div>
        <div className="text-xs text-slate-500 font-mono">
          {phase === 'running' && (
            <span className="text-amber-400 animate-pulse">
              <Loader2 className="inline w-3 h-3 mr-1 animate-spin" />
              screening in progress…
            </span>
          )}
          {phase === 'done' && (
            <span className="text-emerald-400">
              <Sparkles className="inline w-3 h-3 mr-1" />
              scorecards ready
            </span>
          )}
          {phase === 'idle' && <span>awaiting resumes</span>}
        </div>
      </div>

      <ResumeEvalPanel
        sessionId={sessionId}
        jdText={jdText}
        jdFilename={jdFilename}
        selectedModel={selectedModel}
      />
    </div>
  );
};
