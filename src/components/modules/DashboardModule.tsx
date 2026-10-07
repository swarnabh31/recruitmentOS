import React from 'react';
import { Job, Candidate } from '../../types';
import { Briefcase, Users, Award, TrendingUp, Sparkles, ArrowRight, Zap, Target, CheckCircle2 } from 'lucide-react';

interface DashboardModuleProps {
  jobs: Job[];
  candidates: Candidate[];
  onNavigateTab: (tab: string) => void;
  onSelectJob: (job: Job) => void;
}

export const DashboardModule: React.FC<DashboardModuleProps> = ({
  jobs,
  candidates,
  onNavigateTab,
  onSelectJob,
}) => {
  const openJobs = jobs.filter((j) => j.status === 'Open');
  const avgScore = candidates.length > 0
    ? Math.round(candidates.reduce((acc, c) => acc + (c.ai_score || 0), 0) / candidates.length)
    : 0;

  const stageCounts = candidates.reduce((acc, c) => {
    acc[c.stage] = (acc[c.stage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner with Frosted Glass Glow */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-950/80 via-slate-900/90 to-purple-950/80 p-6 sm:p-8 border border-white/10 backdrop-blur-2xl shadow-2xl">
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-400/30 text-indigo-300 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>AI Recruitment Operating System</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Talent Intelligence Command Center
            </h2>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl leading-relaxed">
              Managing <span className="text-emerald-400 font-bold">{openJobs.length} active roles</span> with{' '}
              <span className="text-indigo-300 font-bold">{candidates.length} AI-screened candidates</span> in your global pipeline.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigateTab('ai-search')}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 border border-white/20 transition-all flex items-center gap-2"
            >
              <Zap className="w-4 h-4 text-emerald-300" />
              <span>AI Candidate Search</span>
            </button>

            <button
              onClick={() => onNavigateTab('jobs')}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs border border-white/10 transition-all flex items-center gap-2"
            >
              <Briefcase className="w-4 h-4 text-indigo-300" />
              <span>Create New Role</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards - Frosted Glass Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl hover:border-indigo-500/40 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Jobs</span>
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 group-hover:scale-110 transition-transform">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-black text-white">{openJobs.length}</span>
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> 100% active
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">{jobs.length} total roles across 4 departments</p>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl hover:border-emerald-500/40 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Candidate Pool</span>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-black text-white">{candidates.length}</span>
            <span className="text-xs text-emerald-400 font-semibold">+12 this week</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Stored in persistent Candidate CRM</p>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl hover:border-purple-500/40 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg Resume Quality</span>
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 group-hover:scale-110 transition-transform">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-black text-white">{avgScore}%</span>
            <span className="text-xs text-indigo-300 font-semibold">AI Scored</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Automated skill & experience match</p>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl hover:border-amber-500/40 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Hiring Velocity</span>
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 group-hover:scale-110 transition-transform">
              <Target className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-black text-white">14 Days</span>
            <span className="text-xs text-emerald-400 font-semibold">-4 days vs avg</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Time-to-interview accelerated by AI</p>
        </div>
      </div>

      {/* Main Grid: Active Roles & Pipeline Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Jobs Card */}
        <div className="lg:col-span-2 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-400" /> Active Hiring Requisitions
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Click a role to launch AI candidate screening & match</p>
            </div>
            <button
              onClick={() => onNavigateTab('jobs')}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              <span>Manage All Jobs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {jobs.map((job) => {
              const jobCandidates = candidates.filter((c) => c.job_id === job.id);
              return (
                <div
                  key={job.id}
                  onClick={() => {
                    onSelectJob(job);
                    onNavigateTab('pipeline');
                  }}
                  className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-indigo-500/40 hover:bg-white/10 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white text-sm group-hover:text-indigo-300 transition-colors">
                        {job.title}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {job.status}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300">
                        {job.priority} Priority
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      {job.department} • {job.location} • Manager: {job.hiring_manager}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {job.required_skills.slice(0, 4).map((sk) => (
                        <span key={sk} className="text-[10px] bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded-md border border-slate-700">
                          {sk}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-white/10">
                    <div className="text-right">
                      <span className="text-lg font-black text-emerald-400">{jobCandidates.length}</span>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Candidates</p>
                    </div>
                    <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pipeline Stage Funnel & AI Highlights */}
        <div className="space-y-6">
          {/* Pipeline Distribution */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" /> Pipeline Stage Breakdown
            </h3>

            <div className="space-y-2.5 text-xs">
              {[
                { stage: 'Applied', color: 'bg-slate-500' },
                { stage: 'Screening', color: 'bg-blue-500' },
                { stage: 'Shortlisted', color: 'bg-indigo-500' },
                { stage: 'Technical Interview', color: 'bg-purple-500' },
                { stage: 'HR Round', color: 'bg-amber-500' },
                { stage: 'Offer Extended', color: 'bg-emerald-500' },
              ].map((item) => {
                const count = stageCounts[item.stage] || 0;
                const pct = candidates.length > 0 ? Math.round((count / candidates.length) * 100) : 0;
                return (
                  <div key={item.stage} className="space-y-1">
                    <div className="flex justify-between text-slate-300 font-medium">
                      <span>{item.stage}</span>
                      <span className="font-bold text-white">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div className={`h-full ${item.color} transition-all duration-500`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => onNavigateTab('pipeline')}
              className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-indigo-300 transition-all text-center block"
            >
              Open Interactive Kanban Pipeline →
            </button>
          </div>

          {/* AI Top Candidate Feature Card */}
          {candidates[0] && (
            <div className="bg-gradient-to-br from-indigo-950/80 to-slate-900/90 border border-indigo-500/30 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                  ✨ Top Ranked Candidate
                </span>
                <span className="text-xs font-bold text-emerald-400">{candidates[0].ai_score}% Match Score</span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-white">{candidates[0].name}</h4>
                <p className="text-xs text-slate-300">{candidates[0].current_title} at {candidates[0].current_company}</p>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{candidates[0].match_reason}</p>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-white/10">
                <span className="text-[11px] text-indigo-300 font-medium">Role: {candidates[0].job_title}</span>
                <button
                  onClick={() => onNavigateTab('candidates')}
                  className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1"
                >
                  View CRM <CheckCircle2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
