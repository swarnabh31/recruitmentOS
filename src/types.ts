export interface Session {
  id: string;
  created_at: string;
  jd_text: string;
  jd_filename: string;
  model: string;
}

export interface JDAnalysis {
  role_summary: string;
  must_have_skills: string[];
  good_to_have_skills: string[];
  experience_required: string;
  target_company_types: string[];
  linkedin_xray_searches: string[];
  interview_questions: string[];
  outreach_email_template: string;
}

export interface SkillsMatch {
  must_have_present: string[];
  must_have_missing: string[];
  good_to_have_present: string[];
}

export interface ExperienceAnalysis {
  relevant_experience_years: string;
  company_type_match: string;
  project_complexity: string;
}

export interface ResumeEvaluation {
  id?: string;
  session_id?: string;
  candidate_name: string;
  resume_filename: string;
  overall_score: number;
  skills_match: SkillsMatch;
  experience_analysis: ExperienceAnalysis;
  red_flags: string[];
  key_strengths: string[];
  key_weaknesses: string[];
  recommendation: 'Yes' | 'No' | 'Maybe' | 'Error' | string;
  recommendation_reason: string;
  error?: boolean;
  raw_output?: string;
  created_at?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface ResearchSource {
  title: string;
  url: string;
  snippet?: string;
}

export interface ResearchMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: ResearchSource[];
  isSearching?: boolean;
  timestamp?: string;
}

export interface KBDocument {
  id: string;
  name: string;
  size: number;
  charCount: number;
  content: string;
}

// ---------------------------------------------------------------------------
// RECRUITMENT OS EXTENDED MODELS
// ---------------------------------------------------------------------------

export type JobStatus = 'Open' | 'Draft' | 'Closed' | 'On Hold';
export type JobPriority = 'High' | 'Medium' | 'Low';

export interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  type: 'Full-time' | 'Remote' | 'Hybrid' | 'Contract';
  status: JobStatus;
  priority: JobPriority;
  hiring_manager: string;
  salary_range: string;
  min_experience: number;
  max_experience: number;
  required_skills: string[];
  jd_text: string;
  jd_filename: string;
  created_at: string;
  candidate_count?: number;
}

export type PipelineStage =
  | 'Applied'
  | 'Screening'
  | 'Shortlisted'
  | 'Technical Interview'
  | 'HR Round'
  | 'Offer Extended'
  | 'Hired'
  | 'Rejected';

export interface CandidateActivity {
  id: string;
  candidate_id: string;
  type: 'call' | 'email' | 'note' | 'interview' | 'stage_change' | 'ai_eval';
  author: string;
  title: string;
  content: string;
  timestamp: string;
}

export interface Candidate {
  id: string;
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
  linkedin_url?: string;
  github_url?: string;
  resume_filename: string;
  resume_text: string;
  ai_score: number;
  stage: PipelineStage;
  job_id: string;
  job_title: string;
  source: string;
  match_reason?: string;
  key_strengths?: string[];
  key_weaknesses?: string[];
  red_flags?: string[];
  created_at: string;
  last_contacted?: string;
  activities?: CandidateActivity[];
}

export interface InterviewKit {
  id?: string;
  candidate_id: string;
  candidate_name: string;
  job_title: string;
  technical_questions: string[];
  behavioral_questions: string[];
  red_flags_to_verify: string[];
  weak_areas: string[];
  deep_dive_topics: string[];
  interview_notes?: string;
  post_score?: number;
  post_summary?: string;
  created_at: string;
}

export interface OutreachSequence {
  id: string;
  candidate_id: string;
  candidate_name: string;
  job_title: string;
  subject: string;
  steps: Array<{
    step_number: number;
    delay_days: number;
    channel: 'Email' | 'LinkedIn' | 'WhatsApp';
    content: string;
  }>;
  status: 'Draft' | 'Scheduled' | 'Sent' | 'Replied';
  created_at: string;
}

export interface RecruitmentAnalytics {
  open_jobs_count: number;
  total_candidates: number;
  avg_resume_score: number;
  avg_time_to_hire_days: number;
  offer_acceptance_rate: number;
  stage_distribution: Record<PipelineStage, number>;
  top_sourcing_channels: Array<{ name: string; count: number; conversion: string }>;
}

