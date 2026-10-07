import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Job } from '../../types';
import { useModel } from '../../lib/ModelContext';
import { generateJD, analyzeJD, createJob, updateJob, parseJDFromAttachment, bulkDeleteJobs, bulkUpdateJobs, createCandidate } from '../../lib/api';
import { Briefcase, Plus, Sparkles, FileText, CheckCircle2, Loader2, DollarSign, MapPin, Users, Send, Upload, Pencil, Trash2, CheckSquare, Square, X, Download, UserPlus } from 'lucide-react';
import { MarkdownView } from '../MarkdownView';
import { AddCandidateModal } from '../AddCandidateModal';

interface JobsModuleProps {
  jobs: Job[];
  onJobsUpdated: () => void;
  onSelectJob: (job: Job) => void;
}

export const JobsModule: React.FC<JobsModuleProps> = ({ jobs, onJobsUpdated, onSelectJob }) => {
  const { selectedModel } = useModel();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [useAiGenerator, setUseAiGenerator] = useState(true);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Form Fields
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('Engineering');
  const [location, setLocation] = useState('Hyderabad, India (Hybrid)');
  const [type, setType] = useState<'Full-time' | 'Remote' | 'Hybrid' | 'Contract'>('Full-time');
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('High');
  const [hiringManager, setHiringManager] = useState('');
  const [salaryRange, setSalaryRange] = useState('₹25,00,000 - ₹40,00,000');
  const [minExperience, setMinExperience] = useState(2);
  const [maxExperience, setMaxExperience] = useState(8);
  const [skillsStr, setSkillsStr] = useState('Node.js, Python, AWS, Kubernetes');
  const [jdText, setJdText] = useState('');

  // Attachment upload state
  const [isParsing, setIsParsing] = useState(false);
  const [parseSuccess, setParseSuccess] = useState(false);
  const [attachedFileName, setAttachedFileName] = useState('');

  // Edit mode
  const [editingJob, setEditingJob] = useState<Job | null>(null);

  // Manage mode
  const [manageMode, setManageMode] = useState(false);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());

  // Assign manager modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignManagerName, setAssignManagerName] = useState('');

  // Bulk upload modal
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [bulkUploadFile, setBulkUploadFile] = useState<File | null>(null);
  const [isBulkUploading, setIsBulkUploading] = useState(false);

  // Per-req "Add Candidate" quick modal (shared AddCandidateModal, pre-filled with this job)
  const [addCandidateForJob, setAddCandidateForJob] = useState<Job | null>(null);

  // Selected JD for detail view
  const [selectedJobDetail, setSelectedJobDetail] = useState<Job | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Lock page scroll while the AI Job Analysis modal is open (restored on close).
  useEffect(() => {
    if (!selectedJobDetail) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedJobDetail(null); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [selectedJobDetail]);
  const [jdAnalysisData, setJdAnalysisData] = useState<any | null>(null);

  const resetForm = () => {
    setTitle('');
    setDepartment('Engineering');
    setLocation('Hyderabad, India (Hybrid)');
    setType('Full-time');
    setPriority('High');
    setHiringManager('');
    setSalaryRange('₹25,00,000 - ₹40,00,000');
    setMinExperience(2);
    setMaxExperience(8);
    setSkillsStr('Node.js, Python, AWS, Kubernetes');
    setJdText('');
    setAiPrompt('');
    setParseSuccess(false);
    setAttachedFileName('');
    setEditingJob(null);
  };

  const openEditModal = (job: Job) => {
    setEditingJob(job);
    setTitle(job.title);
    setDepartment(job.department);
    setLocation(job.location);
    setType(job.type);
    setPriority(job.priority);
    setHiringManager(job.hiring_manager);
    setSalaryRange(job.salary_range);
    setMinExperience(job.min_experience || 0);
    setMaxExperience(job.max_experience || 10);
    setSkillsStr(job.required_skills.join(', '));
    setJdText(job.jd_text);
    setShowCreateModal(true);
  };

  const handleGenerateJdWithAi = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    try {
      // Client-side safety net: never let a hung model freeze the button.
      const gen = generateJD(aiPrompt, selectedModel);
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timed out waiting for the AI engine. It may be busy or offline — try again, or pick a smaller model.')), 180000)
      );
      const res = await Promise.race([gen, timeout]);
      if (res.success && res.text) {
        setJdText(res.text);
        if (!title) {
          const firstLine = res.text.split('\n')[0].replace(/#|\*/g, '').trim();
          if (firstLine && firstLine.length < 50) setTitle(firstLine);
        }
      } else {
        alert(res.error || 'Failed to generate the job description. Try again or pick a different model in the header.');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to reach the AI engine. Check that the server is running and try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['.pdf', '.docx', '.doc', '.md', '.markdown'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!validTypes.includes(ext)) {
      alert('Please upload a PDF, DOCX, DOC, or Markdown (MD) file.');
      return;
    }

    setIsParsing(true);
    setParseSuccess(false);
    setAttachedFileName('');

    const res = await parseJDFromAttachment(file, selectedModel);

    if (res.success) {
      setTitle(res.title || '');
      setSkillsStr(Array.isArray(res.skills) ? res.skills.join(', ') : '');
      setJdText(res.jd_text || '');
      setAttachedFileName(file.name);
      setParseSuccess(true);
    } else {
      alert(res.error || 'Failed to parse JD document.');
    }

    setIsParsing(false);
    e.target.value = '';
  };

  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault();
    const requiredSkills = skillsStr.split(',').map((s) => s.trim()).filter(Boolean);
    const jobPayload = {
      title: title || 'Senior Engineer',
      department,
      location,
      type,
      priority,
      hiring_manager: hiringManager || 'Hiring Lead',
      salary_range: salaryRange,
      min_experience: Number(minExperience) || 0,
      max_experience: Number(maxExperience) || 10,
      required_skills: requiredSkills,
      jd_text: jdText || `${title} - ${department} role`,
      jd_filename: `${title.replace(/\s+/g, '_')}_JD.pdf`,
    };

    if (editingJob) {
      const updated = await updateJob(editingJob.id, jobPayload);
      if (updated) {
        onJobsUpdated();
        setShowCreateModal(false);
        resetForm();
      }
    } else {
      const newJob = await createJob(jobPayload);
      if (newJob) {
        onJobsUpdated();
        setShowCreateModal(false);
        resetForm();
      }
    }
  };

  const handleAnalyzeJobDetail = async (job: Job) => {
    setSelectedJobDetail(job);
    setIsAnalyzing(true);
    const res = await analyzeJD(job.jd_text, selectedModel);
    setIsAnalyzing(false);
    if (res.success && res.data) {
      setJdAnalysisData(res.data);
    }
  };

  const handleToggleSelect = (jobId: string) => {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedJobIds.size === jobs.length) {
      setSelectedJobIds(new Set());
    } else {
      setSelectedJobIds(new Set(jobs.map((j) => j.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedJobIds.size === 0) return;
    const ok = window.confirm(`Delete ${selectedJobIds.size} job requisition(s)? This cannot be undone.`);
    if (!ok) return;
    const success = await bulkDeleteJobs([...selectedJobIds]);
    if (success) {
      setSelectedJobIds(new Set());
      onJobsUpdated();
    }
  };

  const handleBulkAssignManager = async () => {
    if (selectedJobIds.size === 0 || !assignManagerName.trim()) return;
    const success = await bulkUpdateJobs([...selectedJobIds], { hiring_manager: assignManagerName.trim() });
    if (success) {
      setShowAssignModal(false);
      setAssignManagerName('');
      setSelectedJobIds(new Set());
      onJobsUpdated();
    }
  };

  const handleBulkUpload = async () => {
    if (!bulkUploadFile || selectedJobIds.size === 0) return;
    setIsBulkUploading(true);
    const fileText = await bulkUploadFile.text();
    const lines = fileText.split('\n').filter((l) => l.trim());
    let successCount = 0;
    for (const line of lines) {
      const parts = line.split(',').map((p) => p.trim());
      if (parts.length < 1) continue;
      const candidatePayload = {
        name: parts[0] || `Candidate ${Math.random().toString(36).substring(2, 6)}`,
        email: parts[1] || '',
        phone: parts[2] || '',
        current_title: parts[3] || '',
        current_company: parts[4] || '',
        experience_years: parseInt(parts[5]) || 0,
        skills: parts[6] ? parts[6].split(';').map((s) => s.trim()) : [],
        job_id: [...selectedJobIds][0],
        stage: 'Applied',
      };
      const created = await createCandidate(candidatePayload);
      if (created) successCount++;
    }
    setIsBulkUploading(false);
    setShowBulkUploadModal(false);
    setBulkUploadFile(null);
    alert(`Uploaded ${successCount} candidate(s) successfully.`);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Briefcase className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-white">Job Requisition Management</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Create, track, and analyze hiring requirements across departments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setManageMode(!manageMode);
              setSelectedJobIds(new Set());
            }}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
              manageMode
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/30'
                : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Manage</span>
          </button>

          <button
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 border border-white/20 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Requisition</span>
          </button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {manageMode && selectedJobIds.size > 0 && (
        <div className="sticky top-4 z-40 bg-indigo-900/80 backdrop-blur-xl border border-indigo-500/40 rounded-2xl p-4 shadow-2xl flex items-center justify-between">
          <span className="text-sm font-bold text-white">
            {selectedJobIds.size} job(s) selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setAssignManagerName('');
                setShowAssignModal(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Assign Manager</span>
            </button>
            <button
              onClick={() => setShowBulkUploadModal(true)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Candidates</span>
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-3 py-1.5 rounded-xl bg-red-600/80 hover:bg-red-600 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
            <button
              onClick={() => { setManageMode(false); setSelectedJobIds(new Set()); }}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Jobs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
        {manageMode && (
          <div
            onClick={handleSelectAll}
            className="bg-slate-900/40 backdrop-blur-xl border border-dashed border-white/10 rounded-2xl p-6 flex items-center justify-center cursor-pointer hover:border-indigo-500/40 transition-all"
          >
            <div className="flex items-center gap-2 text-slate-400 hover:text-indigo-300 transition-colors">
              {selectedJobIds.size === jobs.length ? (
                <CheckSquare className="w-5 h-5" />
              ) : (
                <Square className="w-5 h-5" />
              )}
              <span className="text-sm font-bold">
                {selectedJobIds.size === jobs.length ? 'Deselect All' : 'Select All'}
              </span>
            </div>
          </div>
        )}

        {jobs.map((job) => (
          <div
            key={job.id}
            className={`flex flex-col bg-slate-900/60 backdrop-blur-xl border rounded-2xl p-6 shadow-xl hover:border-indigo-500/40 transition-all space-y-4 relative overflow-hidden group ${
              manageMode && selectedJobIds.has(job.id)
                ? 'border-indigo-500 ring-1 ring-indigo-500/50'
                : 'border-white/10'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {manageMode && (
                  <button onClick={(e) => { e.stopPropagation(); handleToggleSelect(job.id); }}>
                    {selectedJobIds.has(job.id) ? (
                      <CheckSquare className="w-5 h-5 text-indigo-400" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-500 hover:text-slate-300" />
                    )}
                  </button>
                )}
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">
                      {job.title}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {job.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{job.department} Department</p>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                {job.priority} Priority
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 bg-white/5 p-3 rounded-xl border border-white/5">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                <span className="truncate">{job.location}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>{job.salary_range}</span>
              </div>
              <div className="flex items-center gap-1.5 col-span-2">
                <Users className="w-3.5 h-3.5 text-purple-400" />
                <span>Manager: {job.hiring_manager}</span>
              </div>
              <div className="flex items-center gap-1.5 col-span-2">
                <Briefcase className="w-3.5 h-3.5 text-orange-400" />
                <span>Experience: {job.min_experience || 0} - {job.max_experience || 10} years</span>
              </div>
            </div>

            {/* Skill tags */}
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">Required Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {job.required_skills.map((sk) => (
                  <span key={sk} className="text-[10px] font-medium bg-slate-800 text-indigo-300 px-2.5 py-0.5 rounded-md border border-slate-700">
                    {sk}
                  </span>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-auto pt-3 border-t border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleAnalyzeJobDetail(job)}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Analyze</span>
                </button>
                {!manageMode && (
                  <button
                    onClick={() => openEditModal(job)}
                    className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                )}
              </div>

              <button
                onClick={() => onSelectJob(job)}
                className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-200 hover:text-white text-xs font-bold transition-all flex items-center gap-1"
              >
                <span>View Candidates ({job.candidate_count || 0})</span>
              </button>
              <button
                onClick={() => setAddCandidateForJob(job)}
                className="px-3 py-1.5 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/30 text-emerald-200 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 border border-emerald-500/20"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Candidate</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* CREATE / EDIT JOB MODAL — portaled to document.body so the tab root's
          animate-fadeIn transform can't hijack position:fixed (header clipped). */}
      {showCreateModal && (
        createPortal(
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex overflow-y-auto p-4"
          onClick={() => { setShowCreateModal(false); resetForm(); }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-white/15 rounded-3xl max-w-3xl w-full m-auto p-6 sm:p-8 space-y-6 shadow-2xl relative"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  {editingJob ? (
                    <><Pencil className="w-5 h-5 text-indigo-400" /> Edit Job Requisition</>
                  ) : (
                    <><Plus className="w-5 h-5 text-indigo-400" /> Create New Job Requisition</>
                  )}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {editingJob ? 'Modify role parameters or job description' : 'Define role parameters or generate complete JD with AI'}
                </p>
              </div>

              <button
                onClick={() => { setShowCreateModal(false); resetForm(); }}
                className="text-slate-400 hover:text-white text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* AI Generator Toggle */}
            <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" /> Use AI JD Generator
              </span>
              <button
                type="button"
                onClick={() => setUseAiGenerator(!useAiGenerator)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  useAiGenerator ? 'bg-indigo-600' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    useAiGenerator ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {useAiGenerator && (
              <div className="space-y-2 bg-indigo-950/40 p-4 rounded-xl border border-indigo-500/30">
                <label className="text-xs font-bold text-indigo-300">Prompt AI to write full Job Description:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g. Senior Backend Engineer with Python, FastAPI, AWS, and FinTech payment experience"
                    className="flex-1 bg-slate-950/80 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateJdWithAi}
                    disabled={isGenerating || !aiPrompt.trim()}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Generate</span>
                  </button>
                </div>
              </div>
            )}

            {/* JD Document Attachment Upload */}
            <div className="space-y-3 bg-white/5 p-4 rounded-xl border border-white/10">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-slate-200">Attach JD Document</span>
                <span className="text-[10px] text-slate-400">PDF, DOCX, DOC, MD</span>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex-1 flex items-center gap-2 bg-slate-950/80 border border-dashed border-white/15 rounded-xl px-3.5 py-2.5 cursor-pointer hover:border-indigo-500/50 transition-colors">
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-400">
                    {attachedFileName || 'Choose file or drag here'}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc,.md,.markdown,text/markdown,text/plain"
                    onChange={handleFileAttach}
                    disabled={isParsing}
                    className="hidden"
                  />
                </label>
              </div>
              {isParsing && (
                <div className="flex items-center gap-2 text-indigo-300 text-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Analyzing document and extracting fields...</span>
                </div>
              )}
              {parseSuccess && (
                <div className="flex items-center gap-2 text-emerald-400 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>JD parsed successfully! Title & skills auto-populated.</span>
                </div>
              )}
            </div>

            <form onSubmit={handleSaveJob} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-300 font-semibold mb-1 block">Job Title *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Senior Backend Engineer"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold mb-1 block">Department</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold mb-1 block">Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold mb-1 block">Salary Range</label>
                  <input
                    type="text"
                    value={salaryRange}
                    onChange={(e) => setSalaryRange(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold mb-1 block">Hiring Manager</label>
                  <input
                    type="text"
                    value={hiringManager}
                    onChange={(e) => setHiringManager(e.target.value)}
                    placeholder="e.g. Vikram Mehta"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold mb-1 block">Priority</label>
                  <select
                    value={priority}
                    onChange={(e: any) => setPriority(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="High">High Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="Low">Low Priority</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-300 font-semibold mb-1 block">Min Experience (years)</label>
                  <input
                    type="number"
                    min="0"
                    value={minExperience}
                    onChange={(e) => setMinExperience(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold mb-1 block">Max Experience (years)</label>
                  <input
                    type="number"
                    min="0"
                    value={maxExperience}
                    onChange={(e) => setMaxExperience(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold mb-1 block">Required Skills (comma separated)</label>
                <input
                  type="text"
                  value={skillsStr}
                  onChange={(e) => setSkillsStr(e.target.value)}
                  placeholder="Node.js, Python, AWS, Kubernetes"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold mb-1 block">Full Job Description Text</label>
                <textarea
                  rows={5}
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                  placeholder="Full JD Markdown or text..."
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
                />
              </div>

              <div className="pt-4 border-t border-white/10 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); resetForm(); }}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold shadow-lg shadow-indigo-600/30"
                >
                  {editingJob ? 'Update Requisition' : 'Save & Publish Role'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
        ))}

      {/* ASSIGN MANAGER MODAL */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/15 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" /> Assign Hiring Manager
              </h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-slate-400 hover:text-white font-bold p-1"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Assign a hiring manager to {selectedJobIds.size} selected job(s).
            </p>
            <input
              type="text"
              value={assignManagerName}
              onChange={(e) => setAssignManagerName(e.target.value)}
              placeholder="e.g. Vikram Mehta"
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkAssignManager}
                disabled={!assignManagerName.trim()}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs disabled:opacity-50"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK UPLOAD CANDIDATES MODAL */}
      {showBulkUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/15 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-400" /> Bulk Upload Candidates
              </h3>
              <button
                onClick={() => setShowBulkUploadModal(false)}
                className="text-slate-400 hover:text-white font-bold p-1"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Upload a CSV file with candidate data. Format per line: <span className="font-mono text-indigo-300">name,email,phone,title,company,experience_years,skill1;skill2</span>
            </p>
            <p className="text-xs text-slate-500">
              Candidates will be assigned to the first selected job ({selectedJobIds.size} selected).
            </p>
            <label className="flex items-center gap-2 bg-slate-950/80 border border-dashed border-white/15 rounded-xl px-3.5 py-3 cursor-pointer hover:border-indigo-500/50 transition-colors">
              <Download className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400">
                {bulkUploadFile ? bulkUploadFile.name : 'Choose CSV file'}
              </span>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={(e) => setBulkUploadFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowBulkUploadModal(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkUpload}
                disabled={!bulkUploadFile || isBulkUploading}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {isBulkUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                <span>{isBulkUploading ? 'Uploading...' : 'Upload'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JOB DETAIL ANALYSIS MODAL (centered, full-height, document-viewer style).
          Rendered in a portal to document.body so an ancestor transform
          (e.g. animate-fadeIn's retained translateY) can't hijack position:fixed. */}
      {selectedJobDetail &&
        createPortal(
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-stretch justify-center max-sm:p-0 sm:p-6 lg:p-8"
          onClick={() => setSelectedJobDetail(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-white/15 w-full max-w-[min(1200px,92vw)] h-full max-sm:h-dvh max-sm:rounded-none rounded-2xl overflow-hidden flex flex-col shadow-2xl relative"
          >
            <div className="flex items-start justify-between gap-4 px-6 sm:px-8 py-4 border-b border-white/10 bg-slate-950/40 shrink-0">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-indigo-300 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
                  <Sparkles className="w-3 h-3" /> AI Job Analysis
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-white mt-2 truncate">{selectedJobDetail.title}</h3>
              </div>
              <button
                onClick={() => setSelectedJobDetail(null)}
                aria-label="Close analysis"
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold shrink-0"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-8 py-4 sm:py-6 space-y-5 scrollbar-thin-themed">
            {isAnalyzing ? (
              <div className="py-20 text-center space-y-3">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
                <p className="text-xs text-slate-300 font-medium">Extracting core requirements, X-Ray searches & interview kit...</p>
              </div>
            ) : jdAnalysisData ? (
              <div className="space-y-5 text-xs">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-2">
                  <h4 className="font-bold text-indigo-300 uppercase tracking-wider text-[11px]">Role Summary</h4>
                  <p className="text-slate-200 leading-relaxed">{jdAnalysisData.role_summary}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-emerald-950/30 rounded-2xl border border-emerald-500/30 space-y-2">
                    <h4 className="font-bold text-emerald-300 uppercase tracking-wider text-[11px]">Must-Have Skills</h4>
                    <ul className="space-y-1">
                      {jdAnalysisData.must_have_skills?.map((s: string) => (
                        <li key={s} className="text-slate-200 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 bg-indigo-950/30 rounded-2xl border border-indigo-500/30 space-y-2">
                    <h4 className="font-bold text-indigo-300 uppercase tracking-wider text-[11px]">Good-To-Have Skills</h4>
                    <ul className="space-y-1">
                      {jdAnalysisData.good_to_have_skills?.map((s: string) => (
                        <li key={s} className="text-slate-200 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" /> <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* LinkedIn X-Ray Strings */}
                {jdAnalysisData.linkedin_xray_searches && (
                  <div className="p-4 bg-slate-950 rounded-2xl border border-white/10 space-y-3">
                    <h4 className="font-bold text-purple-300 uppercase tracking-wider text-[11px]">LinkedIn X-Ray Boolean Strings</h4>
                    <div className="space-y-2 font-mono text-[10px]">
                      {jdAnalysisData.linkedin_xray_searches.map((str: string, i: number) => (
                        <div key={i} className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 text-slate-300 break-all select-all hover:border-purple-500/50">
                          {str}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Raw JD Text */}
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-2">
                  <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">Full Job Description</h4>
                  <MarkdownView content={selectedJobDetail.jd_text} />
                </div>
              </div>
            ) : null}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Per-req Add Candidate modal (shared with CRM) */}
      {addCandidateForJob && (
        <AddCandidateModal
          jobs={jobs}
          prefillJobId={addCandidateForJob.id}
          onClose={() => setAddCandidateForJob(null)}
          onSaved={() => {
            setAddCandidateForJob(null);
            onJobsUpdated(); // refresh candidate_count badges
          }}
        />
      )}
    </div>
  );
};

