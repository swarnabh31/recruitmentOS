import React, { useState, useEffect } from 'react';
import {
  Users,
  Upload,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Download,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  FileText,
  AlertTriangle,
  Award,
  Zap,
  UserPlus,
} from 'lucide-react';
import { extractTextFromFile, evaluateResume, saveEvaluation, saveEvaluationAsCandidate } from '../../lib/api';
import { ResumeEvaluation, Candidate } from '../../types';

interface ResumeEvalTabProps {
  sessionId: string;
  jdText: string;
  jdFilename: string;
  selectedModel: string;
  /* OPTIONAL: requisition + save-to-pool integration (CRM sub-tab wiring) */
  jobId?: string;
  candidates?: Candidate[];
  onSavedToPool?: (cand: Candidate) => void;

  /* OPTIONAL: lift evaluation state up so results survive sub-tab switches (CRM) */
  evaluations?: ResumeEvaluation[];
  onEvaluationsChange?: (evals: ResumeEvaluation[]) => void;
}

export const ResumeEvalPanel: React.FC<ResumeEvalTabProps> = ({
  sessionId,
  jdText,
  jdFilename,
  selectedModel,
  jobId = '',
  candidates = [],
  onSavedToPool,
  evaluations: evaluationsProp,
  onEvaluationsChange,
}) => {
  /* Internal by default → self-contained for the legacy BatchScreeningTab */
  const [evaluations, setEvaluations] = useState<ResumeEvaluation[]>(evaluationsProp || []);
  /* Hoisted → CRM owns the state so it lives across tab switches */
  useEffect(() => {
    if (evaluationsProp) setEvaluations(evaluationsProp);
  }, [evaluationsProp]);
  const commitEvaluations = (next: ResumeEvaluation[]) => {
    setEvaluations(next);
    if (onEvaluationsChange) onEvaluationsChange(next);
  };

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [savedEvals, setSavedEvals] = useState<Set<number>>(new Set());
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleEvaluateBatch = async () => {
    if (!jdText || selectedFiles.length === 0) return;

    setIsEvaluating(true);
    setProgressIndex(0);
    const newEvaluations: ResumeEvaluation[] = [...evaluations];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      setProgressIndex(i + 1);
      setStatusMessage(`Processing candidate resume ${i + 1}/${selectedFiles.length}: ${file.name}`);

      // Extract text
      const extractRes = await extractTextFromFile(file);

      if (!extractRes.success) {
        const errorEval: ResumeEvaluation = {
          candidate_name: file.name,
          resume_filename: file.name,
          overall_score: 0,
          recommendation: 'Error',
          recommendation_reason: extractRes.error || 'Failed to extract text.',
          skills_match: { must_have_present: [], must_have_missing: [], good_to_have_present: [] },
          experience_analysis: { relevant_experience_years: 'N/A', company_type_match: 'N/A', project_complexity: 'N/A' },
          red_flags: [extractRes.error || 'Text extraction failed'],
          key_strengths: [],
          key_weaknesses: [],
          error: true,
        };
        newEvaluations.push(errorEval);
      } else {
        // Evaluate with AI
        const evalRes = await evaluateResume(jdText, extractRes.text, file.name, selectedModel);

        if (evalRes.success && evalRes.data) {
          const evalObj = evalRes.data;
          evalObj.session_id = sessionId;
          newEvaluations.push(evalObj);

          // Persist in backend DB
          await saveEvaluation({
            session_id: sessionId,
            candidate_name: evalObj.candidate_name,
            resume_filename: file.name,
            score: evalObj.overall_score,
            recommendation: evalObj.recommendation,
            raw_json: evalObj,
            raw_markdown: '',
          });
        } else {
          const failEval: ResumeEvaluation = {
            candidate_name: file.name,
            resume_filename: file.name,
            overall_score: 0,
            recommendation: 'Error',
            recommendation_reason: evalRes.error || 'Evaluation API error.',
            skills_match: { must_have_present: [], must_have_missing: [], good_to_have_present: [] },
            experience_analysis: { relevant_experience_years: 'N/A', company_type_match: 'N/A', project_complexity: 'N/A' },
            red_flags: ['AI Evaluation Failed'],
            key_strengths: [],
            key_weaknesses: [],
            error: true,
          };
          newEvaluations.push(failEval);
        }
      }
    }

    setIsEvaluating(false);
    setSelectedFiles([]);
    setStatusMessage('');
    commitEvaluations(newEvaluations);
  };

  /* Human-in-the-loop: save ONE scorecard into the candidate pool */
  const handleSaveToPool = async (idx: number) => {
    if (!onSavedToPool) return;
    const ev = sortedEvaluations[idx];
    setSavingIdx(idx);
    setSaveErr(null);
    const result = await saveEvaluationAsCandidate(ev, jobId);
    setSavingIdx(null);
    if (result && result.ok) {
      setSavedEvals((prev) => new Set(prev).add(idx));
      onSavedToPool(result.candidate);
    } else {
      setSaveErr(result?.error || 'Failed to save this scorecard to the candidate pool.');
    }
  };

  // Sort candidates by score descending
  const sortedEvaluations = [...evaluations].sort(
    (a, b) => (b.overall_score || 0) - (a.overall_score || 0)
  );

  // CSV Export Generator
  const downloadCsv = () => {
    if (evaluations.length === 0) return;
    const headers = ['Candidate Name', 'Resume File', 'Score', 'Recommendation', 'Reason', 'Strengths', 'Weaknesses', 'Red Flags'];
    const rows = sortedEvaluations.map((e) => [
      `"${(e.candidate_name || '').replace(/"/g, '""')}"`,
      `"${(e.resume_filename || '').replace(/"/g, '""')}"`,
      e.overall_score || 0,
      `"${(e.recommendation || '').replace(/"/g, '""')}"`,
      `"${(e.recommendation_reason || '').replace(/"/g, '""')}"`,
      `"${(e.key_strengths || []).join('; ').replace(/"/g, '""')}"`,
      `"${(e.key_weaknesses || []).join('; ').replace(/"/g, '""')}"`,
      `"${(e.red_flags || []).join('; ').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resume_evaluations_${sessionId.slice(0, 6)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'bg-emerald-500 text-emerald-100';
    if (score >= 55) return 'bg-amber-500 text-amber-100';
    return 'bg-red-500 text-red-100';
  };

  const getBadgeColor = (rec: string) => {
    const clean = (rec || '').toLowerCase();
    if (clean === 'yes') return 'bg-emerald-950 text-emerald-300 border-emerald-800';
    if (clean === 'maybe') return 'bg-amber-950 text-amber-300 border-amber-800';
    if (clean === 'no') return 'bg-red-950 text-red-300 border-red-800';
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  return (
    <div className="space-y-6">
      {!jdText ? (
        <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl p-8 text-center space-y-3">
          <Users className="w-10 h-10 text-amber-500 mx-auto" />
          <h3 className="text-base font-bold text-amber-200">
            No Active Job Description
          </h3>
          <p className="text-xs text-amber-400 max-w-md mx-auto">
            Please upload or generate a Job Description in Tab 1 before evaluating candidate resumes.
          </p>
        </div>
      ) : (
        <>
          {/* Upload & Batch Evaluation Trigger */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                Batch Resume Screening & Evaluation
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Upload candidate resumes (PDF, DOCX, TXT) to evaluate against: <strong className="text-slate-300">{jdFilename || 'Active Job Description'}</strong>
              </p>
            </div>

            {/* File Dropzone */}
            <div className="border-2 border-slate-700 hover:border-indigo-500 rounded-xl p-6 text-center cursor-pointer bg-slate-950/50 transition-all relative">
              <input
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.txt"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-300">
                {selectedFiles.length > 0
                  ? `${selectedFiles.length} file(s) selected`
                  : 'Drag & Drop or Click to Select Resumes'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Supports PDF, DOCX, and TXT files (batch evaluation)
              </p>
            </div>

            {/* Selected File List */}
            {selectedFiles.length > 0 && (
              <div className="bg-slate-800/60 rounded-lg p-3 max-h-32 overflow-y-auto space-y-1 text-xs">
                {selectedFiles.map((f, idx) => (
                  <div key={idx} className="flex items-center justify-between text-slate-300 font-mono">
                    <span className="truncate max-w-sm">{f.name}</span>
                    <span className="text-[10px] text-slate-500">{(f.size / 1024).toFixed(1)} KB</span>
                  </div>
                ))}
              </div>
            )}

            {/* Progress & Evaluate Action */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500 font-medium">
                {isEvaluating ? statusMessage : `${evaluations.length} total candidates evaluated in session`}
              </span>

              <button
                onClick={handleEvaluateBatch}
                disabled={isEvaluating || selectedFiles.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-semibold px-6 py-2.5 rounded-lg shadow-sm flex items-center space-x-2 transition-all"
              >
                {isEvaluating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Evaluating ({progressIndex}/{selectedFiles.length})...</span>
                  </>
                ) : (
                  <>
                    <Award className="w-4 h-4" />
                    <span>Evaluate {selectedFiles.length > 0 ? selectedFiles.length : ''} Resume(s)</span>
                  </>
                )}
              </button>
            </div>

            {/* Progress Bar */}
            {isEvaluating && (
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-600 h-2 transition-all duration-300"
                  style={{ width: `${(progressIndex / selectedFiles.length) * 100}%` }}
                />
              </div>
            )}
          </div>

          {/* Results Summary Header */}
          {evaluations.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 p-4 border border-slate-800 rounded-xl shadow-sm">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-500" />
                Ranked Candidates ({evaluations.length})
              </h3>

              <div className="flex items-center space-x-2">
                <button
                  onClick={downloadCsv}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm flex items-center space-x-1.5 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download CSV</span>
                </button>

                <button
                  onClick={() => { commitEvaluations([]); setSavedEvals(new Set()); setSaveErr(null); }}
                  className="bg-slate-800 text-slate-400 text-xs font-medium px-3 py-2 rounded-lg border border-slate-700 flex items-center space-x-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </div>
            </div>
          )}

          {saveErr && (
            <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-red-200 text-xs">
              <AlertTriangle className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />{saveErr}
            </div>
          )}

          {/* Ranked Candidates Cards */}
          <div className="space-y-4">
            {sortedEvaluations.map((candidate, idx) => {
              const isExpanded = expandedIndex === idx;
              const score = candidate.overall_score || 0;

              return (
                <div
                  key={idx}
                  className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden transition-all"
                >
                  {/* Candidate Header Row */}
                  <div
                    onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                    className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 font-bold text-xs flex items-center justify-center text-slate-300 border border-slate-700">
                        #{idx + 1}
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-slate-100">
                          {candidate.candidate_name || 'Candidate'}
                        </h4>
                        <p className="text-xs text-slate-500 font-mono">
                          {candidate.resume_filename}
                        </p>
                      </div>
                    </div>

                    {/* Right side: Score & Badge */}
                    <div className="flex items-center space-x-4 self-end sm:self-center" onClick={(e) => e.stopPropagation()}>
                      {onSavedToPool && (
                        savedEvals.has(idx) ? (
                          <button
                            disabled
                            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-700 flex items-center gap-1.5 cursor-default"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Saved to pool
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSaveToPool(idx)}
                            disabled={isEvaluating || savingIdx === idx || candidate.error}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/40 text-white flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {savingIdx === idx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                            Save to pool
                          </button>
                        )
                      )}

                      <div className="text-right">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-slate-500 font-semibold uppercase">Score:</span>
                          <span className="text-base font-extrabold text-slate-100">
                            {score}/100
                          </span>
                        </div>
                        <div className="w-28 bg-slate-800 h-2 rounded-full overflow-hidden mt-1">
                          <div
                            className={`h-full ${getScoreColor(score)}`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                      </div>

                      <span
                        className={`text-xs font-bold px-3 py-1 rounded-full border ${getBadgeColor(
                          candidate.recommendation
                        )}`}
                      >
                        {candidate.recommendation}
                      </span>

                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Evaluation Breakdown */}
                  {isExpanded && (
                    <div className="p-6 border-slate-800 bg-slate-950/40 space-y-6">
                      {/* Recommendation Reason */}
                      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                          Recommendation Reason
                        </h5>
                        <p className="text-xs text-slate-200 leading-relaxed">
                          {candidate.recommendation_reason}
                        </p>
                      </div>

                      {/* Skills Breakdown */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2">
                          <h6 className="text-[11px] font-bold uppercase text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Must-Have Present
                          </h6>
                          <div className="flex flex-wrap gap-1">
                            {candidate.skills_match?.must_have_present?.map((s, i) => (
                              <span key={i} className="bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded">
                                {s}
                              </span>
                            )) || <span className="text-xs text-slate-400">None</span>}
                          </div>
                        </div>

                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2">
                          <h6 className="text-[11px] font-bold uppercase text-red-600 flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> Must-Have Missing
                          </h6>
                          <div className="flex flex-wrap gap-1">
                            {candidate.skills_match?.must_have_missing?.map((s, i) => (
                              <span key={i} className="bg-red-950 text-red-300 px-2 py-0.5 rounded">
                                {s}
                              </span>
                            )) || <span className="text-xs text-slate-400">None</span>}
                          </div>
                        </div>

                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2">
                          <h6 className="text-[11px] font-bold uppercase text-sky-600 flex items-center gap-1">
                            <Zap className="w-3.5 h-3.5" /> Good-To-Have
                          </h6>
                          <div className="flex flex-wrap gap-1">
                            {candidate.skills_match?.good_to_have_present?.map((s, i) => (
                              <span key={i} className="bg-sky-950 text-sky-300 px-2 py-0.5 rounded">
                                {s}
                              </span>
                            )) || <span className="text-xs text-slate-400">None</span>}
                          </div>
                        </div>
                      </div>

                      {/* Experience Analysis */}
                      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2">
                        <h5 className="text-xs font-bold uppercase text-slate-500">
                          Experience Analysis
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div>
                            <span className="text-slate-400 block">Relevant Experience:</span>
                            <span className="font-semibold text-slate-200">
                              {candidate.experience_analysis?.relevant_experience_years || 'N/A'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Company Type Match:</span>
                            <span className="font-semibold text-slate-200">
                              {candidate.experience_analysis?.company_type_match || 'N/A'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Project Complexity:</span>
                            <span className="font-semibold text-slate-200">
                              {candidate.experience_analysis?.project_complexity || 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Strengths, Weaknesses & Red Flags */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2">
                          <h5 className="text-xs font-bold uppercase text-emerald-600">
                            Key Strengths
                          </h5>
                          <ul className="list-disc list-inside space-y-1 text-xs text-slate-300">
                            {candidate.key_strengths?.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2">
                          <h5 className="text-xs font-bold uppercase text-amber-600">
                            Key Weaknesses
                          </h5>
                          <ul className="list-disc list-inside space-y-1 text-xs text-slate-300">
                            {candidate.key_weaknesses?.map((w, i) => (
                              <li key={i}>{w}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2">
                          <h5 className="text-xs font-bold uppercase text-red-600 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> Red Flags
                          </h5>
                          <ul className="list-disc list-inside space-y-1 text-xs text-slate-300">
                            {candidate.red_flags?.map((f, i) => (
                              <li key={i}>{f}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
