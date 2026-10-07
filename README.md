# Recruitment OS — AI-Native Talent Intelligence Platform

**Recruitment OS** is a local-first, AI-native recruitment operating system. It turns job-description screening into an end-to-end hiring platform — requisition management, a permanent candidate CRM, a visual Kanban pipeline, grounded market research, AI interview kits, and outreach automation — running entirely on **local LLMs through Ollama**, with **zero cloud dependencies** and no API keys.

---

## 🧠 How the AI works

Every AI capability is served by a locally running **Ollama** instance. The app talks to Ollama's `/api/chat` endpoint, so you can plug in *any* model Ollama has (`qwen3.8:27b`, `llama3`, `mistral`, …). Available models are listed at runtime and you pick one from the UI — no provider key, no per-token billing, and candidate data never leaves your machine.

| Concern | Default | Set with |
|---|---|---|
| Ollama endpoint | `http://localhost:11434` | `OLLAMA_BASE_URL` |
| Default model | first model Ollama reports | `DEFAULT_OLLAMA_MODEL` |
| LLM call timeout | `300000` ms (5 min) | `OLLAMA_TIMEOUT_MS` |
| App port | `3000` | `PORT` |

---

## 🌟 Features & Modules

- **📊 Executive Dashboard** — Live KPIs (active requisitions, candidate pool size, average resume score, time-to-interview velocity), an interactive requisition list, stage breakdown, and highlighted AI top picks.
- **💼 JD Studio** — Draft full job descriptions from a one-line prompt, then iterate via chat (`generate` / `revise` / `analyze`). Deep requirement analysis breaks out must-have vs. good-to-have skills and generates **LinkedIn X-Ray Boolean searches**.
- **📥 Batch Screening** — Score a batch of resumes against a JD with an AI scorecard, then import the accepted ones straight into the candidate pool at the right stage.
- **👥 Candidate CRM** — A permanent talent pool with persistent state: upload PDF/DOCX resumes for structured extraction (skills, experience, contact, expected salary, notice period), and keep a per-candidate activity feed for calls, emails, and feedback.
- **🗂️ Pipeline Board** — Drag-and-drop / one-click stage movement across `Applied → Screening → Shortlisted → Technical Interview → HR Round → Offer Extended → Hired → Rejected`, filterable per requisition.
- **🔍 Natural-Language Search & Copilot Ranker** — Ask in plain English (*“Find Python devs, 5+ yrs, K8s, Hyderabad, 2-week notice”*). The ranker scores the whole pool against a specific requisition with match explanations, satisfied must-haves, and skill gaps.
- **🎙️ Interview Assistant** — Candidate-specific interview kits: targeted technical deep-dives, behavioral scenarios, and red-flag verification checks derived from resume gaps.
- **📧 Outreach & Email** — Personalized multi-step outreach copy with selectable tones (*Warm & Compelling*, *Direct Engineering-First*, *Executive Leadership*) and one-click copy.
- **🌐 Market Research** — Grounded research that gathers live web sources (DuckDuckGo → Bing fallback) and compiles compensation benchmarks, availability, competitor talent mapping, and tech-stack trends with cited sources.
- **📈 Analytics** — Pipeline conversion, sourcing-channel ROI, and screening-velocity reporting.
- **🤖 Multi-Agent Recruiter Copilot** — An always-available drawer with specialized agent personas (Orchestrator, Matcher, Sourcing, Interview, Outreach, JD Architect) that reason over your recruitment data and, when enabled, live web search.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v18+ (v20+ recommended) and **npm** v9+
- **Ollama** running locally with at least one model pulled:
  ```bash
  ollama pull qwen3.8:27b   # or any model you prefer
  # confirm it's up:  ollama list
  ```

> No API key is required. If Ollama isn't running, AI features degrade gracefully with a clear message.

### Run
```bash
npm install
npm run dev          # dev server at http://localhost:3000
```

### Production build
```bash
npm run build        # Vite (client) + esbuild (server) → dist/
npm start            # node dist/server.cjs
npm run lint         # tsc --noEmit
```

---

## 🛠️ Tech Stack & Architecture

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Vite 6, `motion`, `lucide-react`, `react-markdown` + `remark-gfm`.
- **Backend:** Node.js + Express (single `server.ts`), esbuild bundle for production.
- **LLM:** local **Ollama** via `fetch` to `/api/chat` — provider-agnostic, any model.
- **Parsing:** `pdf-parse` (PDF), `mammoth` (DOCX), `multer` for uploads.
- **Grounding:** live web search (DuckDuckGo HTML endpoint → Bing fallback) feeding the LLM with cited sources.
- **Persistence:** a JSON file store at `data/db.json` — jobs, candidates, activities, sessions, and interview kits. The directory is created on first run.

```
┌────────────┐   /api/*    ┌─────────────┐   /api/chat   ┌─────────┐
│ React 19   │  ⇄ Express  │             │  ⇄  local     │  Ollama │
│  + Vite    │  :3000      │   server.ts │  (default     │ :11434  │
└────────────┘             │             │  :11434)      └─────────┘
                          └──────┬──────┘
                                 │  JSON file store
                            data/db.json
```

---

## 📁 Project Layout

```
├── server.ts                # Express API + Ollama client + persistence
├── src/
│   ├── App.tsx              # Shell, nav, module routing
│   ├── components/
│   │   ├── modules/         # Dashboard, Candidates CRM, Pipeline,
│   │   │                    #    JD Studio, Batch Screening, Analytics,
│   │   │                    #    Interview, Outreach, Sourcing, Copilot
│   │   ├── tabs/            # JD Analysis, Resume Eval, Agentic Research
│   │   └── …                # Header, Sidebar, modals, markdown view
│   └── lib/                 # api client, ModelContext (Ollama model picker)
├── index.html
├── vite.config.ts
├── tsconfig.json
└── data/                    # runtime JSON store (gitignored)
```

---

## 🔐 Privacy & Local-First

- **No cloud AI, no API keys.** All inferences run on your machine via Ollama.
- Candidate resumes and profiles stay in `data/db.json` on your disk.
- The repo ships a `.env.example`; `data/`, model weights, and generated artifacts are all gitignored.
- Web research queries public engines and returns cited sources — candidate data is never transmitted to them.
