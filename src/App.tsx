import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { DashboardModule } from './components/modules/DashboardModule';
import { JobsModule } from './components/modules/JobsModule';
import { CandidatesCRMModule } from './components/modules/CandidatesCRMModule';
import { KanbanPipelineModule } from './components/modules/KanbanPipelineModule';
import { AISearchMatchModule } from './components/modules/AISearchMatchModule';
import { InterviewAssistantModule } from './components/modules/InterviewAssistantModule';
import { OutreachAutomationModule } from './components/modules/OutreachAutomationModule';
import { SourcingIntelligenceModule } from './components/modules/SourcingIntelligenceModule';
import { AnalyticsModule } from './components/modules/AnalyticsModule';
import { CopilotDrawer } from './components/modules/CopilotDrawer';
import { JDStudioTab } from './components/modules/JDStudioTab';
import { ModelProvider } from './lib/ModelContext';
import { getJobs, getCandidates } from './lib/api';
import { Job, Candidate } from './types';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Layers,
  Sparkles,
  FileQuestion,
  Mail,
  Globe,
  BarChart2,
  Bot,
  Zap,
  Wand2,
} from 'lucide-react';

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [activeJobId, setActiveJobId] = useState<string>('all');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);

  const fetchAllData = async () => {
    const fetchedJobs = await getJobs();
    const fetchedCandidates = await getCandidates();
    setJobs(fetchedJobs);
    setCandidates(fetchedCandidates);
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleSelectJob = (job: Job) => {
    setActiveJobId(job.id);
  };

  const handleNavigateToCandidateInterview = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setActiveTab('interview');
  };

  const handleNavigateToCandidateOutreach = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setActiveTab('outreach');
  };

  const activeJobObj = jobs.find((j) => j.id === activeJobId);

  return (
    <ModelProvider>
    <div className="h-dvh flex flex-col bg-slate-950 text-slate-100 font-sans antialiased bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]">
      {/* Top Header */}
      <Header
        activeJobTitle={activeJobObj ? activeJobObj.title : 'All Requisitions'}
        totalCandidates={candidates.length}
        openCopilot={() => setIsCopilotOpen(true)}
      />

      {/* Main OS Navigation Bar */}
      <div className="border-b border-white/10 bg-slate-950/80 backdrop-blur-xl sticky top-16 z-30 shadow-md">
        <div className="max-w-[2200px] mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto py-2.5 flex-nowrap">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'jobs', label: 'Jobs', icon: Briefcase },
              { id: 'candidates', label: 'Candidates CRM', icon: Users },
              { id: 'pipeline', label: 'Pipeline Board', icon: Layers },
              { id: 'ai-search', label: 'AI Search & Rank', icon: Sparkles },
              { id: 'interview', label: 'Interview Assistant', icon: FileQuestion },
              { id: 'outreach', label: 'Outreach & Email', icon: Mail },
              { id: 'jd-studio', label: 'JD Studio', icon: Wand2 },
              { id: 'sourcing', label: 'Market Research', icon: Globe },
              { id: 'analytics', label: 'Analytics', icon: BarChart2 },
            ].map((nav) => {
              const Icon = nav.icon;
              const isActive = activeTab === nav.id;
              return (
                <button
                  key={nav.id}
                  onClick={() => setActiveTab(nav.id)}
                  className={`flex items-center space-x-2 py-2 px-3.5 shrink-0 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/20 border border-white/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{nav.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main OS Body Content */}
      <main className="flex-1 min-h-0 max-w-[2200px] mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
        {activeTab === 'dashboard' && (
          <DashboardModule
            jobs={jobs}
            candidates={candidates}
            onNavigateTab={setActiveTab}
            onSelectJob={handleSelectJob}
          />
        )}

        {activeTab === 'jobs' && (
          <JobsModule
            jobs={jobs}
            onJobsUpdated={fetchAllData}
            onSelectJob={(job) => {
              handleSelectJob(job);
              setActiveTab('pipeline');
            }}
          />
        )}

        {activeTab === 'candidates' && (
          <CandidatesCRMModule
            candidates={candidates}
            jobs={jobs}
            onCandidatesUpdated={fetchAllData}
            onSelectCandidateForInterview={handleNavigateToCandidateInterview}
            onSelectCandidateForOutreach={handleNavigateToCandidateOutreach}
          />
        )}

        {activeTab === 'pipeline' && (
          <KanbanPipelineModule
            candidates={candidates}
            jobs={jobs}
            activeJobId={activeJobId}
            onSelectJobId={setActiveJobId}
            onCandidatesUpdated={fetchAllData}
            onSelectCandidate={(c) => {
              setSelectedCandidate(c);
              setActiveTab('candidates');
            }}
          />
        )}

        {activeTab === 'ai-search' && (
          <AISearchMatchModule
            candidates={candidates}
            jobs={jobs}
            onSelectCandidate={(c) => {
              setSelectedCandidate(c);
              setActiveTab('candidates');
            }}
          />
        )}

        {activeTab === 'interview' && (
          <InterviewAssistantModule
            candidates={candidates}
            jobs={jobs}
            selectedCandidateForInterview={selectedCandidate}
          />
        )}

        {activeTab === 'outreach' && (
          <OutreachAutomationModule
            candidates={candidates}
            jobs={jobs}
            selectedCandidateForOutreach={selectedCandidate}
          />
        )}

        {activeTab === 'jd-studio' && <JDStudioTab jobs={jobs} />}

        {/* Batch Screening now lives as a sub-tab inside Candidates CRM */}

        {activeTab === 'sourcing' && <SourcingIntelligenceModule />}

        {activeTab === 'analytics' && <AnalyticsModule candidates={candidates} jobs={jobs} />}
      </main>

      {/* Advanced Chat Bot Drawer */}
      <CopilotDrawer isOpen={isCopilotOpen} onClose={() => setIsCopilotOpen(false)} jobs={jobs} />
    </div>
    </ModelProvider>
  );
}
