import React from 'react';
import { Candidate, Job } from '../../types';
import { TrendingUp, Users, Target, Clock, Award, ShieldCheck, CheckCircle2, BarChart2 } from 'lucide-react';

interface AnalyticsModuleProps {
  candidates: Candidate[];
  jobs: Job[];
}

export const AnalyticsModule: React.FC<AnalyticsModuleProps> = ({ candidates, jobs }) => {
  const totalCandidateCount = candidates.length;
  const hiredCount = candidates.filter((c) => c.stage === 'Hired').length;
  const offerCount = candidates.filter((c) => c.stage === 'Offer Extended' || c.stage === 'Hired').length;

  const conversionRate = totalCandidateCount > 0 ? Math.round((offerCount / totalCandidateCount) * 100) : 0;

  // Source distribution
  const sourceCounts = candidates.reduce((acc, c) => {
    const src = c.source || 'Other';
    acc[src] = (acc[src] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl space-y-2">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
            <BarChart2 className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-white">Hiring Velocity & Recruitment Analytics</h2>
        </div>
        <p className="text-xs text-slate-400">
          Executive reports on pipeline conversion, sourcing channel ROI, and time-to-hire velocity.
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Talent Pool</span>
          <p className="text-3xl font-black text-white">{totalCandidateCount}</p>
          <p className="text-[11px] text-emerald-400 font-medium">100% indexed by AI OCR</p>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Offers & Hires</span>
          <p className="text-3xl font-black text-emerald-400">{offerCount}</p>
          <p className="text-[11px] text-slate-400 font-medium">{hiredCount} confirmed hires</p>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Funnel Conversion</span>
          <p className="text-3xl font-black text-indigo-300">{conversionRate}%</p>
          <p className="text-[11px] text-indigo-400 font-medium">Application to Offer</p>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg Time-To-Screen</span>
          <p className="text-3xl font-black text-purple-400">0.5 Days</p>
          <p className="text-[11px] text-purple-300 font-medium">⚡ Real-time AI Scoring</p>
        </div>
      </div>

      {/* Sourcing Channels ROI */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Target className="w-4 h-4 text-emerald-400" /> Sourcing Channel Effectiveness
        </h3>

        <div className="space-y-3">
          {Object.entries(sourceCounts).map(([src, count]) => {
            const numCount = Number(count);
            const pct = totalCandidateCount > 0 ? Math.round((numCount / totalCandidateCount) * 100) : 0;
            return (
              <div key={src} className="space-y-1 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span className="font-semibold text-white">{src}</span>
                  <span className="font-bold text-indigo-300">{count} candidates ({pct}%)</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
