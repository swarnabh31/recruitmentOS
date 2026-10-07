import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Job, Candidate } from '../types';
import {
  createCandidate,
  parseResumeDraft,
  parseResumesBulk,
  BulkParseItem,
  ResumeDraft,
} from '../lib/api';
import {
  UserPlus, X, Loader2, Check, Sparkles, UploadCloud,
  FolderInput,
} from 'lucide-react';

/* Shared style tokens (kept in sync with CandidatesCRMModule's input/label classes) */
const inputCls =
  'bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 w-full placeholder:text-slate-500';
const labelCls = 'text-[10px] font-bold uppercase tracking-wider text-slate-400';
const actionBtnCls =
  'px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg disabled:opacity-50 flex items-center gap-1.5';

type TabId = 'manual' | 'upload' | 'bulk';

const SkillEditor: React.FC<{ skills: string[]; onChange: (s: string[]) => void }> = ({ skills, onChange }) => {
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
          <Check className="w-3.5 h-3.5" /> Add
        </button>
      </div>
    </div>
  );
};

const JobSelect: React.FC<{ jobs: Job[]; value: string; onChange: (v: string) => void }> = ({ jobs, value, onChange }) => (
  <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl space-y-2">
    <span className={labelCls + ' !text-emerald-300'}>
      Open Requisition <span className="normal-case font-normal">(optional — leave empty for talent pool)</span>
    </span>
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      <option value="">Talent Pool — no active requisition</option>
      {jobs.map((j) => (
        <option key={j.id} value={j.id}>{j.title} — {j.location || 'Any location'}</option>
      ))}
    </select>
    <p className="text-[11px] text-emerald-300/80">
      With a requisition the candidate lands at <span className="font-semibold">Applied</span>; without one they park at <span className="font-semibold">Screening</span>.
    </p>
  </div>
);

export const AddCandidateModal: React.FC<{
  jobs: Job[];
  prefillJobId?: string;
  onClose: () => void;
  onSaved: (c: Candidate) => void;
  onBulkSaved?: (cs: Candidate[]) => void;
}> = ({ jobs, prefillJobId = '', onClose, onSaved, onBulkSaved }) => {
  const [tab, setTab] = useState<TabId>('manual');
  const [selectedJobId, setSelectedJobId] = useState(prefillJobId || '');

  const [form, setForm] = useState<Record<string, any>>({
    name: '', email: '', phone: '', current_title: '', current_company: '',
    experience_years: '', location: '', expected_salary: '', notice_period: '',
    linkedin_url: '', github_url: '', skills: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ResumeDraft | null>(null);
  const [draftForm, setDraftForm] = useState<Record<string, any>>({});
  const [draftSkills, setDraftSkills] = useState<string[]>([]);

  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkParsing, setBulkParsing] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkResults, setBulkResults] = useState<BulkParseItem[] | null>(null);
  const [bulkSelected, setBulkSelected] = useState<Record<string, boolean>>({});

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const targetJobId = (): string =>
    selectedJobId || jobs.find((j) => (j.jd_text || '').length > 50)?.id || '';

  const submitManual = async () => {
    if (!form.name.trim()) { setError('Candidate name is the one thing we need — please fill it before saving.'); return; }
    setSaving(true); setError(null);
    const job = jobs.find((j) => j.id === selectedJobId) || null;
    const candidate: any = await createCandidate({
      name: form.name, email: form.email, phone: form.phone,
      current_title: form.current_title, current_company: form.current_company,
      experience_years: Number(form.experience_years) || 0,
      location: form.location, expected_salary: form.expected_salary,
      notice_period: form.notice_period, linkedin_url: form.linkedin_url, github_url: form.github_url,
      skills: form.skills, resume_filename: '', resume_text: '',
      job_id: job ? job.id : '', job_title: job ? job.title : '',
      ai_score: 0, stage: job ? 'Applied' : 'Screening',
      source: 'Manual Entry (Recruiter)',
    });
    setSaving(false);
    if (candidate && candidate.id) onSaved(candidate);
    else setError('Failed to save candidate — server returned no candidate.');
  };

  const runParse = async () => {
    if (!uploadFile) return;
    setIsParsing(true); setUploadError(null);
    const res = await parseResumeDraft(uploadFile, targetJobId() || undefined, undefined);
    setIsParsing(false);
    if (res.success && res.draft) {
      const d: any = res.draft;
      setDraft(d);
      setDraftSkills(d.skills || []);
      setDraftForm({
        name: d.name, email: d.email, phone: d.phone,
        current_title: d.current_title, current_company: d.current_company,
        experience_years: d.experience_years ? String(d.experience_years) : '',
        location: d.location, expected_salary: d.expected_salary,
        notice_period: d.notice_period, linkedin_url: d.linkedin_url, github_url: d.github_url,
      });
      if (!selectedJobId && d.job_id) setSelectedJobId(d.job_id);
    } else {
      setUploadError(res.error || 'AI could not parse that resume (file may be scanned/image-only).');
    }
  };

  const submitDraft = async () => {
    if (!draft) return;
    if (!(draftForm.name && String(draftForm.name).trim())) {
      setUploadError('Candidate name is the one thing we need — please fill it before saving.'); return;
    }
    setSaving(true); setUploadError(null);
    const job = jobs.find((j) => j.id === selectedJobId) || null;
    const candidate: any = await createCandidate({
      ...draft, ...draftForm,
      experience_years: Number(draftForm.experience_years) || 0,
      skills: draftSkills,
      job_id: job?.id || (draft as any).job_id || '', job_title: job?.title || (draft as any).job_title || '',
      stage: job ? 'Applied' : 'Screening',
      source: 'Resume Intelligence Parser',
    });
    setSaving(false);
    if (candidate && candidate.id) onSaved(candidate);
    else setUploadError('Failed to save candidate — server returned no candidate.');
  };

  const runBulkParse = async () => {
    if (bulkFiles.length === 0) return;
    setBulkParsing(true); setBulkError(null);
    const res = await parseResumesBulk(bulkFiles, targetJobId() || undefined, undefined);
    setBulkParsing(false);
    if (!res.success) { setBulkError(res.error || 'Bulk parse failed — please retry.'); return; }
    const results = res.results || [];
    setBulkResults(results);
    const sel: Record<string, boolean> = {};
    results.forEach((r) => { sel[r.filename] = !!r.success; });
    setBulkSelected(sel);
    if (results.filter((r) => r.success).length === 0) {
      setBulkError('All resumes failed to parse. Check that they are text-based PDFs/DOCX, not scans.');
    }
  };

  const saveBulkSelected = async () => {
    if (!bulkResults) return;
    setSaving(true); setBulkError(null);
    const job = jobs.find((j) => j.id === selectedJobId) || null;
    const saved: Candidate[] = [];
    const failures: string[] = [];
    for (const r of bulkResults) {
      if (!bulkSelected[r.filename] || !r.draft) continue;
      try {
        const d: any = r.draft;
        const c: any = await createCandidate({
          ...d,
          job_id: job?.id || d.job_id || '', job_title: job?.title || d.job_title || '',
          stage: job ? 'Applied' : 'Screening',
          source: 'Resume Intelligence Parser (Bulk)',
        });
        if (c && c.id) saved.push(c); else failures.push(r.filename);
      } catch {
        failures.push(r.filename);
      }
    }
    setSaving(false);
    if (saved.length > 0 && onBulkSaved) onBulkSaved(saved);
    else if (saved.length > 0) saved.forEach((c) => onSaved(c));
    if (failures.length > 0) {
      setBulkError(`Saved ${saved.length}, failed ${failures.length}: ${failures.join(', ')}`);
    }
  };

  const tabCls = (id: TabId) =>
    `flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
      tab === id
        ? 'bg-indigo-600 text-white border-indigo-400/40 shadow-lg shadow-indigo-600/20'
        : 'bg-white/5 text-slate-400 hover:text-slate-200 border-transparent'
    }`;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-slate-900 border border-white/10 rounded-2xl shadow-2xl">
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-white/10 p-5 space-y-4 z-10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-400" /> Add Candidate
              </h3>
              <p className="text-xs text-slate-400">
                Enter a profile by hand, import one resume with the AI, or bulk-import a whole stack of resumes.
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 border border-white/10"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex gap-2">
            <button className={tabCls('manual')} onClick={() => setTab('manual')}><UserPlus className="w-3.5 h-3.5" /> Manual Entry</button>
            <button className={tabCls('upload')} onClick={() => setTab('upload')}><UploadCloud className="w-3.5 h-3.5" /> Upload Resume (AI)</button>
            <button className={tabCls('bulk')} onClick={() => setTab('bulk')}><FolderInput className="w-3.5 h-3.5" /> Bulk Upload (AI)</button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {tab === 'manual' && (
            <>
              <JobSelect jobs={jobs} value={selectedJobId} onChange={setSelectedJobId} />
              <div className="space-y-3">
                <span className={labelCls}>Candidate Details <span className="normal-case font-normal">(all optional — fill in whenever you have them)</span></span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelCls}>Full Name *</label><input value={form.name || ''} onChange={set('name')} placeholder="e.g. Priya Sharma" className={inputCls} /></div>
                  <div><label className={labelCls}>Email</label><input value={form.email || ''} onChange={set('email')} placeholder="candidate@email.com" className={inputCls} /></div>
                  <div><label className={labelCls}>Phone</label><input value={form.phone || ''} onChange={set('phone')} placeholder="+91 98xxxxxx" className={inputCls} /></div>
                  <div><label className={labelCls}>Location</label><input value={form.location || ''} onChange={set('location')} placeholder="City, Country / Remote" className={inputCls} /></div>
                  <div className="sm:col-span-2"><label className={labelCls}>Current Role</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input value={form.current_title || ''} onChange={set('current_title')} placeholder="Job title" className={inputCls} />
                      <input value={form.current_company || ''} onChange={set('current_company')} placeholder="Company" className={inputCls} />
                    </div></div>
                  <div><label className={labelCls}>Experience (years)</label><input type="number" min="0" value={form.experience_years || ''} onChange={set('experience_years')} placeholder="e.g. 5" className={inputCls} /></div>
                  <div><label className={labelCls}>Expected Salary</label><input value={form.expected_salary || ''} onChange={set('expected_salary')} placeholder="e.g. ₹25 LPA / Market Rate" className={inputCls} /></div>
                  <div><label className={labelCls}>Notice Period</label><input value={form.notice_period || ''} onChange={set('notice_period')} placeholder="e.g. 30 Days" className={inputCls} /></div>
                  <div><label className={labelCls}>LinkedIn URL</label><input value={form.linkedin_url || ''} onChange={set('linkedin_url')} placeholder="https://linkedin.com/in/..." className={inputCls} /></div>
                  <div><label className={labelCls}>GitHub URL</label><input value={form.github_url || ''} onChange={set('github_url')} placeholder="https://github.com/..." className={inputCls} /></div>
                </div>
              </div>
              <div className="space-y-3">
                <span className={labelCls}><Sparkles className="inline w-3 h-3 mr-1 text-indigo-400" />Skills</span>
                <SkillEditor skills={form.skills || []} onChange={(s: string[]) => setForm((f: any) => ({ ...f, skills: s }))} />
              </div>
              {error && <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-red-200 text-xs">{error}</div>}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-white/10">
                <p className="text-[11px] text-slate-500">Saved with AI score 0 until they pass AI screening.</p>
                <button onClick={submitManual} disabled={saving} className={actionBtnCls}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {saving ? 'Saving…' : 'Save Candidate'}
                </button>
              </div>
            </>
          )}

          {tab === 'upload' && (
            <>
              <JobSelect jobs={jobs} value={selectedJobId} onChange={setSelectedJobId} />
              {!draft && (
                <>
                  <label className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${
                    isParsing ? 'border-indigo-500 bg-indigo-950/20' : 'border-white/20 bg-white/5 hover:border-indigo-500 hover:bg-white/10'
                  }`}>
                    {isParsing ? <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-2" /> : <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />}
                    <span className="text-xs font-semibold text-slate-200">
                      {isParsing ? 'AI is reading & scoring the resume…' : (uploadFile ? uploadFile.name : 'Drop a resume (PDF / DOCX / TXT) or click to browse')}
                    </span>
                    <span className="text-[10px] text-slate-500 mt-1">
                      {isParsing ? 'Local model — typically 30–90s. Please wait.' : 'AI extracts name, contact, role & skills, then scores the match against the selected JD.'}
                    </span>
                    <input type="file" accept=".pdf,.docx,.doc,.txt" className="hidden" disabled={isParsing}
                      onChange={(e) => { setUploadFile(e.target.files?.[0] || null); setUploadError(null); }} />
                  </label>
                  {uploadError && <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-red-200 text-xs">{uploadError}</div>}
                  <div className="flex justify-end">
                    <button onClick={runParse} disabled={!uploadFile || isParsing} className={actionBtnCls}>
                      {isParsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {isParsing ? 'Parsing…' : 'Parse & Score with AI'}
                    </button>
                  </div>
                </>
              )}
              {draft && (
                <>
                  <div className="p-4 bg-indigo-950/30 border border-indigo-500/30 rounded-2xl flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-indigo-400" /> AI Extracted · Ready to review
                      </span>
                      <p className="text-[11px] text-slate-300 mt-1">
                        AI pulled these fields from <span className="font-semibold">{draft.resume_filename}</span>. Verify, adjust, then save.
                      </p>
                    </div>
                    {typeof draft.ai_score === 'number' && draft.ai_score > 0 && (
                      <span className="px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-extrabold shrink-0">{draft.ai_score}% match</span>
                    )}
                  </div>
                  {typeof draft.ai_score === 'number' && draft.ai_score > 0 && (draft as any).match_reason && (
                    <div className="p-4 bg-slate-950/60 border border-white/10 rounded-2xl">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">AI Assessment Note</span>
                      <p className="text-xs text-slate-200 leading-relaxed mt-2">{(draft as any).match_reason}</p>
                      {(draft as any).key_strengths?.length > 0 && (
                        <p className="text-xs text-emerald-300 mt-2">Strengths: {(draft as any).key_strengths.join(', ')}</p>
                      )}
                    </div>
                  )}
                  <div className="space-y-3">
                    <span className={labelCls}>Candidate Details <span className="normal-case font-normal">(all optional — fix anything the AI got wrong)</span></span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div><label className={labelCls}>Full Name *</label><input value={draftForm.name || ''} onChange={(e) => setDraftForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Priya Sharma" className={inputCls} /></div>
                      <div><label className={labelCls}>Email</label><input value={draftForm.email || ''} onChange={(e) => setDraftForm((f) => ({ ...f, email: e.target.value }))} placeholder="candidate@email.com" className={inputCls} /></div>
                      <div><label className={labelCls}>Phone</label><input value={draftForm.phone || ''} onChange={(e) => setDraftForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+91 98xxxxxx" className={inputCls} /></div>
                      <div><label className={labelCls}>Location</label><input value={draftForm.location || ''} onChange={(e) => setDraftForm((f) => ({ ...f, location: e.target.value }))} placeholder="City, Country / Remote" className={inputCls} /></div>
                      <div className="sm:col-span-2"><label className={labelCls}>Current Role</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input value={draftForm.current_title || ''} onChange={(e) => setDraftForm((f) => ({ ...f, current_title: e.target.value }))} placeholder="Job title" className={inputCls} />
                          <input value={draftForm.current_company || ''} onChange={(e) => setDraftForm((f) => ({ ...f, current_company: e.target.value }))} placeholder="Company" className={inputCls} />
                        </div></div>
                      <div><label className={labelCls}>Experience (years)</label><input type="number" min="0" value={draftForm.experience_years || ''} onChange={(e) => setDraftForm((f) => ({ ...f, experience_years: e.target.value }))} placeholder="e.g. 5" className={inputCls} /></div>
                      <div><label className={labelCls}>Expected Salary</label><input value={draftForm.expected_salary || ''} onChange={(e) => setDraftForm((f) => ({ ...f, expected_salary: e.target.value }))} placeholder="e.g. ₹25 LPA / Market Rate" className={inputCls} /></div>
                      <div><label className={labelCls}>Notice Period</label><input value={draftForm.notice_period || ''} onChange={(e) => setDraftForm((f) => ({ ...f, notice_period: e.target.value }))} placeholder="e.g. 30 Days" className={inputCls} /></div>
                      <div><label className={labelCls}>LinkedIn URL</label><input value={draftForm.linkedin_url || ''} onChange={(e) => setDraftForm((f) => ({ ...f, linkedin_url: e.target.value }))} placeholder="https://linkedin.com/in/..." className={inputCls} /></div>
                      <div><label className={labelCls}>GitHub URL</label><input value={draftForm.github_url || ''} onChange={(e) => setDraftForm((f) => ({ ...f, github_url: e.target.value }))} placeholder="https://github.com/..." className={inputCls} /></div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <span className={labelCls}><Sparkles className="inline w-3 h-3 mr-1 text-indigo-400" />Skills</span>
                    <SkillEditor skills={draftSkills} onChange={setDraftSkills} />
                  </div>
                  {uploadError && <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-red-200 text-xs">{uploadError}</div>}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-white/10">
                    <button onClick={() => { setDraft(null); setUploadFile(null); setUploadError(null); }} disabled={saving}
                      className="text-xs text-slate-400 hover:text-white font-semibold">{'←'} Back / re-upload</button>
                    <button onClick={() => submitDraft()} disabled={saving} className={actionBtnCls}>
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      {saving ? 'Saving…' : 'Save Candidate'}
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {tab === 'bulk' && (
            <>
              <JobSelect jobs={jobs} value={selectedJobId} onChange={setSelectedJobId} />
              {!bulkResults && (
                <>
                  <label className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${
                    bulkParsing ? 'border-indigo-500 bg-indigo-950/20' : 'border-white/20 bg-white/5 hover:border-indigo-500 hover:bg-white/10'
                  }`}>
                    {bulkParsing ? <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-2" /> : <FolderInput className="w-8 h-8 text-slate-400 mb-2" />}
                    <span className="text-xs font-semibold text-slate-200">
                      {bulkParsing
                        ? `AI is parsing & scoring ${bulkFiles.length} resume${bulkFiles.length > 1 ? 's' : ''}…`
                        : (bulkFiles.length > 0
                              ? `${bulkFiles.length} resume${bulkFiles.length > 1 ? 's' : ''} staged for bulk parse`
                              : 'Drop multiple resumes (PDF / DOCX / TXT) or click to browse')}
                    </span>
                    <span className="text-[10px] text-slate-500 mt-1">
                      {bulkParsing
                        ? 'One AI pass per resume — a 10-resume batch typically takes 5–10 min on the local model. Keep this open.'
                        : 'Each resume is parsed, scored against the selected JD, and queued for one-click saving.'}
                    </span>
                    <input type="file" accept=".pdf,.docx,.doc,.txt" multiple className="hidden" disabled={bulkParsing}
                      onChange={(e) => { setBulkFiles(e.target.files ? Array.from(e.target.files) : []); setBulkError(null); }} />
                  </label>

                  {bulkFiles.length > 0 && !bulkParsing && (
                    <div className="p-3 bg-slate-950/60 border border-white/10 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Staged files ({bulkFiles.length})</span>
                        <button onClick={() => { setBulkFiles([]); setBulkError(null); }} className="text-[11px] text-rose-300 hover:underline font-semibold">Clear all</button>
                      </div>
                      <ul className="space-y-1 max-h-36 overflow-y-auto pr-1">
                        {bulkFiles.map((f, i) => (
                          <li key={i} className="flex items-center gap-2 text-xs text-slate-300">
                            <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span className="truncate flex-1">{f.name}</span>
                            <span className="text-[10px] text-slate-500 shrink-0">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {bulkError && <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-red-200 text-xs">{bulkError}</div>}
                  <div className="flex justify-end">
                    <button onClick={runBulkParse} disabled={bulkFiles.length === 0 || bulkParsing} className={actionBtnCls}>
                      {bulkParsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {bulkParsing ? `Parsing ${bulkFiles.length}…` : `Bulk Parse ${bulkFiles.length || ''} Resume${bulkFiles.length !== 1 ? 's' : ''} (AI)`}
                    </button>
                  </div>
                </>
              )}
              {bulkResults && (
                <>
                  <div className="p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-400" /> Bulk Parse Complete
                      </span>
                      <p className="text-[11px] text-slate-300 mt-1">
                        {bulkResults.filter((r) => r.success).length} of {bulkResults.length} succeeded. Uncheck any to skip, then save.
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-extrabold shrink-0">
                      {Object.values(bulkSelected).filter(Boolean).length} selected
                    </span>
                  </div>
                  <div className="p-3 bg-slate-950/60 border border-white/10 rounded-2xl space-y-2 max-h-[42vh] overflow-y-auto">
                    {bulkResults.map((r, i) => {
                      const checked = !!bulkSelected[r.filename];
                      return (
                        <label key={i} className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                          checked ? 'bg-indigo-950/30 border-indigo-500/40' : 'bg-white/5 border-white/10 opacity-70'
                        } ${r.success ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                          <input type="checkbox" checked={checked} disabled={!r.success}
                            onChange={(e) => setBulkSelected((s) => ({ ...s, [r.filename]: e.target.checked }))}
                            className="mt-0.5 accent-indigo-500" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-white truncate">
                              {r.success ? (r.draft?.name || r.filename) : r.filename}
                            </p>
                            {r.success && r.draft ? (
                              <>
                                <p className="text-[11px] text-slate-400 truncate">
                                  {r.draft.current_title || 'No title'} · {r.draft.experience_years ?? '?'} yrs · {(r.draft.skills || []).slice(0, 4).join(', ') || 'no skills'}
                                </p>
                                {typeof r.draft.ai_score === 'number' && r.draft.ai_score > 0 && (
                                  <p className="text-[10px] text-emerald-300/90 font-semibold mt-0.5">
                                    {r.draft.ai_score}% JD match{(r.draft as any).match_reason ? ` · ${(r.draft as any).match_reason.slice(0, 90)}` : ''}
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="text-[11px] text-rose-300 mt-1">{r.error || 'Failed to parse'}</p>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  {bulkError && <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-red-200 text-xs">{bulkError}</div>}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-white/10">
                    <button onClick={() => { setBulkResults(null); setBulkFiles([]); setBulkError(null); }} disabled={saving}
                      className="text-xs text-slate-400 hover:text-white font-semibold">{'←'} Back / re-upload</button>
                    <button onClick={saveBulkSelected}
                      disabled={saving || Object.values(bulkSelected).filter(Boolean).length === 0}
                      className={actionBtnCls}>
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      {saving ? 'Saving to pipeline…' : `Add ${Object.values(bulkSelected).filter(Boolean).length} Candidate${Object.values(bulkSelected).filter(Boolean).length !== 1 ? 's' : ''} to Pipeline`}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
