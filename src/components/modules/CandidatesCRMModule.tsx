import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Candidate, Job, PipelineStage, ResumeEvaluation } from '../../types';
import { useModel } from '../../lib/ModelContext';
import {
  createCandidate,
  patchCandidate,
  addCandidateActivity,
  updateCandidateStage,
  ResumeDraft,
} from '../../lib/api';
import { ResumeEvalPanel } from './ResumeEvalPanel';
import { AddCandidateModal } from '../AddCandidateModal';
import {
  Users, Upload, Phone, Mail, MapPin, Calendar, Sparkles, Plus, Loader2,
  MessageSquare, X, Pencil, Check, Save, ListChecks, Cpu,
} from 'lucide-react';

const STAGES: PipelineStage[] = [
  'Applied', 'Screening', 'Shortlisted', 'Technical Interview',
  'HR Round', 'Offer Extended', 'Hired', 'Rejected',
];

const STAGE_COLORS: Record<string, string> = {
  Applied: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  Screening: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  Shortlisted: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  'Technical Interview': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'HR Round': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'Offer Extended': 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30',
  Hired: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  Rejected: 'bg-red-500/20 text-red-300 border-red-500/30',
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+#. ]/g, '');
}

function jobScoreFor(draft: ResumeDraft, job: Job): number {
  const cand = new Set((draft.skills || []).map(normalize).filter(Boolean));
  const req = new Set((job.required_skills || []).map(normalize).filter(Boolean));
  if (req.size === 0 || cand.size === 0) return 0;
  let hit = 0;
  req.forEach((r) => { if (cand.has(r)) hit++; });
  let sc = Math.round((hit / req.size) * 100);
  if (draft.experience_years >= job.min_experience) sc += 20;
  return Math.min(100, sc);
}

function scoreJobs(draft: ResumeDraft, jobs: Job[]): { job: Job; score: number }[] {
  return jobs
    .map((j) => ({ job: j, score: jobScoreFor(draft, j) }))
    .sort((a, b) => b.score - a.score);
}

const inputCls =
  'bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 w-full placeholder:text-slate-500';
const labelCls = 'text-[10px] font-bold uppercase tracking-wider text-slate-400';

/* Skill chip editor — add with Enter / comma, remove with × */
const SkillEditor: React.FC<{
  skills: string[];
  onChange: (s: string[]) => void;
}> = ({ skills, onChange }) => {
  const [text, setText] = useState('');
  const add = () => {
    const parts = text.split(',').map((t) => t.trim()).filter(Boolean);
    if (parts.length) onChange([...new Set([...skills, ...parts])]);
    setText('');
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {skills.map((s) => (
          <span key={s} className="text-xs bg-indigo-500/10 text-indigo-200 px-2.5 py-1 rounded-lg border border-indigo-500/20 flex items-center gap-1">
            {s}
            <button type="button" onClick={() => onChange(skills.filter((x) => x !== s))} className="hover:text-red-300">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {skills.length === 0 && <span className="text-xs text-slate-500 italic">No skills yet — type to add</span>}
      </div>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
          }}
          placeholder="Add skill (Enter or comma)"
          className={inputCls}
        />
        <button type="button" onClick={add} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/10 flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Inline edit form for an existing candidate                          */
/* ------------------------------------------------------------------ */
const EditCandidateForm: React.FC<{
  candidate: Candidate;
  jobs: Job[];
  onCancel: () => void;
  onSaved: (c: Candidate) => void;
}> = ({ candidate, jobs, onCancel, onSaved }) => {
  const [form, setForm] = useState({
    name: candidate.name,
    email: candidate.email,
    phone: candidate.phone,
    current_title: candidate.current_title,
    current_company: candidate.current_company,
    experience_years: String(candidate.experience_years),
    location: candidate.location,
    expected_salary: candidate.expected_salary,
    notice_period: candidate.notice_period,
    linkedin_url: candidate.linkedin_url || '',
    github_url: candidate.github_url || '',
    skills: candidate.skills || [],
    job_id: candidate.job_id || '',
    stage: candidate.stage,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    setError(null);
    const job = jobs.find((j) => j.id === form.job_id) || null;
    const updated = await patchCandidate(candidate.id, {
      ...form,
      experience_years: Number(form.experience_years) || 0,
      job_id: job?.id || '',
      job_title: job?.title || candidate.job_title,
      stage: form.stage as PipelineStage,
    });
    setSaving(false);
    if (updated && updated.id) onSaved(updated);
    else setError('Save failed — try again.');
  };

  return (
    <div className="p-5 bg-white/5 border border-white/10 rounded-2xl space-y-4 animate-fadeIn">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          <Pencil className="w-3.5 h-3.5 text-indigo-400" /> Edit Candidate Profile
        </h4>
        <span className="text-[10px] text-slate-500">Every field editable — changes logged to activity</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className={labelCls}>Full Name</label>
          <input value={form.name} onChange={set('name')} className={inputCls} /></div>
        <div><label className={labelCls}>Email</label>
          <input value={form.email} onChange={set('email')} className={inputCls} /></div>
        <div><label className={labelCls}>Phone</label>
          <input value={form.phone} onChange={set('phone')} className={inputCls} /></div>
        <div><label className={labelCls}>Location</label>
          <input value={form.location} onChange={set('location')} className={inputCls} /></div>
        <div><label className={labelCls}>Current Title</label>
          <input value={form.current_title} onChange={set('current_title')} className={inputCls} /></div>
        <div><label className={labelCls}>Current Company</label>
          <input value={form.current_company} onChange={set('current_company')} className={inputCls} /></div>
        <div><label className={labelCls}>Experience (years)</label>
          <input type="number" min="0" value={form.experience_years} onChange={set('experience_years')} className={inputCls} /></div>
        <div><label className={labelCls}>Expected Salary</label>
          <input value={form.expected_salary} onChange={set('expected_salary')} className={inputCls} /></div>
        <div><label className={labelCls}>Notice Period</label>
          <input value={form.notice_period} onChange={set('notice_period')} className={inputCls} /></div>
        <div><label className={labelCls}>LinkedIn URL</label>
          <input value={form.linkedin_url} onChange={set('linkedin_url')} className={inputCls} /></div>
        <div><label className={labelCls}>GitHub URL</label>
          <input value={form.github_url} onChange={set('github_url')} className={inputCls} /></div>
        <div><label className={labelCls}>Requisition</label>
          <select value={form.job_id} onChange={(e) => setForm((f) => ({ ...f, job_id: e.target.value }))} className={inputCls}>
            <option value="">— No requisition (talent pool) —</option>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select></div>
        <div><label className={labelCls}>Interview Stage</label>
          <select value={form.stage} onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value as PipelineStage }))} className={inputCls}>
            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select></div>
      </div>

      <div className="space-y-2">
        <label className={labelCls}>Skills (add / remove)</label>
        <SkillEditor skills={form.skills} onChange={(s) => setForm((f) => ({ ...f, skills: s }))} />
      </div>

      {error && <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-red-200 text-xs">{error}</div>}

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} disabled={saving} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-xs border border-white/15 disabled:opacity-50 flex items-center gap-1.5">
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
        <button onClick={save} disabled={saving} className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs disabled:opacity-50 flex items-center gap-1.5">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-4 h-4" />} Save Changes
        </button>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Main CRM module                                                     */
/* ------------------------------------------------------------------ */
interface CandidatesCRMModuleProps {
  candidates: Candidate[];
  jobs: Job[];
  onCandidatesUpdated: () => void;
  onSelectCandidateForInterview?: (c: Candidate) => void;
  onSelectCandidateForOutreach?: (c: Candidate) => void;
}

export const CandidatesCRMModule: React.FC<CandidatesCRMModuleProps> = ({
  candidates,
  jobs,
  onCandidatesUpdated,
  onSelectCandidateForInterview,
  onSelectCandidateForOutreach,
}) => {
  const { selectedModel, models, refreshModels } = useModel();
  const [selectedCandidate, setSelectedCandidateRaw] = useState<Candidate | null>(candidates[0] || null);
  const [filterJobId, setFilterJobId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');


  /* Edit mode for selected candidate */
  const [isEditing, setIsEditing] = useState(false);

  /* CRM Note Input */
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState<'call' | 'email' | 'note' | 'interview'>('call');
  const [isAddingNote, setIsAddingNote] = useState(false);

  const setSelectedCandidate = (c: Candidate | null) => {
    setSelectedCandidateRaw(c);
    setIsEditing(false);
  };

  /* ============ Sub-tabs: [ Candidates | Batch Screening ] ============ */
  const [subTab, setSubTab] = useState<'candidates' | 'batch'>('candidates');
  const [showAddModal, setShowAddModal] = useState(false);

  /* Batch Screening state (lifted here so results survive sub-tab switches) */
  const sessionIdRef = useRef<string>(`batch_crm_${Date.now()}`);
  const [screenJobId, setScreenJobId] = useState<string>('');
  const [evaluations, setEvaluations] = useState<ResumeEvaluation[]>([]);
  const screenJob = jobs.find((j) => j.id === screenJobId);
  const screenJdText = screenJob?.jd_text || '';
  const screenJdFilename = screenJob?.jd_filename || screenJob ? `${screenJob.title || 'job'}.md` : '';

  /* Pre-select the currently-filtered requisition as the default screening target */
  const seededScreenJobRef = useRef(false);
  useEffect(() => {
    if (seededScreenJobRef.current || jobs.length === 0) return;
    seededScreenJobRef.current = true;
    const pre = filterJobId !== 'all' ? filterJobId : undefined;
    if (pre) {
      setScreenJobId(pre);
    } else {
      const newest = [...jobs].sort((a, b) => {
        const at = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bt - at;
      })[0];
      if (newest?.jd_text && newest.jd_text.length > 50) setScreenJobId(newest.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs]);

  const handleSavedToPool = useCallback((c: Candidate) => {
    onCandidatesUpdated();
    setSubTab('candidates');
    setSelectedCandidateRaw(c);
  }, [onCandidatesUpdated]);

  const filteredCandidates = candidates.filter((c) => {
    const matchesJob = filterJobId === 'all' || c.job_id === filterJobId;
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.current_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.skills.some((s) => s.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesJob && matchesSearch;
  });
;
;

  const handleEditSaved = (c: Candidate) => {
    setIsEditing(false);
    onCandidatesUpdated();
    setSelectedCandidateRaw(c);
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCandidate || !noteContent.trim()) return;

    setIsAddingNote(true);
    const updated = await addCandidateActivity(selectedCandidate.id, {
      type: noteType,
      title: noteTitle || `${noteType.toUpperCase()} Logged`,
      content: noteContent,
      author: 'Recruiter Lead',
    });
    setIsAddingNote(false);

    if (updated) {
      setSelectedCandidateRaw(updated);
      onCandidatesUpdated();
      setNoteTitle('');
      setNoteContent('');
    }
  };

  const handleStageChange = async (newStage: PipelineStage) => {
    if (!selectedCandidate) return;
    const updated = await updateCandidateStage(selectedCandidate.id, newStage, `Stage updated to ${newStage}`);
    if (updated) {
      setSelectedCandidateRaw(updated);
      onCandidatesUpdated();
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Filter & Resume Intelligence Upload Bar */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Users className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-white">Candidate Database & CRM</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Permanent talent pool with AI resume extraction, human-review workflow, and interaction timeline.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterJobId}
            onChange={(e) => setFilterJobId(e.target.value)}
            className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Role Requisitions</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.title}</option>
            ))}
          </select>

          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search candidate name, title, skills..."
            className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 w-48 sm:w-64"
          />

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/20 border border-indigo-400/30 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Candidate</span>
          </button>

        </div>
      </div>


      {/* Sub-tab strip: [ Candidates | Batch Screening ] */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSubTab('candidates')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'candidates'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 border border-indigo-400/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Candidates <span className="text-[10px] opacity-70">({candidates.length})</span>
          </button>
          <button
            onClick={() => setSubTab('batch')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'batch'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 border border-indigo-400/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <ListChecks className="w-3.5 h-3.5" />
            Batch Screening <span className="text-[10px] opacity-70">({evaluations.length})</span>
          </button>
        </div>
        {subTab === 'batch' && (
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            <span>{selectedModel || 'no model — check Ollama'}</span>
            {models.length > 0 && (
              <button onClick={() => refreshModels()} className="text-slate-500 hover:text-amber-300">refresh</button>
            )}
          </div>
        )}
      </div>

      {subTab === 'candidates' ? (
      /* Main Split View — Candidates sub-tab */
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Candidates List */}
        <div className="lg:col-span-5 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-xl space-y-3 max-h-[750px] overflow-y-auto">
          <div className="flex items-center justify-between px-2 pb-2 border-b border-white/10">
            <span className="text-xs font-bold text-slate-300">
              Showing {filteredCandidates.length} Candidates
            </span>
            <span className="text-[10px] text-slate-400">Click candidate to view CRM history</span>
          </div>

          {filteredCandidates.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Upload className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-500">No candidates in this view yet. Upload a resume to start the intake flow.</p>
            </div>
          ) : (
            filteredCandidates.map((c) => {
              const isSelected = selectedCandidate?.id === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedCandidate(c)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2 relative ${
                    isSelected
                      ? 'bg-indigo-950/50 border-indigo-500/60 shadow-lg shadow-indigo-500/10'
                      : 'bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-white text-sm">{c.name}</h4>
                      <p className="text-xs text-slate-300">{c.current_title} • {c.current_company}</p>
                    </div>
                    {c.ai_score > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {c.ai_score}% Match
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1 text-[10px] text-slate-400">
                    <span className={`px-2 py-0.5 rounded border font-bold ${STAGE_COLORS[c.stage] || 'bg-slate-800 border-slate-700'}`}>{c.stage}</span>
                    {c.experience_years > 0 && <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700">{c.experience_years} yrs exp</span>}
                    {c.location && <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700">{c.location}</span>}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {c.skills.slice(0, 4).map((sk) => (
                      <span key={sk} className="text-[9px] bg-indigo-500/10 text-indigo-300 px-2 py-0.2 rounded border border-indigo-500/20">
                        {sk}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Profile / Edit / Notes */}
        <div className="lg:col-span-7 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl space-y-6">
          {selectedCandidate ? (
            <div className="space-y-6">
              {/* Profile Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
                <div>
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center font-extrabold text-white text-lg shadow-lg">
                      {selectedCandidate.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{selectedCandidate.name}</h3>
                      <p className="text-xs text-slate-300">
                        {selectedCandidate.current_title} at <span className="font-semibold text-indigo-300">{selectedCandidate.current_company}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedCandidate.stage}
                    onChange={(e) => handleStageChange(e.target.value as PipelineStage)}
                    className="bg-indigo-950 border border-indigo-500/40 rounded-xl px-3 py-1.5 text-xs text-indigo-200 font-bold focus:outline-none"
                  >
                    {STAGES.map((s) => <option key={s} value={s}>Stage: {s}</option>)}
                  </select>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 flex items-center gap-1.5 transition-all"
                  >
                    <Pencil className="w-3.5 h-3.5 text-indigo-400" /> Edit Profile
                  </button>
                </div>
              </div>

              {/* EDIT MODE */}
              {isEditing ? (
                <EditCandidateForm
                  candidate={selectedCandidate}
                  jobs={jobs}
                  onCancel={() => setIsEditing(false)}
                  onSaved={handleEditSaved}
                />
              ) : (
                <>
                  {/* Contact strip */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-white/5 p-4 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-slate-200 font-medium break-all">{selectedCandidate.email || '— not added yet'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-slate-200 font-medium">{selectedCandidate.phone || '— not added yet'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-slate-200 font-medium">{selectedCandidate.location || '— not added yet'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-slate-200 font-medium">
                        {selectedCandidate.job_title ? selectedCandidate.job_title : 'Talent pool (no requisition)'}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {onSelectCandidateForInterview && (
                      <button
                        onClick={() => onSelectCandidateForInterview(selectedCandidate)}
                        className="px-3.5 py-2 rounded-xl bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white text-xs font-bold transition-all border border-indigo-500/30 flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Generate AI Interview Kit</span>
                      </button>
                    )}

                    {onSelectCandidateForOutreach && (
                      <button
                        onClick={() => onSelectCandidateForOutreach(selectedCandidate)}
                        className="px-3.5 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white text-xs font-bold transition-all border border-purple-500/30 flex items-center gap-1.5"
                      >
                        <Mail className="w-3.5 h-3.5 text-purple-400" />
                        <span>Generate Email Sequence</span>
                      </button>
                    )}
                  </div>

                  {/* Grid Details */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-white/5 p-4 rounded-2xl border border-white/5">
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Experience</span>
                      <p className="text-slate-200 font-medium truncate">{selectedCandidate.experience_years > 0 ? `${selectedCandidate.experience_years} yrs` : '—'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Expected Salary</span>
                      <p className="text-emerald-400 font-semibold">{selectedCandidate.expected_salary || '—'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Notice Period</span>
                      <p className="text-slate-200 font-medium">{selectedCandidate.notice_period || '—'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Source</span>
                      <p className="text-indigo-300 font-medium">{selectedCandidate.source || '—'}</p>
                    </div>
                  </div>

                  {/* Skills & AI Match Explanation */}
                  <div className="space-y-3">
                    {selectedCandidate.match_reason && (
                      <div className="p-4 bg-indigo-950/30 border border-indigo-500/30 rounded-2xl space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> AI Resume Intelligence Justification
                        </span>
                        <p className="text-xs text-slate-200 leading-relaxed">{selectedCandidate.match_reason}</p>
                      </div>
                    )}

                    {selectedCandidate.skills.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-slate-300 mb-2">Structured Skills Matrix</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedCandidate.skills.map((s) => (
                            <span key={s} className="text-xs bg-slate-800 text-slate-200 px-3 py-1 rounded-xl border border-slate-700 font-medium">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* CANDIDATE CRM ACTIVITY TIMELINE */}
              <div className="space-y-4 pt-4 border-t border-white/10">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-400" /> Candidate CRM Activity & Notes Log
                </h4>

                {/* Add Note Form */}
                <form onSubmit={handleAddNote} className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2">
                    <select
                      value={noteType}
                      onChange={(e) => setNoteType(e.target.value as any)}
                      className="bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                    >
                      <option value="call">📞 Phone Call</option>
                      <option value="email">📧 Email / Message</option>
                      <option value="interview">🎙️ Interview Feedback</option>
                      <option value="note">📝 General Note</option>
                    </select>

                    <input
                      type="text"
                      placeholder="Title e.g. Salary Discussion"
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                    />
                  </div>

                  <textarea
                    rows={2}
                    placeholder="Log conversation notes, interview feedback, or compensation expectations..."
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isAddingNote || !noteContent.trim()}
                      className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isAddingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      <span>Add CRM Entry</span>
                    </button>
                  </div>
                </form>

                {/* Activity Feed */}
                <div className="space-y-3">
                  {selectedCandidate.activities && selectedCandidate.activities.length > 0 ? (
                    selectedCandidate.activities.map((act) => (
                      <div key={act.id} className="p-3.5 bg-slate-950/80 border border-white/5 rounded-xl text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-indigo-300">{act.title}</span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(act.timestamp).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })} by {act.author}
                          </span>
                        </div>
                        <p className="text-slate-300 leading-relaxed">{act.content}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 italic">No notes logged yet. Log the first recruiter call or interview feedback above.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center text-slate-500 text-xs">
              Select a candidate from the left list to view full CRM details & history — or upload a resume to begin intake with human review.
            </div>
          )}
        </div>
      </div>

      ) : (
      /* Batch Screening sub-tab */
      <div className="space-y-4">
        {/* Target requisition selector (replaces the old "seed from latest job" hack) */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Screen against this requisition</span>
            <select
              value={screenJobId}
              onChange={(e) => { setScreenJobId(e.target.value); setEvaluations([]); }}
              className="mt-1.5 w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">— Select a Job Description —</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} — {j.location || 'Any location'}
                </option>
              ))}
            </select>
          </div>
          <p className="text-[11px] text-slate-500 max-w-md">
            Scored candidates land here with their AI scorecard. Click “Save to pool” on any result to file it under this requisition.
          </p>
        </div>

        <ResumeEvalPanel
          sessionId={sessionIdRef.current}
          jdText={screenJdText}
          jdFilename={screenJdFilename}
          selectedModel={selectedModel}
          jobId={screenJobId}
          candidates={candidates}
          evaluations={evaluations}
          onEvaluationsChange={setEvaluations}
          onSavedToPool={handleSavedToPool}
        />
      </div>
      )}


      {/* Add / upload / bulk modal */}
      {showAddModal && (
        <AddCandidateModal
          jobs={jobs}
          prefillJobId={filterJobId !== 'all' ? filterJobId : ''}
          onClose={() => setShowAddModal(false)}
          onSaved={(c) => {
            setShowAddModal(false);
            onCandidatesUpdated();
            setSubTab('candidates');
            setSelectedCandidateRaw(c);
          }}
          onBulkSaved={(cs) => {
            setShowAddModal(false);
            onCandidatesUpdated();
            setSubTab('candidates');
            if (cs[0]) setSelectedCandidateRaw(cs[0]);
          }}
        />
      )}
    </div>
  );
};
