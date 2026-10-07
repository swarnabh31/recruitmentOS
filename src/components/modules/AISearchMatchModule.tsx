import React, { useState } from 'react';
import { Candidate, Job } from '../../types';
import { useModel } from '../../lib/ModelContext';
import { aiCandidateSearch, aiMatchCandidates } from '../../lib/api';
import { Search, Sparkles, Loader2, Award, CheckCircle2, AlertTriangle, ArrowRight, Bot, Zap } from 'lucide-react';

interface AISearchMatchModuleProps {
  candidates: Candidate[];
  jobs: Job[];
  onSelectCandidate: (c: Candidate) => void;
}

export const AISearchMatchModule: React.FC<AISearchMatchModuleProps> = ({
  candidates,
  jobs,
  onSelectCandidate,
}) => {
  const { selectedModel } = useModel();
  const [activeTab, setActiveTab] = useState<'nl-search' | 'job-match'>('nl-search');

  // Natural Language Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Job Match State
  const [selectedJobId, setSelectedJobId] = useState<string>(jobs[0]?.id || 'job_1');
  const [isMatching, setIsMatching] = useState(false);
  const [matchRankings, setMatchRankings] = useState<any | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);

  const handleExecuteNlSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    try {
      const apiCall = aiCandidateSearch(searchQuery, selectedModel);
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timed out waiting for the AI engine. It may be busy or offline — try again, or pick a smaller model.')), 180000)
      );
      const res = await Promise.race([apiCall, timeout]);
      if (res.success && res.data) {
        setSearchResults(res.data);
      } else {
        setSearchError(res.error || 'The AI engine returned no results. Try again or pick a different model in the header.');
      }
    } catch (err: any) {
      setSearchError(err?.message || 'Failed to reach the AI engine. Is the server running?');
    } finally {
      setIsSearching(false);
    }
  };

  const handleRunAiMatch = async () => {
    setIsMatching(true);
    setMatchError(null);
    try {
      const apiCall = aiMatchCandidates(selectedJobId, selectedModel);
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timed out waiting for the AI engine. It may be busy or offline — try again, or pick a smaller model.')), 180000)
      );
      const res = await Promise.race([apiCall, timeout]);
      if (res.success && res.data) {
        setMatchRankings(res.data);
      } else {
        setMatchError(res.error || 'The AI engine returned no ranking. Try again or pick a different model in the header.');
      }
    } catch (err: any) {
      setMatchError(err?.message || 'Failed to reach the AI engine. Is the server running?');
    } finally {
      setIsMatching(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Selector Banner */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                <Sparkles className="w-5 h-5 text-indigo-400" />
              </div>
              <h2 className="text-xl font-bold text-white">AI Candidate Search & Semantic Match Engine</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Ask in plain English or rank entire candidate pool against job descriptions using AI.
            </p>
          </div>

          {/* Sub-nav toggle */}
          <div className="flex p-1 bg-slate-950 border border-white/10 rounded-xl">
            <button
              onClick={() => setActiveTab('nl-search')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'nl-search'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>English Search</span>
            </button>

            <button
              onClick={() => setActiveTab('job-match')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'job-match'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>Job Copilot Ranker</span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: NATURAL LANGUAGE SEARCH */}
      {activeTab === 'nl-search' && (
        <div className="space-y-6">
          <form onSubmit={handleExecuteNlSearch} className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
            <label className="text-xs font-bold text-indigo-300 block">
              Describe Candidate Requirements in Plain English:
            </label>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. Find Python developers with 5+ years experience and AWS or Kubernetes in Hyderabad who can join in 15 days"
                className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-indigo-500 shadow-inner"
              />

              <button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 border border-white/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span>Execute Search</span>
              </button>
            </div>

            {/* Quick Prompt Pill Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-[10px] text-slate-500 font-semibold uppercase">Try:</span>
              {[
                'Python developers 5+ yrs with AWS & Kubernetes in Hyderabad',
                'Staff AI engineers with PyTorch & RAG in San Francisco',
                'Immediate joiners with FinTech or Banking experience',
                'Full Stack React + TypeScript product engineers in Bangalore',
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setSearchQuery(chip)}
                  className="text-[10px] bg-white/5 hover:bg-white/10 text-slate-300 px-2.5 py-1 rounded-lg border border-white/10 transition-all"
                >
                  "{chip}"
                </button>
              ))}
            </div>
          </form>

          {/* Search Error Display */}
          {searchError && (
            <div className="bg-rose-950/40 backdrop-blur-xl border border-rose-500/40 rounded-2xl p-5 shadow-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-rose-300">AI Search failed</h3>
                <p className="text-xs text-rose-200/90 leading-relaxed">{searchError}</p>
              </div>
            </div>
          )}

          {/* Search Results Display */}
          {searchResults && (
            <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-xs space-y-1">
                <span className="font-bold text-indigo-300 uppercase text-[10px] tracking-wider flex items-center gap-1">
                  <Bot className="w-3.5 h-3.5 text-indigo-400" /> Copilot Search Analysis
                </span>
                <p className="text-slate-200">{searchResults.search_summary}</p>
              </div>

              <div className="space-y-3">
                {searchResults.results?.map((res: any) => {
                  const candidateObj = candidates.find((c) => c.id === res.candidate_id);
                  if (!candidateObj) return null;
                  return (
                    <div
                      key={res.candidate_id}
                      onClick={() => onSelectCandidate(candidateObj)}
                      className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 hover:border-indigo-500/50 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-bold text-white text-sm group-hover:text-indigo-300 transition-colors">
                            {candidateObj.name}
                          </h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                            Relevance: {res.relevance_score}%
                          </span>
                        </div>
                        <p className="text-xs text-slate-300">
                          {candidateObj.current_title} at {candidateObj.current_company} • {candidateObj.location}
                        </p>
                        <p className="text-xs text-indigo-200 bg-indigo-950/30 p-2 rounded-lg border border-indigo-500/20 mt-1">
                          "{res.reasoning}"
                        </p>
                      </div>

                      <button className="px-4 py-2 rounded-xl bg-indigo-600/20 group-hover:bg-indigo-600 text-indigo-200 group-hover:text-white font-bold text-xs transition-all flex items-center gap-1 self-start sm:self-center">
                        <span>View Profile</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AI JOB COPILOT MATCHING */}
      {activeTab === 'job-match' && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 w-full sm:w-auto">
              <label className="text-xs font-bold text-slate-300 block">Select Job Requisition to Rank Talent Pool:</label>
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 w-full sm:w-80"
              >
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.title} ({j.department})</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleRunAiMatch}
              disabled={isMatching}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 border border-white/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isMatching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-emerald-300" />}
              <span>Rank Talent Pool with AI</span>
            </button>
          </div>

          {matchError && (
            <div className="bg-rose-950/40 backdrop-blur-xl border border-rose-500/40 rounded-2xl p-5 shadow-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-rose-300">AI Match failed</h3>
                <p className="text-xs text-rose-200/90 leading-relaxed">{matchError}</p>
              </div>
            </div>
          )}

          {matchRankings && (
            <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-400" /> AI Candidate Rankings for Selected Role
              </h3>

              <div className="space-y-3">
                {matchRankings.rankings?.map((rk: any, index: number) => {
                  const candidateObj = candidates.find((c) => c.id === rk.candidate_id);
                  return (
                    <div
                      key={rk.candidate_id}
                      onClick={() => candidateObj && onSelectCandidate(candidateObj)}
                      className="p-5 rounded-2xl bg-slate-950/80 border border-white/10 hover:border-emerald-500/50 transition-all cursor-pointer space-y-2 group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <span className="w-7 h-7 rounded-xl bg-indigo-600/30 text-indigo-300 flex items-center justify-center font-black text-xs border border-indigo-500/30">
                            #{index + 1}
                          </span>
                          <div>
                            <h4 className="font-bold text-white text-sm group-hover:text-emerald-300 transition-colors">
                              {rk.candidate_name}
                            </h4>
                            <span className="text-[10px] text-indigo-300 font-semibold">{rk.recommendation}</span>
                          </div>
                        </div>

                        <span className="px-3 py-1 rounded-xl text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {rk.match_score}% Score
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 bg-white/5 p-3 rounded-xl border border-white/5">
                        <strong className="text-indigo-300">Copilot Reason:</strong> {rk.copilot_explanation}
                      </p>

                      <div className="flex flex-wrap gap-2 text-[10px] pt-1">
                        <span className="text-emerald-400 font-medium">✓ Satisfies: {rk.must_have_satisfied?.join(', ')}</span>
                        {rk.missing_skills?.length > 0 && (
                          <span className="text-amber-400 font-medium">⚠ Gaps: {rk.missing_skills?.join(', ')}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
