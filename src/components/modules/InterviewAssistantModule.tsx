import React, { useState } from 'react';
import { Candidate, Job } from '../../types';
import { useModel } from '../../lib/ModelContext';
import { generateInterviewKit } from '../../lib/api';
import { Sparkles, Loader2, FileQuestion, AlertTriangle, ShieldCheck, CheckCircle2, User, HelpCircle } from 'lucide-react';

interface InterviewAssistantModuleProps {
  candidates: Candidate[];
  jobs: Job[];
  selectedCandidateForInterview?: Candidate | null;
}

export const InterviewAssistantModule: React.FC<InterviewAssistantModuleProps> = ({
  candidates,
  jobs,
  selectedCandidateForInterview,
}) => {
  const { selectedModel } = useModel();
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>(
    selectedCandidateForInterview?.id || candidates[0]?.id || ''
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [interviewKit, setInterviewKit] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateKit = async () => {
    if (!selectedCandidateId) return;
    setIsGenerating(true);
    setError(null);
    try {
      // Client-side safety net: never let a hung model freeze the button.
      const gen = generateInterviewKit(selectedCandidateId, undefined, selectedModel);
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timed out waiting for the AI engine. It may be busy or offline — try again, or pick a smaller model.')), 180000)
      );
      const res = await Promise.race([gen, timeout]);
      if (res.success && res.kit) {
        setInterviewKit(res.kit);
      } else {
        setError(res.error || 'The AI engine returned an empty kit. Try again or pick a different model in the header.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to reach the AI engine. Check that the server is running and try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedCandidate = candidates.find((c) => c.id === selectedCandidateId) || candidates[0];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <FileQuestion className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-white">AI Interview Intelligence Assistant</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Generate candidate-specific interview kits, technical deep-dive questions, and red-flag verification checks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedCandidateId}
            onChange={(e) => setSelectedCandidateId(e.target.value)}
            className="bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.job_title})</option>
            ))}
          </select>

          <button
            onClick={handleGenerateKit}
            disabled={isGenerating || !selectedCandidateId}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 border border-white/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-emerald-300" />}
            <span>Generate Kit</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-950/40 backdrop-blur-xl border border-rose-500/40 rounded-2xl p-5 shadow-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-rose-300">Could not generate the interview kit</h3>
            <p className="text-xs text-rose-200/90 leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {interviewKit ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Technical Questions */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4.5 h-4.5 text-indigo-400" /> Tailored Technical Questions
            </h3>
            <div className="space-y-3 text-xs">
              {interviewKit.technical_questions?.map((q: string, idx: number) => (
                <div key={idx} className="p-3.5 bg-slate-950/80 border border-white/10 rounded-xl space-y-1">
                  <span className="font-bold text-indigo-300">Technical Probe #{idx + 1}</span>
                  <p className="text-slate-200 leading-relaxed">{q}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Behavioral & Red Flags to Verify */}
          <div className="space-y-6">
            <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4.5 h-4.5 text-emerald-400" /> Behavioral & Leadership Questions
              </h3>
              <div className="space-y-3 text-xs">
                {interviewKit.behavioral_questions?.map((q: string, idx: number) => (
                  <div key={idx} className="p-3.5 bg-slate-950/80 border border-white/10 rounded-xl space-y-1">
                    <span className="font-bold text-emerald-300">Scenario #{idx + 1}</span>
                    <p className="text-slate-200 leading-relaxed">{q}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-amber-950/30 backdrop-blur-xl border border-amber-500/30 rounded-2xl p-6 shadow-xl space-y-3">
              <h3 className="text-base font-bold text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4.5 h-4.5 text-amber-400" /> Red Flags & Weak Areas to Verify
              </h3>
              <ul className="space-y-2 text-xs text-amber-100">
                {interviewKit.red_flags_to_verify?.map((rf: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 bg-amber-950/50 p-2.5 rounded-xl border border-amber-500/20">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>{rf}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-12 text-center text-slate-400 space-y-3">
          <HelpCircle className="w-10 h-10 text-indigo-400 mx-auto" />
          <h3 className="text-base font-bold text-white">Generate Interview Assistant Kit</h3>
          <p className="text-xs max-w-md mx-auto">
            Select candidate <span className="text-indigo-300 font-bold">{selectedCandidate?.name}</span> and click "Generate Kit" to receive customized questions tailored to their resume and job requirements.
          </p>
        </div>
      )}
    </div>
  );
};
