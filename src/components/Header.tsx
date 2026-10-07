import React from 'react';
import { Cpu, Sparkles, MessageSquare, Layers, Zap, RotateCw } from 'lucide-react';
import { useModel } from '../lib/ModelContext';

interface HeaderProps {
  activeJobTitle?: string;
  totalCandidates?: number;
  openCopilot?: () => void;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeJobTitle,
  totalCandidates = 0,
  openCopilot,
  onToggleSidebar,
}) => {
  const { models, selectedModel, setSelectedModel, refreshModels } = useModel();

  return (
    <header className="sticky top-0 z-40 bg-slate-950/70 backdrop-blur-2xl border-b border-white/10 text-white shadow-2xl">
      <div className="max-w-[2200px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Logo */}
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-tr from-indigo-600 via-purple-600 to-emerald-500 rounded-xl shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
            <Cpu className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
                Recruitment OS
              </h1>
              <span className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 text-[10px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm backdrop-blur-md">
                <Sparkles className="w-3 h-3 text-indigo-400" /> AI Engine Active
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Next-Gen Autonomous Candidate Sourcing, CRM & AI Interview Intelligence
            </p>
          </div>
        </div>

        {/* Status Indicators & Copilot Trigger */}
        <div className="flex items-center space-x-3 text-xs">
          {/* Model Selector */}
          <div className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/5 backdrop-blur-md border border-white/10">
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-transparent text-slate-200 font-medium text-[11px] focus:outline-none max-w-[140px] cursor-pointer"
            >
              {models.length === 0 && <option value="">No models found</option>}
              {models.map((m) => (
                <option key={m} value={m} className="bg-slate-900 text-slate-200">
                  {m}
                </option>
              ))}
            </select>
            <button
              onClick={refreshModels}
              title="Refresh models"
              className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <RotateCw className="w-3 h-3" />
            </button>
          </div>

          {/* Active Job Context Pill */}
          <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 text-slate-300 shadow-inner">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-medium max-w-[180px] truncate text-slate-200">
              {activeJobTitle ? activeJobTitle : 'All Active Jobs'}
            </span>
            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-emerald-500/30">
              {totalCandidates} Candidates
            </span>
          </div>

          {/* Advanced Chat Bot Action Button */}
          {openCopilot && (
            <button
              onClick={openCopilot}
              className="flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/30 border border-white/20 transition-all transform active:scale-95"
            >
              <MessageSquare className="w-4 h-4 text-white" />
              <span>Advanced Chat Bot</span>
            </button>
          )}

          {/* Sidebar Toggle button for mobile */}
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 lg:hidden border border-white/10"
              title="Toggle Menu"
            >
              <Zap className="w-4 h-4 text-indigo-400" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
