import React, { useState } from 'react';
import { Candidate, Job, PipelineStage } from '../../types';
import { updateCandidateStage } from '../../lib/api';
import { Layers, Sparkles, MoveRight, ArrowRight, CheckCircle2, User, Award, Filter } from 'lucide-react';

interface KanbanPipelineModuleProps {
  candidates: Candidate[];
  jobs: Job[];
  activeJobId: string;
  onSelectJobId: (id: string) => void;
  onCandidatesUpdated: () => void;
  onSelectCandidate: (c: Candidate) => void;
}

const STAGES: PipelineStage[] = [
  'Applied',
  'Screening',
  'Shortlisted',
  'Technical Interview',
  'HR Round',
  'Offer Extended',
  'Hired',
  'Rejected',
];

export const KanbanPipelineModule: React.FC<KanbanPipelineModuleProps> = ({
  candidates,
  jobs,
  activeJobId,
  onSelectJobId,
  onCandidatesUpdated,
  onSelectCandidate,
}) => {
  const [movingCandidateId, setMovingCandidateId] = useState<string | null>(null);

  const filteredCandidates = candidates.filter((c) => activeJobId === 'all' || c.job_id === activeJobId);

  const handleMoveStage = async (candidate: Candidate, newStage: PipelineStage) => {
    setMovingCandidateId(candidate.id);
    await updateCandidateStage(candidate.id, newStage, `Moved from ${candidate.stage} to ${newStage}`);
    setMovingCandidateId(null);
    onCandidatesUpdated();
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Kanban Header & Job Context Selector */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-purple-500/20 text-purple-400 rounded-xl border border-purple-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-white">Visual Recruitment Kanban Pipeline</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Track candidate progression across hiring stages with one-click migration.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={activeJobId}
            onChange={(e) => onSelectJobId(e.target.value)}
            className="bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-xs text-indigo-300 font-bold focus:outline-none focus:border-indigo-500 shadow-inner"
          >
            <option value="all">⚡ All Job Requisitions ({candidates.length} candidates)</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title} ({candidates.filter((c) => c.job_id === j.id).length})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Kanban Columns Horizontally Scrollable Container */}
      <div className="overflow-x-auto pb-6">
        <div className="flex gap-4 min-w-[1400px]">
          {STAGES.map((stage) => {
            const stageCandidates = filteredCandidates.filter((c) => c.stage === stage);
            return (
              <div
                key={stage}
                className="w-72 bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-3.5 flex flex-col space-y-3 min-h-[600px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between px-2 pb-2 border-b border-white/10">
                  <span className="text-xs font-extrabold text-slate-200 tracking-tight">{stage}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {stageCandidates.length}
                  </span>
                </div>

                {/* Candidate Cards in Column */}
                <div className="flex-1 space-y-3">
                  {stageCandidates.map((c) => (
                    <div
                      key={c.id}
                      className="p-4 rounded-xl bg-slate-950/80 border border-white/10 hover:border-indigo-500/50 shadow-lg space-y-3 transition-all group relative"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4
                            onClick={() => onSelectCandidate(c)}
                            className="font-bold text-white text-xs hover:text-indigo-300 transition-colors cursor-pointer"
                          >
                            {c.name}
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-0.5 truncate">{c.current_title}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                          {c.ai_score}%
                        </span>
                      </div>

                      <div className="text-[10px] text-slate-400 space-y-1">
                        <p className="truncate">💼 {c.job_title}</p>
                        <p className="truncate">📍 {c.location}</p>
                      </div>

                      {/* Quick stage selector */}
                      <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
                        <span className="text-slate-500 font-medium">Move stage:</span>
                        <select
                          value={c.stage}
                          disabled={movingCandidateId === c.id}
                          onChange={(e) => handleMoveStage(c, e.target.value as PipelineStage)}
                          className="bg-slate-900 border border-white/10 rounded px-2 py-0.5 text-indigo-300 font-bold focus:outline-none"
                        >
                          {STAGES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}

                  {stageCandidates.length === 0 && (
                    <div className="py-12 text-center text-slate-600 text-[11px] italic">
                      No candidates in {stage}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
