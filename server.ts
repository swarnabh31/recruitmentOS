import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.DEFAULT_OLLAMA_MODEL || '';

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const DB_FILE = path.join(DATA_DIR, 'db.json');

interface DbSchema {
  sessions: Array<{
    id: string;
    created_at: string;
    jd_text: string;
    jd_filename: string;
    model: string;
  }>;
  evaluations: Array<{
    id: string;
    session_id: string;
    candidate_name: string;
    resume_filename: string;
    overall_score: number;
    recommendation: string;
    raw_json: string;
    raw_markdown: string;
    created_at: string;
  }>;
  jobs: Array<any>;
  candidates: Array<any>;
  interview_kits: Array<any>;
  outreach_sequences: Array<any>;
}

function loadDb(): DbSchema {
  if (!fs.existsSync(DB_FILE)) {
    const initialDb: DbSchema = {
      sessions: [],
      evaluations: [],
      jobs: [],
      candidates: [],
      interview_kits: [],
      outreach_sequences: [],
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2));
    return initialDb;
  }
  try {
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    if (!parsed.jobs) parsed.jobs = [];
    if (!parsed.candidates) parsed.candidates = [];
    if (!parsed.interview_kits) parsed.interview_kits = [];
    if (!parsed.outreach_sequences) parsed.outreach_sequences = [];
    return parsed;
  } catch (err) {
    return {
      sessions: [],
      evaluations: [],
      jobs: [],
      candidates: [],
      interview_kits: [],
      outreach_sequences: [],
    };
  }
}

function saveDb(db: DbSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (err: any) {
    // A failed persistence should never 500 the response — log and let the
    // in-memory db carry on (the next write retries; data is only lost for
    // this request if the DB file was corrupt, which is recoverable).
    console.error('saveDb: failed to write db.json —', err?.message || err);
  }
}

// ---------------------------------------------------------------------------
// OLLAMA AI CLIENT
// ---------------------------------------------------------------------------

async function callOllama(
  model: string,
  messages: Array<{ role: string; content: string }>,
  options?: { system?: string; json?: boolean; num_predict?: number; temperature?: number }
): Promise<string> {
  const body: any = {
    model,
    messages,
    stream: false,
    options: {
      num_predict: options?.num_predict ?? 4096,
      temperature: options?.temperature ?? 0.3,
    },
  };
  if (options?.system) body.system = options.system;
  if (options?.json) body.format = 'json';

  // Hard ceiling so a hung/queued local model can never block the request forever.
  // (No timeout here was the root cause of 10-file batches dying after ~1 file.)
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS) || 300000; // 5 min
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Ollama API error (${res.status}): ${errText.slice(0, 300)}`);
    }

    const data = await res.json();
    return data.message?.content || '';
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(
        `Ollama request timed out after ${Math.round(timeoutMs / 60000)} min — the local model may be busy or stuck. Try again, or select a smaller model.`
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveModel(requestedModel?: string): Promise<string> {
  if (requestedModel) return requestedModel;
  if (DEFAULT_MODEL) return DEFAULT_MODEL;
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    const data = await res.json();
    if (data.models && data.models.length > 0) {
      return data.models[0].name;
    }
  } catch {}
  throw new Error('No model specified and no Ollama models available. Select a model from the dropdown.');
}

// Tolerant JSON extraction: local 27B models occasionally wrap their JSON in
// markdown fence markers or stray text. Try direct parse first, then fall back
// to the first {...} / [ ... ] block, so a slightly-malformed reply never 500s.
function extractJson<T>(raw: string): T {
  const trimmed = (raw || '').trim();
  if (!trimmed) return {} as T;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    /* fall through */
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    try {
      return JSON.parse(fenced[1].trim()) as T;
    } catch {
      /* fall through */
    }
  }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as T;
    } catch {
      /* fall through */
    }
  }
  const firstBracket = trimmed.indexOf('[');
  const lastBracket = trimmed.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try {
      return JSON.parse(trimmed.slice(firstBracket, lastBracket + 1)) as T;
    } catch {
      /* fall through */
    }
  }
  throw new Error('The AI engine returned content that is not valid JSON. Please try again.');
}

// ---------------------------------------------------------------------------

function wrapAsData(content: string, label: string = 'DOCUMENT'): string {
  return `<<<${label}_START>>>\n${content}\n<<<${label}_END>>>`;
}

// ---------------------------------------------------------------------------
// WEB SEARCH (simple & reliable — DDG JSON API + Bing fallback)
// ---------------------------------------------------------------------------

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();
}

async function searchDdgApi(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  const results: { title: string; url: string; snippet: string }[] = [];
  try {
    const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const data = await res.json();
    if (data.AbstractText) results.push({ title: data.Heading || 'Summary', url: data.AbstractURL || '', snippet: data.AbstractText });
    if (Array.isArray(data.RelatedTopics)) {
      for (const t of data.RelatedTopics) {
        if (t.Text && t.FirstURL && results.length < 6) results.push({ title: t.Text.split(' - ')[0], url: t.FirstURL, snippet: t.Text });
        if (results.length >= 6) break;
      }
    }
  } catch { /* ignore */ }
  return results;
}

async function searchBing(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  const results: { title: string; url: string; snippet: string }[] = [];
  try {
    const html = await (await fetch(`https://www.bing.com/search?q=${encodeURIComponent(query)}&count=8`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    })).text();

    const snippets: string[] = [];
    let re = /<p[^>]*class="[^"]*b_lineclamp[^"]*"[^>]*>([\s\S]*?)<\/p>/gi;
    let m;
    while ((m = re.exec(html)) !== null) { const c = stripHtml(m[1]); if (c.length > 30) snippets.push(c); }
    if (snippets.length === 0) {
      re = /<p[^>]*class=""[^>]*>([\s\S]*?)<\/p>/gi;
      while ((m = re.exec(html)) !== null) { const c = stripHtml(m[1]); if (c.length > 30) snippets.push(c); }
    }

    const links: string[] = [];
    re = /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*><h2/gi;
    while ((m = re.exec(html)) !== null) { if (!m[1].includes('bing.com')) links.push(m[1]); }

    const n = Math.min(snippets.length, links.length, 6);
    for (let i = 0; i < n; i++) results.push({ title: '', url: links[i], snippet: snippets[i] });
  } catch { /* ignore */ }
  return results;
}

// ---------------------------------------------------------------------------
// API ENDPOINTS
// ---------------------------------------------------------------------------

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Ollama Models List
app.get('/api/ollama/models', async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    const data = await response.json();
    const models = (data.models || []).map((m: any) => m.name);
    res.json({ success: true, models });
  } catch (err: any) {
    res.json({ success: false, models: [], error: err.message || 'Cannot reach Ollama' });
  }
});

// File extraction endpoint
app.post('/api/extract-text', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }

    const file = req.file;
    const filename = file.originalname.toLowerCase();
    const buffer = file.buffer;

    let text = '';
    let warning = null;

    if (filename.endsWith('.pdf')) {
      const pdfParser = new PDFParse({ data: buffer });
      const pdfData = await pdfParser.getText();
      text = pdfData.text ? pdfData.text.trim() : '';
      await pdfParser.destroy();
      if (text.length < 50) {
        warning = 'This looks like a scanned PDF — text extraction may have limited results.';
      }
    } else if (filename.endsWith('.docx') || filename.endsWith('.doc')) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value ? result.value.trim() : '';
      if (text.length < 50) {
        warning = 'Extracted text is very short. Check if document contains images instead of text.';
      }
    } else if (filename.endsWith('.txt') || filename.endsWith('.md') || filename.endsWith('.csv') || filename.endsWith('.json') || filename.endsWith('.xml') || filename.endsWith('.yaml') || filename.endsWith('.yml') || filename.endsWith('.log') || filename.endsWith('.cfg') || filename.endsWith('.config') || filename.endsWith('.ini') || filename.endsWith('.env')) {
      text = buffer.toString('utf-8').trim();
    } else {
      return res.status(400).json({
        success: false,
        error: 'Unsupported file format. Please upload a PDF, DOCX, DOC, TXT, MD, CSV, JSON, or XML file.',
      });
    }

    res.json({
      success: true,
      filename: file.originalname,
      text,
      charCount: text.length,
      warning,
    });
  } catch (err: any) {
    console.error('Text extraction error:', err);
    res.status(500).json({
      success: false,
      error: `Failed to extract text: ${err.message || String(err)}`,
    });
  }
});

// Parse JD from attachment - extract text and auto-populate title & skills
app.post('/api/jd/parse-attachment', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }

    const file = req.file;
    const filename = file.originalname.toLowerCase();
    const buffer = file.buffer;

    let text = '';
    if (filename.endsWith('.pdf')) {
      const pdfParser = new PDFParse({ data: buffer });
      const pdfData = await pdfParser.getText();
      text = pdfData.text ? pdfData.text.trim() : '';
      await pdfParser.destroy();
    } else if (filename.endsWith('.docx') || filename.endsWith('.doc')) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value ? result.value.trim() : '';
    } else if (filename.endsWith('.md') || filename.endsWith('.markdown') || filename.endsWith('.txt')) {
      text = buffer.toString('utf-8').trim();
    } else {
      return res.status(400).json({
        success: false,
        error: 'Unsupported file format. Please upload a PDF, DOCX, DOC, or Markdown (MD) file.',
      });
    }

    if (!text || text.length < 30) {
      return res.status(400).json({ success: false, error: 'Could not extract sufficient text from document.' });
    }

    const model = await resolveModel(req.body.model);
    const prompt = `You are an expert recruitment assistant. Extract the job title and required skills from the following Job Description text.

Return ONLY valid JSON matching this exact schema:
{
  "title": "Full Job Title",
  "skills": ["Skill 1", "Skill 2", "Skill 3"]
}

Extract 5-10 most relevant required skills. If the text has a dedicated skills section, use that. Otherwise infer from responsibilities and requirements.

Job Description:
${wrapAsData(text, 'JD')}`;

    const resultText = await callOllama(model, [{ role: 'user', content: prompt }], { json: true });
    const parsed = JSON.parse(resultText || '{}');

    res.json({
      success: true,
      title: parsed.title || '',
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      jd_text: text,
      filename: file.originalname,
    });
  } catch (err: any) {
    console.error('Error parsing JD attachment:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to parse JD attachment.',
    });
  }
});

// Sessions API
app.get('/api/sessions', (req, res) => {
  const db = loadDb();
  res.json({ success: true, sessions: db.sessions });
});

app.get('/api/sessions/:id', (req, res) => {
  const db = loadDb();
  const session = db.sessions.find((s) => s.id === req.params.id);
  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }
  const evaluations = db.evaluations.filter((e) => e.session_id === req.params.id);
  res.json({ success: true, session, evaluations });
});

app.post('/api/sessions', (req, res) => {
  const { id, jd_text, jd_filename, model } = req.body;
  if (!id) {
    return res.status(400).json({ success: false, error: 'Session ID is required.' });
  }

  const db = loadDb();
  const existingIdx = db.sessions.findIndex((s) => s.id === id);
  const sessionObj = {
    id,
    created_at: new Date().toISOString(),
    jd_text: jd_text || '',
    jd_filename: jd_filename || 'Untitled',
    model: model || '',
  };

  if (existingIdx >= 0) {
    db.sessions[existingIdx] = sessionObj;
  } else {
    db.sessions.unshift(sessionObj);
  }

  saveDb(db);
  res.json({ success: true, session: sessionObj });
});

// Save Evaluation API
app.post('/api/evaluations', (req, res) => {
  const { session_id, candidate_name, resume_filename, score, recommendation, raw_json, raw_markdown } = req.body;
  const db = loadDb();

  const evalObj = {
    id: `eval_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    session_id,
    candidate_name: candidate_name || 'Unknown',
    resume_filename: resume_filename || 'Resume.pdf',
    overall_score: Number(score) || 0,
    recommendation: recommendation || 'N/A',
    raw_json: typeof raw_json === 'string' ? raw_json : JSON.stringify(raw_json),
    raw_markdown: raw_markdown || '',
    created_at: new Date().toISOString(),
  };

  db.evaluations.unshift(evalObj);
  saveDb(db);
  res.json({ success: true, evaluation: evalObj });
});

// ---------------------------------------------------------------------------
// OLLAMA AI ENDPOINTS
// ---------------------------------------------------------------------------

// Generate Job Description
app.post('/api/generate-jd', async (req, res) => {
  try {
    const { user_description, model: reqModel } = req.body;
    if (!user_description || !user_description.trim()) {
      return res.status(400).json({ success: false, error: 'User description is required.' });
    }

    const model = await resolveModel(reqModel);
    const prompt = `You are a professional HR and recruitment specialist. Generate a comprehensive, well-structured Job Description based on the user's requirements.

The job description MUST include:
1. **Job Title** — A clear, industry-standard title
2. **About the Company** — A placeholder section using "[Company Name]"
3. **Role Summary** — 2-3 sentences describing purpose
4. **Key Responsibilities** — 5-8 bullet points
5. **Required Qualifications** — Must-have skills, experience, education
6. **Preferred Qualifications** — Nice-to-have skills
7. **Soft Skills & Culture Fit** — Key traits
8. **What We Offer** — Benefits and perks placeholders
9. **Location & Work Mode** — Remote / On-site / Hybrid

User description:
${wrapAsData(user_description, 'USER_INPUT')}

Format the output in clean Markdown.`;

    const text = await callOllama(model, [{ role: 'user', content: prompt }]);
    res.json({ success: true, text });
  } catch (err: any) {
    console.error('Error generating JD:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to generate job description.' });
  }
});

// Revise / Chat Refine Job Description
app.post('/api/revise-jd', async (req, res) => {
  try {
    const { current_jd, user_request, model: reqModel } = req.body;
    if (!current_jd || !user_request) {
      return res.status(400).json({ success: false, error: 'Current JD and user request are required.' });
    }

    const model = await resolveModel(reqModel);
    const prompt = `You are an expert HR recruitment specialist. Revise the provided Job Description according to the user's revision request.

Instructions:
1. Apply the requested changes (add/remove skills, change title, tweak tone, modify requirements).
2. Return the COMPLETE updated Job Description in Markdown. Do not return partial diffs.

Current Job Description:
${wrapAsData(current_jd, 'CURRENT_JD')}

User Revision Request:
${wrapAsData(user_request, 'REVISION_REQUEST')}`;

    const text = await callOllama(model, [{ role: 'user', content: prompt }]);
    res.json({ success: true, text });
  } catch (err: any) {
    console.error('Error revising JD:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to revise job description.' });
  }
});

// Analyze Job Description
app.post('/api/analyze-jd', async (req, res) => {
  try {
    const { jd_text, model: reqModel } = req.body;
    if (!jd_text) {
      return res.status(400).json({ success: false, error: 'Job Description text is required.' });
    }

    const model = await resolveModel(reqModel);
    const prompt = `You are a recruitment analytics AI. Analyze the job description below and return ONLY valid JSON matching the exact schema.

Schema:
{
  "role_summary": "2-3 sentence overview of the role",
  "must_have_skills": ["skill1", "skill2", "skill3"],
  "good_to_have_skills": ["skill1", "skill2"],
  "experience_required": "years or level required",
  "target_company_types": ["Product Startups", "SaaS Enterprise", etc],
  "linkedin_xray_searches": [
    "site:linkedin.com/in/ (\\"Title 1\\" OR \\"Title 2\\") AND (\\"Skill 1\\" OR \\"Skill 2\\") AND \\"Skill 3\\"",
    "site:linkedin.com/in/ (\\"Title 1\\" OR \\"Title 2\\") AND (\\"Skill 1\\" OR \\"Skill 2\\")",
    "site:linkedin.com/in/ (\\"Senior Title\\") AND (\\"Core Tech\\")",
    "site:linkedin.com/in/ (\\"Title Variant\\") AND (\\"Framework\\")",
    "site:linkedin.com/in/ (\\"Lead Title\\") AND (\\"Skill Set\\")"
  ],
  "interview_questions": ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8", "Q9", "Q10"],
  "outreach_email_template": "Markdown candidate outreach email template"
}

IMPORTANT FOR linkedin_xray_searches:
- Generate EXACTLY 5 distinct search strings.
- EVERY string MUST start with "site:linkedin.com/in/ ".
- Use quoted job title OR-groups and skill OR-groups.

Job description:
${wrapAsData(jd_text, 'JD')}`;

    const text = await callOllama(model, [{ role: 'user', content: prompt }], { json: true });
    const parsed = extractJson<any>(text);
    res.json({ success: true, data: parsed });
  } catch (err: any) {
    console.error('Error analyzing JD:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to analyze job description.' });
  }
});

// Chat with JD Context
app.post('/api/chat-jd', async (req, res) => {
  try {
    const { jd_text, user_query, history, model: reqModel } = req.body;
    if (!jd_text || !user_query) {
      return res.status(400).json({ success: false, error: 'JD text and user query are required.' });
    }

    const model = await resolveModel(reqModel);
    const historyText = history && Array.isArray(history) && history.length > 0
      ? history.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n')
      : '';

    const prompt = `You are an expert AI recruiter assistant. Answer the recruiter's question accurately using the provided Job Description context.

Job Description Context:
${wrapAsData(jd_text, 'JD')}

${historyText ? `Previous Chat Context:\n${historyText}\n` : ''}
Recruiter Question: ${user_query}

Provide a clear, practical, structured response in Markdown.`;

    const text = await callOllama(model, [{ role: 'user', content: prompt }]);
    res.json({ success: true, text });
  } catch (err: any) {
    console.error('Error in Chat JD:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to generate chat response.' });
  }
});

// Evaluate Resume against JD
app.post('/api/evaluate-resume', async (req, res) => {
  try {
    const { jd_text, resume_text, resume_filename, model: reqModel } = req.body;
    if (!jd_text || !resume_text) {
      return res.status(400).json({ success: false, error: 'JD text and resume text are required.' });
    }

    const model = await resolveModel(reqModel);
    const prompt = `You are a recruitment analytics AI. Evaluate the candidate resume against the provided Job Description and return ONLY valid JSON matching the schema below.

Schema:
{
  "candidate_name": "Full Candidate Name extracted from resume",
  "overall_score": integer 0-100,
  "skills_match": {
    "must_have_present": ["skill1"],
    "must_have_missing": ["skill2"],
    "good_to_have_present": ["skill3"]
  },
  "experience_analysis": {
    "relevant_experience_years": "X years",
    "company_type_match": "High/Medium/Low match description",
    "project_complexity": "Brief project complexity assessment"
  },
  "red_flags": ["flag 1 if any, or 'None identified'"],
  "key_strengths": ["strength 1", "strength 2"],
  "key_weaknesses": ["weakness 1"],
  "recommendation": "Yes" | "No" | "Maybe",
  "recommendation_reason": "2-3 sentences explaining recommendation"
}

Job Description:
${wrapAsData(jd_text, 'JD')}

Candidate Resume (${resume_filename || 'Resume'}):
${wrapAsData(resume_text, 'RESUME')}`;

    const text = await callOllama(model, [{ role: 'user', content: prompt }], { json: true });
    const parsed = JSON.parse(text || '{}');
    if (!parsed.candidate_name || parsed.candidate_name.toLowerCase() === 'unknown') {
      parsed.candidate_name = resume_filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    }
    parsed.resume_filename = resume_filename || 'Resume.pdf';

    res.json({ success: true, data: parsed });
  } catch (err: any) {
    console.error('Error evaluating resume:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to evaluate candidate resume.' });
  }
});

// Market Research Agent
async function searchDdgHtml(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  const results: { title: string; url: string; snippet: string }[] = [];
  try {
    const html = await (await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    })).text();

    const linkRe = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    const snippetRe = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

    const links: { url: string; title: string }[] = [];
    let m;
    while ((m = linkRe.exec(html)) !== null) {
      let url = m[1];
      if (url.startsWith('//')) url = 'https:' + url;
      const title = stripHtml(m[2]).trim();
      if (title) links.push({ url, title });
    }

    const snippets: string[] = [];
    while ((m = snippetRe.exec(html)) !== null) {
      const s = stripHtml(m[1]).trim();
      if (s.length > 20) snippets.push(s);
    }

    const n = Math.min(links.length, 6);
    for (let i = 0; i < n; i++) {
      results.push({
        title: links[i]?.title || '',
        url: links[i]?.url || '',
        snippet: snippets[i] || '',
      });
    }
  } catch { /* ignore */ }
  return results;
}

async function performWebSearch(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  const queries = generateSearchQueries(query);
  const seen = new Set<string>();
  const allResults: { title: string; url: string; snippet: string }[] = [];

  for (const q of queries) {
    let batch = await searchDdgHtml(q);
    for (const r of batch) {
      const key = r.url.toLowerCase().replace(/\/$/, '');
      if (!seen.has(key) && r.url) {
        seen.add(key);
        allResults.push(r);
      }
    }
    if (allResults.length >= 12) break;
  }

  if (allResults.length === 0) {
    for (const q of queries) {
      let batch = await searchDdgApi(q);
      for (const r of batch) {
        const key = r.url.toLowerCase().replace(/\/$/, '');
        if (!seen.has(key) && r.url) {
          seen.add(key);
          allResults.push(r);
        }
      }
      if (allResults.length >= 8) break;
    }
  }

  if (allResults.length === 0) {
    for (const q of queries) {
      let batch = await searchBing(q);
      for (const r of batch) {
        const key = r.url.toLowerCase().replace(/\/$/, '');
        if (!seen.has(key) && r.url) {
          seen.add(key);
          allResults.push(r);
        }
      }
      if (allResults.length >= 8) break;
    }
  }

  return allResults.slice(0, 8);
}

function generateSearchQueries(prompt: string): string[] {
  const words = prompt.split(/\s+/).filter(w => w.length > 3);
  const nameParts: string[] = [];
  let current = '';
  for (const w of words) {
    if (/^[A-Z]/.test(w)) {
      current += (current ? ' ' : '') + w;
    } else {
      if (current) nameParts.push(current);
      current = '';
    }
  }
  if (current) nameParts.push(current);
  const companyOrTopic = nameParts.filter(p => p.split(/\s+/).length >= 2).slice(0, 2);
  const queries: string[] = [prompt];
  if (companyOrTopic.length > 0) queries.push(companyOrTopic[0] + ' market research 2025');
  if (companyOrTopic.length > 1) queries.push(companyOrTopic[1] + ' industry analysis');
  const topWords = words.filter(w => !['this','that','with','from','have','been','what','when','where','which','about','their','there','would','could','should','after','then','just','also','more','some','them','than','into','over','such','only','other','than','very','your','will','can','how','are','was','for','the','and','not','but','you','all','can','has','had'].includes(w.toLowerCase())).slice(0, 4);
  if (topWords.length >= 3) queries.push(topWords.slice(0, 3).join(' '));
  return [...new Set(queries)];
}

app.post('/api/agentic-research', async (req, res) => {
  try {
    const { prompt, kb_documents, history, model: reqModel } = req.body;
    if (!prompt) return res.status(400).json({ success: false, error: 'Prompt is required.' });

    const model = await resolveModel(reqModel);
    const today = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'long', day: 'numeric' });

    let contextStr = '';
    if (kb_documents && Array.isArray(kb_documents) && kb_documents.length > 0) {
      contextStr = '\n=== KNOWLEDGE BASE DOCUMENTS ===\n';
      kb_documents.forEach((doc: any, i: number) => {
        contextStr += `\n--- DOCUMENT ${i + 1}: ${doc.name} ---\n${doc.content.slice(0, 4000)}\n`;
      });
    }

    let historyStr = '';
    if (history && Array.isArray(history) && history.length > 0) {
      historyStr = '\n=== CONVERSATION HISTORY ===\n';
      history.slice(-6).forEach((h: any) => { historyStr += `${h.role.toUpperCase()}: ${h.content}\n\n`; });
    }

    // Web search — multiple queries
    const searchResults = await performWebSearch(prompt);
    let searchContextStr = '';
    const sources = searchResults.slice(0, 8);
    if (sources.length > 0) {
      searchContextStr = '\n=== LIVE WEB SEARCH RESULTS ===\n';
      sources.forEach((sr, i) => { searchContextStr += `[Source ${i + 1}] ${sr.title}\nURL: ${sr.url}\nSnippet: ${sr.snippet}\n\n`; });
    }

    console.log(`[Research] Model=${model} Sources=${sources.length} Prompt="${prompt.slice(0, 80)}..."`);

    const systemMsg = `You are a Senior Market Research Analyst. Today: ${today}.

You MUST produce a VERY LONG, EXTREMELY DETAILED, comprehensive research report in Markdown. Write at least 2000-4000 words covering every aspect.

You will receive web search results below, each prefixed with "[Source N]" where N is a number. You MUST use EXACTLY those "[Source N]" labels when citing — do NOT invent new sources, do NOT change the numbering. If no web results are provided, do NOT fabricate source citations at all.

For market reports, structure with ALL of these sections:
1. Executive Summary — 2-3 paragraph overview
2. Market Size & Key Metrics — specific numbers, growth rates, projections
3. Competitive Landscape — major players, market share, positioning
4. In-Depth Analysis — detailed breakdown of the subject
5. Key Trends (Current & Emerging) — 2025-2026 outlook
6. Strategic Opportunities & Risks
7. Regional/Global Perspective
8. Conclusion with Recommendations

For general research questions, provide a thorough multi-section analysis with all relevant details, data points, and insights.

Every response must be comprehensive — do NOT be brief. Write full paragraphs, not bullet-point fragments.`;

    const userMsg = `RESEARCH SUBJECT: ${prompt}
DATE: ${today}
${contextStr}${historyStr}${searchContextStr}
Provide an extremely detailed, comprehensive research response for the subject above. Minimum 2000 words. Write full paragraphs with data, analysis, and insights. Synthesize all web data into a coherent analysis. When citing web search results, use the EXACT [Source N] label shown above. Do not create any source labels that were not provided to you.`;

    const text = await callOllama(model, [{ role: 'user', content: userMsg }], { system: systemMsg, num_predict: 16384, temperature: 0.3 });

    console.log(`[Research] Ollama response length: ${(text || '').length}`);

    res.json({ success: true, text: text || '', sources, searched: sources.length > 0 });
  } catch (err: any) {
    console.error('[Research] Error:', err.message);
    res.status(500).json({ success: false, error: err.message || 'Research agent error.' });
  }
});

// ---------------------------------------------------------------------------
// RECRUITMENT OS API ENDPOINTS
// ---------------------------------------------------------------------------

// 1. JOBS ENDPOINTS
app.get('/api/jobs', (req, res) => {
  const db = loadDb();
  const candidates = db.candidates || [];
  const jobsWithCounts = db.jobs.map((j) => {
    const count = candidates.filter((c) => c.job_id === j.id).length;
    return { ...j, candidate_count: count };
  });
  res.json({ success: true, jobs: jobsWithCounts });
});

app.post('/api/jobs', (req, res) => {
  const db = loadDb();
  const newJob = {
    id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    title: req.body.title || 'Untitled Role',
    department: req.body.department || 'Engineering',
    location: req.body.location || 'Remote',
    type: req.body.type || 'Full-time',
    status: req.body.status || 'Open',
    priority: req.body.priority || 'Medium',
    hiring_manager: req.body.hiring_manager || 'Hiring Manager',
    salary_range: req.body.salary_range || 'Competitive',
    min_experience: Number(req.body.min_experience) || 0,
    max_experience: Number(req.body.max_experience) || 10,
required_skills: req.body.required_skills || [],
      jd_text: req.body.jd_text || '',
    jd_filename: req.body.jd_filename || 'Job_Description.pdf',
    created_at: new Date().toISOString(),
    candidate_count: 0,
  };
  db.jobs.unshift(newJob);
  saveDb(db);
  res.json({ success: true, job: newJob });
});

app.put('/api/jobs/:id', (req, res) => {
  const db = loadDb();
  const idx = db.jobs.findIndex((j) => j.id === req.params.id);
  if (idx < 0) return res.status(404).json({ success: false, error: 'Job not found' });

  db.jobs[idx] = { ...db.jobs[idx], ...req.body };
  saveDb(db);
  res.json({ success: true, job: db.jobs[idx] });
});

app.delete('/api/jobs/:id', (req, res) => {
  const db = loadDb();
  db.jobs = db.jobs.filter((j) => j.id !== req.params.id);
  saveDb(db);
  res.json({ success: true });
});

app.post('/api/jobs/bulk-delete', (req, res) => {
  const db = loadDb();
  const ids: string[] = req.body.ids || [];
  db.jobs = db.jobs.filter((j) => !ids.includes(j.id));
  saveDb(db);
  res.json({ success: true, deletedCount: ids.length });
});

app.post('/api/jobs/bulk-update', (req, res) => {
  const db = loadDb();
  const ids: string[] = req.body.ids || [];
  const updates = req.body.updates || {};
  ids.forEach((id) => {
    const idx = db.jobs.findIndex((j) => j.id === id);
    if (idx >= 0) {
      db.jobs[idx] = { ...db.jobs[idx], ...updates };
    }
  });
  saveDb(db);
  res.json({ success: true, updatedCount: ids.length });
});

// 2. CANDIDATES ENDPOINTS
app.get('/api/candidates', (req, res) => {
  const db = loadDb();
  let candidates = db.candidates || [];

  if (req.query.job_id) {
    candidates = candidates.filter((c) => c.job_id === req.query.job_id);
  }
  if (req.query.stage) {
    candidates = candidates.filter((c) => c.stage === req.query.stage);
  }

  res.json({ success: true, candidates });
});

app.post('/api/candidates', (req, res) => {
  const db = loadDb();
  const newCandidate = {
    id: `cand_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: req.body.name || 'New Candidate',
    email: req.body.email || '',
    phone: req.body.phone || '',
    current_title: req.body.current_title || 'Software Engineer',
    current_company: req.body.current_company || 'Tech Inc',
    experience_years: Number(req.body.experience_years) || 3,
    location: req.body.location || 'Remote',
    expected_salary: req.body.expected_salary || 'Market Rate',
    notice_period: req.body.notice_period || '30 Days',
    skills: req.body.skills || [],
    linkedin_url: req.body.linkedin_url || '',
    github_url: req.body.github_url || '',
    resume_filename: req.body.resume_filename || 'Resume.pdf',
    resume_text: req.body.resume_text || '',
    ai_score: req.body.ai_score !== undefined ? Number(req.body.ai_score) || 0 : 0,
    stage: req.body.stage || 'Applied',
    // Explicit empty job_id = "save to talent pool (no requisition)" — honor it.
    // Absent job_id (legacy callers) keeps the old first-job default.
    job_id: req.body.job_id === undefined ? (db.jobs[0]?.id || '') : (req.body.job_id || ''),
    job_title: req.body.job_id === undefined ? (db.jobs[0]?.title || '') : (req.body.job_title || ''),
    source: req.body.source || 'Recruiter Added',
    match_reason: req.body.match_reason || 'Evaluated against role skills',
    key_strengths: req.body.key_strengths || ['Strong technical skills'],
    key_weaknesses: req.body.key_weaknesses || [],
    red_flags: req.body.red_flags || ['None'],
    created_at: new Date().toISOString(),
    last_contacted: new Date().toISOString(),
    activities: [
      {
        id: `act_${Date.now()}`,
        candidate_id: `cand_${Date.now()}`,
        type: 'note',
        author: 'System',
        title: 'Candidate Profile Created',
        content: 'Candidate added to Recruitment OS database.',
        timestamp: new Date().toISOString(),
      },
    ],
  };

  db.candidates.unshift(newCandidate);
  saveDb(db);
  res.json({ success: true, candidate: newCandidate });
  });

  // SAVE A BATCH-SCREENING EVALUATION INTO THE CANDIDATE POOL
  // One scorecard from /api/evaluate-resume → one real candidate record,
  // carrying the AI score, skill analysis, and a logged activity entry.
  app.post('/api/candidates/from-evaluation', (req, res) => {
  const db = loadDb();
  const { evaluation, job_id, stage, skills } = req.body || {};
  if (!evaluation || typeof evaluation !== 'object') {
    return res.status(400).json({ success: false, error: 'evaluation object is required.' });
  }

  const job = job_id ? db.jobs.find((j) => j.id === job_id) : undefined;
  const rec = (evaluation.recommendation || '').toString();
  const score = Number(evaluation.overall_score) || 0;
  const recLower = rec.toLowerCase();
  // Recommendation → default intake stage (recruiter can still override via `stage`)
  const defaultStage = recLower === 'yes' ? 'Shortlisted' : recLower === 'no' ? 'Rejected' : 'Screening';

  const sm = evaluation.skills_match || {};
  const now = new Date().toISOString();

  const newCandidate = {
    id: `cand_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: evaluation.candidate_name || 'Screened Candidate',
    email: evaluation.email || '',
    phone: evaluation.phone || '',
    current_title: evaluation.current_title || '—',
    current_company: evaluation.current_company || '—',
    experience_years: Number(evaluation.experience_years) || 0,
    location: evaluation.location || '',
    expected_salary: evaluation.expected_salary || '',
    notice_period: evaluation.notice_period || '',
    skills: Array.isArray(skills) && skills.length ? skills : Array.isArray(sm.must_have_present) ? sm.must_have_present : [],
    linkedin_url: evaluation.linkedin_url || '',
    github_url: evaluation.github_url || '',
    resume_filename: evaluation.resume_filename || 'Resume.pdf',
    resume_text: evaluation.resume_text || '',
    ai_score: score,
    stage: stage || defaultStage,
    job_id: job_id || '',
    job_title: job ? job.title : (evaluation.job_title || ''),
    source: 'Batch Screening (AI Scorecard)',
    match_reason: evaluation.recommendation_reason || `Scored ${score}/100 — recommendation: ${rec || 'N/A'}.`,
    key_strengths: evaluation.key_strengths || [],
    key_weaknesses: evaluation.key_weaknesses || [],
    red_flags: evaluation.red_flags && evaluation.red_flags.length ? evaluation.red_flags : ['None'],
    created_at: now,
    last_contacted: now,
    activities: [
      {
        id: `act_${Date.now()}`,
        candidate_id: '',
        type: 'ai_eval',
        author: 'Batch Screening Engine',
        title: `Screened — ${score}/100 (${rec || 'N/A'})`,
        content: evaluation.recommendation_reason || 'Imported from a batch screening scorecard.',
        timestamp: now,
      },
      {
        id: `act_${Date.now()}_2`,
        candidate_id: '',
        type: 'note',
        author: 'System',
        title: 'Candidate Profile Created',
        content: 'Imported from Batch Screening results into the candidate pool.',
        timestamp: now,
      },
    ],
  };

  db.candidates.unshift(newCandidate);
  saveDb(db);
  res.json({ success: true, candidate: newCandidate });
  });

  // EDIT CANDIDATE PROFILE — any field (details, skills, req, stage, notes)
  app.patch('/api/candidates/:id', (req, res) => {
  const db = loadDb();
  const candidate = db.candidates.find((c) => c.id === req.params.id);
  if (!candidate) return res.status(404).json({ success: false, error: 'Candidate not found' });

  const EDITABLE: Array<[string, boolean]> = [
  ['name', false], ['email', false], ['phone', false],
  ['current_title', false], ['current_company', false],
  ['experience_years', true], ['location', false],
  ['expected_salary', false], ['notice_period', false],
  ['skills', false], ['linkedin_url', false], ['github_url', false],
  ['stage', false], ['job_id', false], ['job_title', false],
  ['source', false], ['ai_score', true],
  ['match_reason', false], ['key_strengths', false],
  ['key_weaknesses', false], ['red_flags', false],
  ];

  const changes: string[] = [];
  for (const [key, isNumeric] of EDITABLE) {
  if (req.body[key] === undefined) continue;
  const next = isNumeric ? Number(req.body[key]) || 0 : req.body[key];
  if (JSON.stringify(candidate[key]) !== JSON.stringify(next)) {
    const oldVal = JSON.stringify(candidate[key]) === '[]' ? '' : JSON.stringify(candidate[key]);
    const newVal = isNumeric ? String(next) : JSON.stringify(next);
    if (JSON.stringify(candidate[key]) !== JSON.stringify(next)) {
      changes.push(`${key.replace(/_/g, ' ')}: ${truncateLabel(candidate[key])} → ${truncateLabel(next)}`);
    }
    candidate[key] = next;
  }
  }

  if (changes.length === 0) {
  return res.json({ success: true, candidate, changed: false });
  }

  candidate.last_contacted = new Date().toISOString();
  if (!candidate.activities) candidate.activities = [];
  candidate.activities.unshift({
  id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  candidate_id: candidate.id,
  type: 'note',
  author: 'Recruiter',
  title: 'Profile updated manually',
  content: `Edited fields → ${changes.join('; ')}.`,
  timestamp: new Date().toISOString(),
  });

  saveDb(db);
  res.json({ success: true, candidate, changed: true });
  });

  function truncateLabel(value: any): string {
  const s = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  return s && s.length > 40 ? s.slice(0, 37) + '…' : s;
  }

  app.patch('/api/candidates/:id/stage', (req, res) => {
  const db = loadDb();
  const { stage, note } = req.body;
  const candidate = db.candidates.find((c) => c.id === req.params.id);
  if (!candidate) return res.status(404).json({ success: false, error: 'Candidate not found' });

  const oldStage = candidate.stage;
  candidate.stage = stage;
  candidate.last_contacted = new Date().toISOString();

  if (!candidate.activities) candidate.activities = [];
  candidate.activities.unshift({
    id: `act_${Date.now()}`,
    candidate_id: candidate.id,
    type: 'stage_change',
    author: 'Recruiter',
    title: `Stage updated to ${stage}`,
    content: note || `Moved candidate from ${oldStage} to ${stage}.`,
    timestamp: new Date().toISOString(),
  });

  saveDb(db);
  res.json({ success: true, candidate });
});

app.post('/api/candidates/:id/activity', (req, res) => {
  const db = loadDb();
  const candidate = db.candidates.find((c) => c.id === req.params.id);
  if (!candidate) return res.status(404).json({ success: false, error: 'Candidate not found' });

  if (!candidate.activities) candidate.activities = [];
  const activity = {
    id: `act_${Date.now()}`,
    candidate_id: candidate.id,
    type: req.body.type || 'note',
    author: req.body.author || 'Recruiter',
    title: req.body.title || 'Note added',
    content: req.body.content || '',
    timestamp: new Date().toISOString(),
  };
  candidate.activities.unshift(activity);
  candidate.last_contacted = new Date().toISOString();

  saveDb(db);
  res.json({ success: true, activity, candidate });
});

app.delete('/api/candidates/:id', (req, res) => {
  const db = loadDb();
  db.candidates = db.candidates.filter((c) => c.id !== req.params.id);
  saveDb(db);
  res.json({ success: true });
});

// 3. PARSE RESUME FILE INTO CANDIDATE PROFILE WITH OLLAMA
//    If a requisition is selected, also runs a real AI match pass so the
//    stored ai_score reflects THIS JD (previously hardcoded 88 for everyone).
async function parseOneResumeFile(file: any, job: any, jobId: string, model: string): Promise<{ draft: any; parsed: any }> {
  const filename = file.originalname;
  let resumeText = '';

  if (filename.toLowerCase().endsWith('.pdf')) {
    const pdfParser = new PDFParse({ data: file.buffer });
    const pdfData = await pdfParser.getText();
    resumeText = pdfData.text || '';
    await pdfParser.destroy();
  } else if (filename.toLowerCase().endsWith('.docx') || filename.toLowerCase().endsWith('.doc')) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    resumeText = result.value || '';
  } else {
    resumeText = file.buffer.toString('utf-8');
  }

  // Normalize non-breaking spaces (common in PDFs) without destroying real line breaks.
  if (resumeText) resumeText = resumeText.replace(/\u00a0/g, ' ').trim();

  if (!resumeText || resumeText.length < 30) {
    throw Object.assign(new Error('Could not extract sufficient text from resume document (file may be scanned/image-only).'), { statusCode: 400 });
  }

  const prompt = `You are a specialized AI Resume Extraction Engine. Extract structured candidate information from the resume document below and return ONLY valid JSON matching the schema.

Schema:
{
  "name": "Candidate Full Name",
  "email": "email or placeholder@example.com",
  "phone": "phone or empty",
  "current_title": "Current or recent Job Title",
  "current_company": "Current or recent Company",
  "experience_years": integer,
  "location": "City, Country or Remote",
  "expected_salary": "e.g. ₹25,00,000 or Market Rate",
  "notice_period": "e.g. 15 Days or 30 Days",
  "skills": ["skill1", "skill2", "skill3", "skill4", "skill5", "skill6"],
  "linkedin_url": "URL or empty",
  "github_url": "URL or empty",
  "key_strengths": ["strength 1", "strength 2"],
  "key_weaknesses": ["area for growth 1"],
  "summary_bio": "2 sentence executive bio"
}

Resume Content:
${wrapAsData(resumeText, 'RESUME')}`;

    const text = await callOllama(model, [{ role: 'user', content: prompt }], { json: true });
    const parsed = JSON.parse(text || '{}');

    // ---- Real AI match vs the selected requisition (was: hardcoded 88 for everyone) ----
    let ai_score = 0;
    let match_reason = parsed.summary_bio || 'Extracted via AI Resume Intelligence Engine.';
    const jobJdText = (job?.jd_text || '').trim();

    // Deterministic skill-overlap floor so the score is never a blind guess.
    const skillHit = (() => {
      const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9+#. ]/g, '');
      const cand = new Set((parsed.skills || []).map(norm).filter(Boolean));
      const req = new Set((job?.required_skills || []).map(norm).filter(Boolean));
      if (req.size === 0 || cand.size === 0) return null;
      let hit = 0;
      req.forEach((r: string) => { if (cand.has(r)) hit++; });
      return Math.round((hit / req.size) * 100);
    })();

    if (job && jobJdText) {
      const scorePrompt = `You are a recruitment analytics AI. Score how well this candidate resume matches the Job Description. Return ONLY valid JSON:
{
  "ai_score": integer 0-100,
  "match_reason": "1-2 sentence explanation of the fit",
  "match_strengths": ["top 3 reasons"],
  "match_gaps": ["top 2 gaps, or 'None'"]
}

Job Description:
${wrapAsData(jobJdText, 'JD')}

Candidate Resume (${filename}):
${wrapAsData(resumeText.slice(0, 24000), 'RESUME')}`;

      try {
        const st = await callOllama(model, [{ role: 'user', content: scorePrompt }], { json: true });
        const sc = JSON.parse(st || '{}');
        const proposed = Math.max(0, Math.min(100, Number(sc.ai_score) || 0));
        // Anchor the LLM score to the measured skill overlap (keep human-verifiable).
        ai_score = skillHit !== null ? Math.round((proposed + skillHit) / 2) : proposed;
        if (sc.match_reason) match_reason = sc.match_reason;
        (parsed as any).match_strengths = sc.match_strengths || [];
        (parsed as any).match_gaps = sc.match_gaps || [];
      } catch {
        // AI scoring failed — fall back to the deterministic overlap, never a fake 88.
        ai_score = skillHit ?? 0;
        match_reason = skillHit !== null
          ? `Skill overlap ${skillHit}% against ${job.title} (AI scoring unavailable).`
          : 'AI scoring unavailable — run batch screening for a scored scorecard.';
      }
    }

    const now = new Date().toISOString();
    const draft = {
      name: parsed.name || '',
      email: parsed.email || '',
      phone: parsed.phone || '',
      current_title: parsed.current_title || '',
      current_company: parsed.current_company || '',
      experience_years: parsed.experience_years || 0,
      location: parsed.location || '',
      expected_salary: parsed.expected_salary || '',
      notice_period: parsed.notice_period || '',
      skills: parsed.skills || [],
      linkedin_url: parsed.linkedin_url || '',
      github_url: parsed.github_url || '',
      resume_filename: filename,
      resume_text: resumeText,
      ai_score,
      ai_scored: Boolean(job && jobJdText),
      stage: 'Applied',
      job_id: jobId || (job ? job.id : ''),
      job_title: job ? job.title : '',
      source: 'Resume Intelligence Parser',
      match_reason,
      key_strengths: parsed.key_strengths || [],
      key_weaknesses: parsed.key_weaknesses || [],
      red_flags: [],
      created_at: now,
      last_contacted: now,
      activities: [
        {
          id: `act_${Date.now()}`,
          candidate_id: '',
          type: 'ai_eval',
          author: 'Resume Intelligence Engine',
          title: job ? 'Structured Resume Parsed & AI-Matched' : 'Structured Resume Parsed',
          content: match_reason,
          timestamp: now,
        },
      ],
    };

    return { draft, parsed };
}

// Single resume → draft (used by the Add Candidate modal's Upload tab)
app.post('/api/candidates/parse-and-extract', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }

    const model = await resolveModel(req.body.model);
    const jobId = req.body.job_id || '';
    const job = jobId ? loadDb().jobs.find((j) => j.id === jobId) || null : null;

    const { draft, parsed } = await parseOneResumeFile(req.file, job, jobId, model);
    res.json({ success: true, draft, parsed });
  } catch (err: any) {
    console.error('Error parsing candidate resume:', err);
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, error: err.message || 'Failed to parse resume.' });
  }
});

// BULK: N resumes → N drafts (one AI parse + one AI match pass per file)
app.post('/api/candidates/parse-resumes', upload.array('files', 20), async (req, res) => {
  try {
    const files = (req.files as any[]) || [];
    if (files.length === 0) {
      return res.status(400).json({ success: false, error: 'No resume files uploaded.' });
    }

    const model = await resolveModel(req.body.model);
    const db = loadDb();
    const jobId = req.body.job_id || '';
    const job = (jobId && db.jobs.find((j) => j.id === jobId)) || null;

    // Sequential: the local Ollama model is single-stream — racing it only thrashes the queue.
    const results: Array<{ filename: string; success: boolean; draft?: any; parsed?: any; error?: string }> = [];
    for (const f of files) {
      try {
        const { draft, parsed } = await parseOneResumeFile(f, job, jobId, model);
        results.push({ filename: f.originalname, success: true, draft, parsed });
      } catch (err: any) {
        results.push({ filename: f.originalname, success: false, error: err.message || 'Failed to parse this resume.' });
      }
    }

    const ok = results.filter((r) => r.success).length;
    res.json({ success: true, results, parsed_count: ok, failed_count: results.length - ok, job_id: jobId });
  } catch (err: any) {
    console.error('Error parsing resume batch:', err);
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, error: err.message || 'Failed to parse resume batch.' });
  }
});

// 4. NATURAL LANGUAGE AI CANDIDATE SEARCH
app.post('/api/candidates/ai-search', async (req, res) => {
  try {
    const { search_query, model: reqModel } = req.body;
    if (!search_query) {
      return res.status(400).json({ success: false, error: 'Search query is required.' });
    }

    const db = loadDb();
    const candidates = db.candidates || [];
    const model = await resolveModel(reqModel);

    const prompt = `You are the AI Search Engine of Recruitment OS.
The recruiter is executing a natural language search query across the candidate database.

Search Query: "${search_query}"

Candidate Database Pool:
${JSON.stringify(
  candidates.map((c) => ({
    id: c.id,
    name: c.name,
    current_title: c.current_title,
    current_company: c.current_company,
    experience_years: c.experience_years,
    location: c.location,
    skills: c.skills,
    job_title: c.job_title,
    notice_period: c.notice_period,
    resume_summary: c.resume_text.slice(0, 300),
  })),
  null,
  2
)}

Task:
Filter and rank candidates who best match the search query requirements. Explain why each candidate matches or why they were prioritized.

Return ONLY valid JSON:
{
  "search_summary": "1-2 sentence explanation of how search filters were interpreted",
  "matched_candidate_ids": ["cand_id1", "cand_id2"],
  "results": [
    {
      "candidate_id": "cand_1",
      "relevance_score": 95,
      "reasoning": "Why candidate matches the query criteria"
    }
  ]
}`;

    const text = await callOllama(model, [{ role: 'user', content: prompt }], { json: true, num_predict: 16384 });
    const parsed = extractJson<any>(text);
    res.json({ success: true, data: parsed });
  } catch (err: any) {
    console.error('Error in AI candidate search:', err);
    res.status(500).json({ success: false, error: err.message || 'AI search failed.' });
  }
});

// 5. AI JOB & CANDIDATE MATCHING ENGINE
app.post('/api/candidates/ai-match', async (req, res) => {
  try {
    const { job_id, model: reqModel } = req.body;
    const db = loadDb();
    const job = db.jobs.find((j) => j.id === job_id) || db.jobs[0];
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });

    const candidates = db.candidates || [];
    const model = await resolveModel(reqModel);

    const prompt = `You are the AI Matching Engine of Recruitment OS.
Match and rank ALL candidates in our talent pool against the Job Description below.

Job Description (${job.title}):
Required Skills: ${job.required_skills.join(', ')}
Details: ${job.jd_text}

Candidates to Evaluate:
${JSON.stringify(
  candidates.map((c) => ({
    id: c.id,
    name: c.name,
    skills: c.skills,
    experience_years: c.experience_years,
    location: c.location,
    resume_text: c.resume_text.slice(0, 400),
  })),
  null,
  2
)}

Return ONLY valid JSON matching schema:
{
  "job_id": "${job.id}",
  "rankings": [
    {
      "candidate_id": "cand_1",
      "candidate_name": "Full Name",
      "match_score": 94,
      "must_have_satisfied": ["Skill 1", "Skill 2"],
      "missing_skills": ["Skill 3"],
      "recommendation": "Top Pick",
      "copilot_explanation": "Detailed 2 sentence explanation of why candidate is ranked here."
    }
  ]
}`;

    const text = await callOllama(model, [{ role: 'user', content: prompt }], { json: true, num_predict: 16384 });
    const parsed = extractJson<any>(text);
    res.json({ success: true, data: parsed });
  } catch (err: any) {
    console.error('Error in AI Match:', err);
    res.status(500).json({ success: false, error: err.message || 'AI Match failed.' });
  }
});

// 6. AI INTERVIEW ASSISTANT KIT GENERATOR
app.post('/api/interview/generate-kit', async (req, res) => {
  try {
    const { candidate_id, job_id, model: reqModel } = req.body;
    const db = loadDb();
    const candidate = db.candidates.find((c) => c.id === candidate_id) || db.candidates[0];
    const job = db.jobs.find((j) => j.id === (job_id || candidate?.job_id)) || db.jobs[0];
    const model = await resolveModel(reqModel);

    const prompt = `You are an AI Interview Assistant. Prepare a comprehensive interview kit for interviewing ${candidate?.name || 'the candidate'} for the role of ${job?.title || 'the role'}.

Job Skills: ${job?.required_skills.join(', ') || 'Software Development'}
Candidate Resume Snippet: ${candidate?.resume_text || 'Senior Engineer'}

Return ONLY valid JSON:
{
  "candidate_name": "${candidate?.name || 'Candidate'}",
  "job_title": "${job?.title || 'Role'}",
  "technical_questions": [
    "Q1: In-depth architectural question",
    "Q2: Practical problem solving scenario",
    "Q3: Specific framework/language question",
    "Q4: Code optimization scenario"
  ],
  "behavioral_questions": [
    "Q1: Leadership or conflict scenario",
    "Q2: Prioritization under deadline pressure"
  ],
  "red_flags_to_verify": [
    "Verify resume gap / depth in missing skills",
    "Check hands-on experience vs high-level oversight"
  ],
  "weak_areas": [
    "Candidate skills to probe deeper on"
  ],
  "deep_dive_topics": [
    "Topic 1: System Scalability",
    "Topic 2: Microservice Fault Tolerance"
  ]
}`;

    const text = await callOllama(model, [{ role: 'user', content: prompt }], { json: true, num_predict: 8192 });
    // Use the tolerant extractor (handles markdown fences / stray text that
    // JSON.parse would reject with a 500). 27B local models occasionally
    // emit a few tokens of prose around the JSON block.
    const kit = extractJson<any>(text) || {};
    kit.candidate_id = candidate?.id;
    kit.job_title = job?.title;
    kit.created_at = new Date().toISOString();

    db.interview_kits.unshift(kit);
    saveDb(db);

    res.json({ success: true, kit });
  } catch (err: any) {
    console.error('Error generating interview kit:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to generate interview kit.' });
  }
});

// 7. EMAIL & OUTREACH AUTOMATION
app.post('/api/outreach/generate-sequence', async (req, res) => {
  try {
    const { candidate_id, job_id, tone, model: reqModel } = req.body;
    const db = loadDb();
    const candidate = db.candidates.find((c) => c.id === candidate_id) || db.candidates[0];
    const job = db.jobs.find((j) => j.id === (job_id || candidate?.job_id)) || db.jobs[0];
    const model = await resolveModel(reqModel);

    const prompt = `You are an AI Talent Outreach Specialist. Draft a multi-step personalized candidate outreach campaign for ${candidate?.name || 'Candidate'} regarding the ${job?.title || 'Role'} at our company.

Tone requested: ${tone || 'Warm, professional, and compelling'}
Candidate Profile: ${candidate?.current_title} at ${candidate?.current_company}, Skills: ${candidate?.skills.join(', ')}
Role Details: ${job?.title}, Salary: ${job?.salary_range}, Location: ${job?.location}

Return ONLY valid JSON matching schema:
{
  "subject": "Compelling personalized email subject line",
  "steps": [
    {
      "step_number": 1,
      "delay_days": 0,
      "channel": "Email",
      "content": "Full personalized initial outreach message highlighting candidate accomplishments and role highlights."
    },
    {
      "step_number": 2,
      "delay_days": 3,
      "channel": "LinkedIn",
      "content": "Short gentle follow-up message on LinkedIn."
    },
    {
      "step_number": 3,
      "delay_days": 6,
      "channel": "Email",
      "content": "Final value-add check-in email with company culture or tech highlights."
    }
  ]
}`;

    const text = await callOllama(model, [{ role: 'user', content: prompt }], { json: true });
    const parsed = JSON.parse(text || '{}');
    const sequence = {
      id: `outreach_${Date.now()}`,
      candidate_id: candidate?.id,
      candidate_name: candidate?.name,
      job_title: job?.title,
      subject: parsed.subject || `Opportunity for ${job?.title}`,
      steps: parsed.steps || [],
      status: 'Draft',
      created_at: new Date().toISOString(),
    };

    db.outreach_sequences.unshift(sequence);
    saveDb(db);

    res.json({ success: true, sequence });
  } catch (err: any) {
    console.error('Error generating outreach sequence:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to generate outreach.' });
  }
});

// 8. ADVANCED CHAT BOT (context-aware recruitment assistant with web search)
// ---------------------------------------------------------------------------
// Context budget management
// ---------------------------------------------------------------------------
const MAX_USER_CHARS = 14000;    // ~3500 tokens for user message
const MAX_SYSTEM_CHARS = 2000;   // ~500 tokens for system prompt
const MAX_TOTAL_CHARS = 30000;   // ~7500 tokens total (safe for 8K models)

function roughTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
function roughTokensLen(chars: number): number {
  return Math.ceil(chars / 4);
}

function trimWithNote(text: string, budget: number, label: string): string {
  if (text.length <= budget) return text;
  const note = `\n...[${label} trimmed to fit context budget]`;
  return text.slice(0, budget - note.length) + note;
}

// Context priority order (ascending):
//   1) candidate details, 2) file content, 3) search results,
//   4) conversation history, 5) job details, 6) user query
// When over budget, we trim from the bottom up.

app.post('/api/copilot/chat', async (req, res) => {
  try {
    const { prompt, history, model: reqModel, web_search, attached_file_name, attached_file_content } = req.body;
    if (!prompt && !attached_file_content) return res.status(400).json({ success: false, error: 'Prompt or file is required.' });

    const db = loadDb();
    const model = await resolveModel(reqModel);
    const today = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'long', day: 'numeric' });

    const jobs = db.jobs || [];
    const candidates = db.candidates || [];
    let contextTruncated = false;

    // ---- 1. Build job requisitions context ----
    let jobStr = '=== CURRENT REQUISITIONS ===\n';
    if (jobs.length === 0) {
      jobStr += 'No requisitions in the system.\n';
    } else {
      for (const j of jobs) {
        const jobCandidates = candidates.filter((c: any) => c.job_id === j.id);
        const stageDist: Record<string, number> = {};
        jobCandidates.forEach((c: any) => { stageDist[c.stage] = (stageDist[c.stage] || 0) + 1; });
        const stageSummary = Object.entries(stageDist).map(([s, n]) => `${s}: ${n}`).join(', ');

        jobStr += `\n[${j.id}] ${j.title}\n`;
        jobStr += `  Status: ${j.status} | Priority: ${j.priority} | Dept: ${j.department} | Loc: ${j.location}\n`;
        jobStr += `  Skills: ${(j.required_skills || []).join(', ')}\n`;
        jobStr += `  Candidates: ${jobCandidates.length}${stageSummary ? ` (${stageSummary})` : ''}\n`;
      }
    }

    // ---- 2. Build candidate pool context ----
    let candidateStr = '\n=== CANDIDATE POOL ===\n';
    if (candidates.length === 0) {
      candidateStr += 'No candidates in the system.\n';
    } else {
      candidateStr += `Total: ${candidates.length}\n`;
      // Budget for candidate lines: ~3000 chars
      const CANDIDATE_BUDGET = 3000;
      let candLines = 0;
      for (const c of candidates) {
        const line = `- ${c.name} | ${c.current_title} @ ${c.current_company} | Skills: ${(c.skills || []).join(', ')} | Stage: ${c.stage} | Role: ${c.job_title} | Score: ${c.ai_score}%\n`;
        if (candidateStr.length + line.length > CANDIDATE_BUDGET) {
          const remaining = candidates.length - candLines;
          candidateStr += `...and ${remaining} more candidates (truncated for context budget)\n`;
          contextTruncated = true;
          break;
        }
        candidateStr += line;
        candLines++;
      }
    }
    const contextStr = jobStr + candidateStr;

    // ---- 3. Attached file (hard cap at 8000 chars) ----
    let fileStr = '';
    if (attached_file_name && attached_file_content) {
      const maxFileChars = 8000;
      const content = attached_file_content.length > maxFileChars
        ? attached_file_content.slice(0, maxFileChars) + '\n...[file truncated to fit context budget]'
        : attached_file_content;
      fileStr = `\n=== ATTACHED FILE: ${attached_file_name} ===\n${content}\n=== END OF FILE ===\n`;
    }

    // ---- 4. Conversation history (keep last 6 exchanges, cap total) ----
    let historyStr = '';
    if (history && Array.isArray(history) && history.length > 0) {
      const rawHistory = history.slice(-6).map((h: any) => `${h.role.toUpperCase()}: ${h.content}`).join('\n');
      historyStr = '\n=== CONVERSATION HISTORY ===\n' + trimWithNote(rawHistory, 4000, 'conversation history') + '\n';
    }

    // ---- 5. Web search results ----
    let sources: { title: string; url: string; snippet: string }[] = [];
    let searchContextStr = '';
    if (web_search) {
      sources = await performWebSearch(prompt);
      if (sources.length > 0) {
        searchContextStr = '\n=== LIVE WEB SEARCH RESULTS ===\n';
        for (let i = 0; i < sources.length; i++) {
          const sr = sources[i];
          const entry = `[Source ${i + 1}] ${sr.title}\nURL: ${sr.url}\nSnippet: ${sr.snippet}\n\n`;
          if (searchContextStr.length + entry.length > 4000) {
            searchContextStr += `...[${sources.length - i} more results truncated]\n`;
            contextTruncated = true;
            break;
          }
          searchContextStr += entry;
        }
      }
    }

    // ---- 6. Assemble user message and enforce total budget ----
    let userMsg = `USER QUERY: ${prompt || '(file attached)'}
DATE: ${today}

${contextStr}
${fileStr}
${historyStr}
${searchContextStr}

Provide a helpful, accurate response based on the recruitment data above${web_search ? ' and web search results' : ''}${attached_file_content ? ' and the attached file' : ''}. Use Markdown formatting.`;

    // Enforce hard cap on user message
    if (userMsg.length > MAX_USER_CHARS) {
      // Trim lowest-priority sections first: file → candidate details → search → history → job details
      if (fileStr) {
        fileStr = '\n=== ATTACHED FILE ===\n[File content omitted — context budget exceeded]\n';
        userMsg = `USER QUERY: ${prompt || '(file attached)'}
DATE: ${today}

${contextStr}
${fileStr}
${historyStr}
${searchContextStr}

Provide a helpful, accurate response based on the recruitment data above${web_search ? ' and web search results' : ''}${attached_file_content ? ' and the attached file' : ''}. Use Markdown formatting.`;
        contextTruncated = true;
      }
    }
    if (userMsg.length > MAX_USER_CHARS) {
      // Remove candidate details, keep only summary
      const candIdx = userMsg.indexOf('=== CANDIDATE POOL ===');
      if (candIdx !== -1) {
        const beforeCand = userMsg.slice(0, candIdx);
        const afterCand = userMsg.indexOf('\n===', candIdx + 5);
        const rest = afterCand !== -1 ? userMsg.slice(afterCand) : '';
        userMsg = beforeCand + `=== CANDIDATE POOL ===\n${candidates.length} total candidates (details omitted — context budget exceeded)\n` + rest;
        contextTruncated = true;
      }
    }
    if (userMsg.length > MAX_USER_CHARS) {
      // Aggressively trim: keep only job summaries, no candidates, minimal history
      userMsg = trimWithNote(userMsg, MAX_USER_CHARS, 'full context');
      contextTruncated = true;
    }

    // ---- 7. System message ----
    const systemMsg = `You are the Recruitment OS Advanced Chat Bot — an expert recruitment assistant with complete awareness of all active requisitions, candidates, and hiring data. Today: ${today}.

Your role:
- Answer questions about any requisition, candidate, or pipeline metric using the context below
- Provide actionable recruitment advice (sourcing, screening, outreach, interview strategy)
- Analyze hiring bottlenecks, stage distribution, and team performance
- When a file is attached (marked with === ATTACHED FILE ===), analyze its contents thoroughly. It could be a resume, JD, or any document. Compare it against open requisitions if asked.
- When web search results are provided (prefixed with [Source N]), use them to answer market research, company data, talent trends, or any external information. Cite sources using EXACTLY the [Source N] labels provided.
- Be concise but thorough. Use Markdown for structured responses.
- If some context sections say "truncated" or "omitted", that means the database had more data than could fit. Do NOT fabricate details — clearly state when you lack the full picture.`;
    // (systemMsg is not counted in our user-budget; Ollama handles them separately)

    // ---- 8. Call Ollama ----
    const totalChars = systemMsg.length + userMsg.length;
    console.log(`[ChatBot] model=${model} input=${roughTokens(userMsg)}tok(+sys=${roughTokens(systemMsg)}tok) total=${roughTokensLen(totalChars)}tok${contextTruncated ? ' [TRUNCATED]' : ''}`);

    const text = await callOllama(model, [{ role: 'user', content: userMsg }], { system: systemMsg, temperature: 0.3 });

    res.json({
      success: true,
      text: text || '',
      sources: web_search ? sources : undefined,
      searched: web_search && sources.length > 0,
    });
  } catch (err: any) {
    console.error('Error in Advanced Chat:', err);
    // If the error is context-length related, return a graceful fallback
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('context') || msg.includes('token') || msg.includes('length')) {
      return res.json({
        success: true,
        text: '⚠️ The conversation has grown too long for the current model\'s context window. I\'ve retained the most recent information. Please start a **new chat session** to continue with a fresh context, or ask a more specific question that needs less background.',
      });
    }
    res.status(500).json({ success: false, error: err.message || 'Chat error.' });
  }
});

// Vite Middleware for Development / Static serving for production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        // Ignore the data/ dir (where saveDb() writes db.json). A write there
        // previously triggered a full Vite page reload mid-request, which
        // unmounted the React tree and any in-flight fetches (silent
        // "no output" on Interview Assistant, Outreach, AI Search, etc.).
        watch: { ignored: ['**/data/**'] },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
