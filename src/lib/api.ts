import { JDAnalysis, ResumeEvaluation, Session, KBDocument, ResearchSource, Job } from '../types';

export async function extractTextFromFile(file: File): Promise<{
  success: boolean;
  filename: string;
  text: string;
  charCount: number;
  warning?: string;
  error?: string;
}> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/extract-text', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        filename: file.name,
        text: '',
        charCount: 0,
        error: data.error || 'Failed to extract text from file.',
      };
    }
    return data;
  } catch (err: any) {
    return {
      success: false,
      filename: file.name,
      text: '',
      charCount: 0,
      error: err.message || 'Network error extracting file text.',
    };
  }
}

export async function getSessions(): Promise<Session[]> {
  try {
    const res = await fetch('/api/sessions');
    const data = await res.json();
    return data.sessions || [];
  } catch (err) {
    console.error('Failed to fetch sessions:', err);
    return [];
  }
}

export async function getSession(id: string): Promise<{ session: Session; evaluations: any[] } | null> {
  try {
    const res = await fetch(`/api/sessions/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch (err) {
    return null;
  }
}

export async function saveSession(session: {
  id: string;
  jd_text: string;
  jd_filename: string;
  model: string;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
    });
    const data = await res.json();
    return data.success;
  } catch (err) {
    return false;
  }
}

export async function saveEvaluation(evalData: {
  session_id: string;
  candidate_name: string;
  resume_filename: string;
  score: number;
  recommendation: string;
  raw_json: any;
  raw_markdown?: string;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/evaluations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evalData),
    });
    const data = await res.json();
    return data.success;
  } catch (err) {
    return false;
  }
}

export async function generateJD(userDescription: string, model?: string): Promise<{ success: boolean; text?: string; error?: string }> {
  try {
    const res = await fetch('/api/generate-jd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_description: userDescription, model }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to generate JD' };
  }
}

export async function reviseJD(currentJd: string, userRequest: string, model?: string): Promise<{ success: boolean; text?: string; error?: string }> {
  try {
    const res = await fetch('/api/revise-jd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_jd: currentJd, user_request: userRequest, model }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to revise JD' };
  }
}

export async function analyzeJD(jdText: string, model?: string): Promise<{ success: boolean; data?: JDAnalysis; error?: string }> {
  try {
    const res = await fetch('/api/analyze-jd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jd_text: jdText, model }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to analyze JD' };
  }
}

export async function chatJD(
  jdText: string,
  userQuery: string,
  history: Array<{ role: string; content: string }>,
  model?: string
): Promise<{ success: boolean; text?: string; error?: string }> {
  try {
    const res = await fetch('/api/chat-jd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jd_text: jdText, user_query: userQuery, history, model }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Chat request failed' };
  }
}

export async function evaluateResume(
  jdText: string,
  resumeText: string,
  resumeFilename: string,
  model?: string
): Promise<{ success: boolean; data?: ResumeEvaluation; error?: string }> {
  try {
    const res = await fetch('/api/evaluate-resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jd_text: jdText, resume_text: resumeText, resume_filename: resumeFilename, model }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Resume evaluation failed' };
  }
}

export async function agenticResearch(
  prompt: string,
  kbDocuments: KBDocument[],
  history: Array<{ role: string; content: string }>,
  model?: string
): Promise<{ success: boolean; text?: string; sources?: ResearchSource[]; searched?: boolean; error?: string }> {
  try {
    const res = await fetch('/api/agentic-research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, kb_documents: kbDocuments, history, model }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Research request failed' };
  }
}

export async function getJobs(): Promise<any[]> {
  try {
    const res = await fetch('/api/jobs');
    const data = await res.json();
    return data.jobs || [];
  } catch (err) {
    console.error('Failed to fetch jobs:', err);
    return [];
  }
}

export async function createJob(jobData: any): Promise<any> {
  try {
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jobData),
    });
    const data = await res.json();
    return data.job;
  } catch (err) {
    console.error('Failed to create job:', err);
    return null;
  }
}

export async function updateJob(jobId: string, jobData: any): Promise<any> {
  try {
    const res = await fetch(`/api/jobs/${jobId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jobData),
    });
    const data = await res.json();
    return data.job;
  } catch (err) {
    console.error('Failed to update job:', err);
    return null;
  }
}

export async function bulkDeleteJobs(ids: string[]): Promise<boolean> {
  try {
    const res = await fetch('/api/jobs/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    const data = await res.json();
    return data.success;
  } catch (err) {
    console.error('Failed to bulk delete jobs:', err);
    return false;
  }
}

export async function bulkUpdateJobs(ids: string[], updates: any): Promise<boolean> {
  try {
    const res = await fetch('/api/jobs/bulk-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, updates }),
    });
    const data = await res.json();
    return data.success;
  } catch (err) {
    console.error('Failed to bulk update jobs:', err);
    return false;
  }
}

export async function getCandidates(jobId?: string, stage?: string): Promise<any[]> {
  try {
    const params = new URLSearchParams();
    if (jobId) params.append('job_id', jobId);
    if (stage) params.append('stage', stage);

    const res = await fetch(`/api/candidates?${params.toString()}`);
    const data = await res.json();
    return data.candidates || [];
  } catch (err) {
    console.error('Failed to fetch candidates:', err);
    return [];
  }
}

export async function createCandidate(candidateData: any): Promise<any> {
  try {
    const res = await fetch('/api/candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(candidateData),
    });
    const data = await res.json();
    return data.candidate;
  } catch (err) {
    console.error('Failed to create candidate:', err);
    return null;
  }
}

/* Save one batch-screening scorecard into the candidate pool (human-in-the-loop) */
export async function saveEvaluationAsCandidate(
  evaluation: any,
  jobId: string,
  stage?: string
): Promise<any> {
  try {
    const res = await fetch('/api/candidates/from-evaluation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evaluation, job_id: jobId, stage }),
    });
    const data = await res.json();
    if (!data || data.success === false) {
      return { ok: false, error: data.error || 'Server rejected the scorecard.' };
    }
    return { ok: true, candidate: data.candidate };
  } catch (err) {
    console.error('Failed to save evaluation as candidate:', err);
    return { ok: false, error: 'Network error while saving to candidate pool.' };
  }
}

export async function updateCandidateStage(id: string, stage: string, note?: string): Promise<any> {
  try {
    const res = await fetch(`/api/candidates/${id}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage, note }),
    });
    const data = await res.json();
    return data.candidate;
  } catch (err) {
    console.error('Failed to update stage:', err);
    return null;
  }
}

export async function addCandidateActivity(id: string, activity: { type: string; title: string; content: string; author?: string }): Promise<any> {
  try {
    const res = await fetch(`/api/candidates/${id}/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activity),
    });
    const data = await res.json();
    return data.candidate;
  } catch (err) {
    console.error('Failed to add candidate activity:', err);
    return null;
  }
}

export async function patchCandidate(id: string, updates: Record<string, any>): Promise<any> {
  try {
    const res = await fetch(`/api/candidates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    return data.candidate || null;
  } catch (err) {
    console.error('Failed to update candidate:', err);
    return null;
  }
}

export interface ResumeDraft {
  name: string;
  email: string;
  phone: string;
  current_title: string;
  current_company: string;
  experience_years: number;
  location: string;
  expected_salary: string;
  notice_period: string;
  skills: string[];
  linkedin_url: string;
  github_url: string;
  resume_filename: string;
  resume_text: string;
  ai_score: number;
  stage: string;
  job_id: string;
  job_title: string;
  source: string;
  match_reason?: string;
  key_strengths?: string[];
  key_weaknesses?: string[];
  red_flags?: string[];
  created_at: string;
  last_contacted?: string;
  activities?: any[];
}

export async function parseResumeDraft(file: File, jobId?: string, model?: string): Promise<{ success: boolean; draft?: ResumeDraft; error?: string; raw?: any }> {
  const formData = new FormData();
  formData.append('file', file);
  if (jobId) formData.append('job_id', jobId);
  if (model) formData.append('model', model);

  try {
    const res = await fetch('/api/candidates/parse-and-extract', { method: 'POST', body: formData });
    const data = await res.json();
    return { ...data, draft: data.draft || null, raw: data.parsed || null };
  } catch (err: any) {
    return { success: false, draft: undefined, error: err.message || 'Failed to parse resume.' };
  }
}

export interface BulkParseItem { filename: string; success: boolean; draft?: ResumeDraft; raw?: any; error?: string; }

export async function parseResumesBulk(files: File[], jobId?: string, model?: string): Promise<{ success: boolean; results?: BulkParseItem[]; error?: string }> {
  if (!files || files.length === 0) return { success: false, error: 'No resume files selected.' };
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  if (jobId) formData.append('job_id', jobId);
  if (model) formData.append('model', model);

  try {
    // No client-side timeout: N sequential AI passes on a local model can take minutes.
    const res = await fetch('/api/candidates/parse-resumes', { method: 'POST', body: formData });
    const data = await res.json();
    if (!data.success) return { success: false, error: data.error || 'Failed to parse resume batch.' };
    const results = (data.results || []).map((x: any) => ({
      filename: x.filename,
      success: !!x.success,
      draft: x.draft || undefined,
      raw: x.parsed || undefined,
      error: x.error || undefined,
    }));
    return { success: true, results };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to parse resume batch.' };
  }
}

export async function aiCandidateSearch(searchQuery: string, model?: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch('/api/candidates/ai-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ search_query: searchQuery, model }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'AI Candidate Search failed.' };
  }
}

export async function aiMatchCandidates(jobId: string, model?: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch('/api/candidates/ai-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: jobId, model }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'AI Match failed.' };
  }
}

export async function generateInterviewKit(candidateId: string, jobId?: string, model?: string): Promise<{ success: boolean; kit?: any; error?: string }> {
  try {
    const res = await fetch('/api/interview/generate-kit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidate_id: candidateId, job_id: jobId, model }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to generate interview kit.' };
  }
}

export async function generateOutreachSequence(candidateId: string, jobId?: string, tone?: string, model?: string): Promise<{ success: boolean; sequence?: any; error?: string }> {
  try {
    const res = await fetch('/api/outreach/generate-sequence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidate_id: candidateId, job_id: jobId, tone, model }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to generate outreach sequence.' };
  }
}

export async function parseJDFromAttachment(file: File, model?: string): Promise<{
  success: boolean;
  title?: string;
  skills?: string[];
  jd_text?: string;
  filename?: string;
  error?: string;
}> {
  const formData = new FormData();
  formData.append('file', file);
  if (model) formData.append('model', model);

  try {
    const res = await fetch('/api/jd/parse-attachment', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text();
      let detail = text.slice(0, 200);
      try {
        const json = JSON.parse(text);
        detail = json.error || detail;
      } catch {}
      return { success: false, error: detail || `Server error (${res.status})` };
    }

    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to parse JD attachment.' };
  }
}

export async function advancedChat(
  prompt: string,
  history: Array<{ role: string; content: string }>,
  model?: string,
  webSearch?: boolean,
  attachedFile?: { name: string; content: string }
): Promise<{ success: boolean; text?: string; sources?: ResearchSource[]; searched?: boolean; error?: string }> {
  try {
    const res = await fetch('/api/copilot/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, history, model, web_search: webSearch, attached_file_name: attachedFile?.name, attached_file_content: attachedFile?.content }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Chat request failed.' };
  }
}
