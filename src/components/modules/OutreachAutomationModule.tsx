import React, { useState } from 'react';
import { Candidate, Job } from '../../types';
import { useModel } from '../../lib/ModelContext';
import { generateOutreachSequence } from '../../lib/api';
import { Mail, Sparkles, Send, Loader2, Copy, Check, Clock, Linkedin, MessageSquare, AlertTriangle } from 'lucide-react';

interface OutreachAutomationModuleProps {
  candidates: Candidate[];
  jobs: Job[];
  selectedCandidateForOutreach?: Candidate | null;
}

export const OutreachAutomationModule: React.FC<OutreachAutomationModuleProps> = ({
  candidates,
  jobs,
  selectedCandidateForOutreach,
}) => {
  const { selectedModel } = useModel();
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>(
    selectedCandidateForOutreach?.id || candidates[0]?.id || ''
  );
  const [tone, setTone] = useState('Warm, professional, and compelling');
  const [isGenerating, setIsGenerating] = useState(false);
  const [sequence, setSequence] = useState<any | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateOutreach = async () => {
    if (!selectedCandidateId) return;
    setIsGenerating(true);
    setError(null);
    try {
      // Client-side safety net: never let a hung model freeze the button.
      const gen = generateOutreachSequence(selectedCandidateId, undefined, tone, selectedModel);
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timed out waiting for the AI engine. It may be busy or offline — try again, or pick a smaller model.')), 180000)
      );
      const res = await Promise.race([gen, timeout]);
      if (res.success && res.sequence) {
        setSequence(res.sequence);
      } else {
        setError(res.error || 'The AI engine returned an empty campaign. Try again or pick a different model in the header.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to reach the AI engine. Check that the server is running and try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const selectedCandidate = candidates.find((c) => c.id === selectedCandidateId) || candidates[0];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-purple-500/20 text-purple-400 rounded-xl border border-purple-500/30">
              <Mail className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-white">Outreach & Email Automation Engine</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Generate multi-step personalized email & LinkedIn campaigns using AI.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedCandidateId}
            onChange={(e) => setSelectedCandidateId(e.target.value)}
            className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.current_title})</option>
            ))}
          </select>

          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-indigo-300 font-bold focus:outline-none"
          >
            <option value="Warm, professional, and compelling">Warm & Compelling Tone</option>
            <option value="Direct, concise engineering-first">Engineering Direct Tone</option>
            <option value="Executive leadership tone">Executive Tone</option>
          </select>

          <button
            onClick={handleGenerateOutreach}
            disabled={isGenerating || !selectedCandidateId}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 border border-white/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>Generate Campaign</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-950/40 backdrop-blur-xl border border-rose-500/40 rounded-2xl p-5 shadow-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-rose-300">Could not generate the outreach campaign</h3>
            <p className="text-xs text-rose-200/90 leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {sequence ? (
        <div className="space-y-6">
          {/* Campaign Overview Card */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl space-y-2">
            <span className="text-[10px] font-extrabold uppercase text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
              Personalized Campaign Subject Line
            </span>
            <h3 className="text-lg font-bold text-white">{sequence.subject}</h3>
            <p className="text-xs text-slate-400">Target Candidate: {sequence.candidate_name} ({sequence.job_title})</p>
          </div>

          {/* Sequence Steps */}
          <div className="space-y-4">
            {sequence.steps?.map((step: any, idx: number) => (
              <div
                key={idx}
                className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl space-y-3 relative group"
              >
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center space-x-3">
                    <span className="w-8 h-8 rounded-xl bg-purple-600/20 text-purple-300 flex items-center justify-center font-black text-xs border border-purple-500/30">
                      Step {step.step_number}
                    </span>
                    <div>
                      <h4 className="font-bold text-white text-xs">
                        Channel: {step.channel === 'Email' ? '📧 Email' : step.channel === 'LinkedIn' ? '💼 LinkedIn' : '💬 WhatsApp'}
                      </h4>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-indigo-400" />
                        {step.delay_days === 0 ? 'Send Immediately (Day 0)' : `Follow up after ${step.delay_days} days`}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleCopy(step.content, idx)}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold border border-white/10 transition-all flex items-center gap-1.5"
                  >
                    {copiedIndex === idx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedIndex === idx ? 'Copied' : 'Copy Text'}</span>
                  </button>
                </div>

                <div className="p-4 bg-slate-950/80 rounded-xl border border-white/5 text-xs text-slate-200 font-sans whitespace-pre-wrap leading-relaxed">
                  {step.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-12 text-center text-slate-400 space-y-3">
          <Mail className="w-10 h-10 text-purple-400 mx-auto" />
          <h3 className="text-base font-bold text-white">Generate Outreach Sequence</h3>
          <p className="text-xs max-w-md mx-auto">
            Select candidate <span className="text-purple-300 font-bold">{selectedCandidate?.name}</span> and click "Generate Campaign" to produce personalized multi-step emails.
          </p>
        </div>
      )}
    </div>
  );
};
