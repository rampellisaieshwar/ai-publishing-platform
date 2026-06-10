'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface DocumentStats {
  wordCount: number;
  estimatedReadingTime: string;
  headings: number;
  tables: number;
  images: number;
  difficultyScore: 'Beginner' | 'Intermediate' | 'Advanced';
  topicDensity: string;
  estimatedExamWeightage: number;
}

export default function WorkspacePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States
  const [file, setFile] = useState<File | null>(null);
  const [documentId, setDocumentId] = useState<string>('');
  const [mode, setMode] = useState<'standard' | 'ai'>('standard');
  const [flags, setFlags] = useState({
    objectives: true,
    examConcepts: true,
    revisionNotes: true,
    mcqs: true,
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [stats, setStats] = useState<DocumentStats | null>(null);
  const [error, setError] = useState<string>('');

  const steps = [
    'Parsing HTML Document...',
    'Generating AI Educational Overlays...',
    'Applying Deterministic Column Layouts...',
    'Compiling A4 PDF in Puppeteer...',
  ];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    await processFile(uploadedFile);
  };

  const processFile = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setError('');
    setIsAnalyzing(true);
    setStats(null);
    setDocumentId('');

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);

      // 1. Extract HTML Content
      const extractRes = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      });

      if (!extractRes.ok) {
        const errData = await extractRes.json();
        throw new Error(errData.error || 'Failed to parse document.');
      }

      const docData = await extractRes.json();
      setDocumentId(docData.documentId);

      // 2. Run Document Analyzer
      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(docData),
      });

      if (!analyzeRes.ok) {
        const errData = await analyzeRes.json();
        throw new Error(errData.error || 'Failed to analyze document metrics.');
      }

      const statsData = await analyzeRes.json();
      setStats(statsData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during file upload.');
      setFile(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      await processFile(droppedFile);
    }
  };

  const handleCheckboxChange = (key: keyof typeof flags) => {
    setFlags(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleGenerate = async () => {
    if (!documentId) return;
    setIsGenerating(true);
    setError('');
    setCurrentStep(0); // Parsing

    try {
      let enhancements = null;

      if (mode === 'ai') {
        // Step 1: Generate AI Enhancements
        setCurrentStep(1);
        const enhanceRes = await fetch('/api/enhance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId,
            flags,
          }),
        });

        if (!enhanceRes.ok) {
          const errData = await enhanceRes.json();
          throw new Error(errData.error || 'Failed to generate AI content overlays.');
        }
        enhancements = await enhanceRes.json();
      }

      // Step 2: Render PDF
      setCurrentStep(2); // Applying Column layouts
      setCurrentStep(3); // Compiling A4 PDF in Puppeteer
      
      const renderRes = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          enhancements,
        }),
      });

      if (!renderRes.ok) {
        const errData = await renderRes.json();
        throw new Error(errData.error || 'Failed to render PDF using Puppeteer.');
      }

      const renderData = await renderRes.json();
      
      // Redirect to Preview page
      router.push(`/preview?id=${documentId}&title=${encodeURIComponent(stats?.difficultyScore || '')}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during PDF compilation.');
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="w-8 h-8 rounded-lg bg-[#1B71AC] flex items-center justify-center text-white font-bold text-lg shadow-sm hover:opacity-90">
              AJ
            </Link>
            <div className="flex flex-col">
              <span className="font-bold text-slate-900 text-sm sm:text-base">
                Publishing Workspace
              </span>
              <span className="text-xs text-slate-500 font-medium leading-none">
                Phase 1 MVP Pipeline
              </span>
            </div>
          </div>
          <Link href="/" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-8">
        
        {/* Left Side: Upload & Configuration */}
        <div className="flex-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <span>🛠️</span> Document Configuration
            </h2>

            {/* Drag & Drop Upload */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                file
                  ? 'border-[#2AB573] bg-[#2AB573]/5'
                  : 'border-slate-300 hover:border-[#1B71AC] hover:bg-slate-50/50'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".html,.htm,.zip"
                className="hidden"
              />
              <div className="text-4xl mb-4">{file ? '📄' : '📤'}</div>
              {file ? (
                <div>
                  <p className="font-bold text-[#2AB573] text-sm break-all">{file.name}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Click or drag to replace file
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-bold text-slate-800 text-sm">
                    Upload Notion HTML export or ZIP package
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Supports raw .html exports or .zip with assets folder
                  </p>
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-medium">
                ⚠️ {error}
              </div>
            )}

            {/* Mode Selection */}
            <div className="mt-8">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Select Output Format Mode
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setMode('standard')}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    mode === 'standard'
                      ? 'border-[#1B71AC] bg-[#1B71AC]/5 text-[#1B71AC]'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-bold text-sm">Standard Mode</div>
                  <div className="text-xs text-slate-500 mt-1 leading-normal">
                    Fast deterministic CSS columns & A4 layout template. No AI calls.
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('ai')}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    mode === 'ai'
                      ? 'border-[#2AB573] bg-[#2AB573]/5 text-[#2AB573]'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-bold text-sm text-[#2AB573]">AI Enhanced Mode</div>
                  <div className="text-xs text-slate-500 mt-1 leading-normal">
                    Appends summary, exam concepts, common pitfalls, and MCQs prior to layout compile.
                  </div>
                </button>
              </div>
            </div>

            {/* AI Custom Overlay Options */}
            {mode === 'ai' && (
              <div className="mt-6 p-5 bg-slate-50 rounded-xl border border-slate-200 transition-all">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  AI Teaching Layer Overlays
                </label>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={flags.objectives}
                      onChange={() => handleCheckboxChange('objectives')}
                      className="rounded text-[#2AB573] focus:ring-[#2AB573] h-4 w-4"
                    />
                    Generate Learning Objectives & Summary Box
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={flags.examConcepts}
                      onChange={() => handleCheckboxChange('examConcepts')}
                      className="rounded text-[#2AB573] focus:ring-[#2AB573] h-4 w-4"
                    />
                    Extract Important Exam Concepts & Definitions
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={flags.revisionNotes}
                      onChange={() => handleCheckboxChange('revisionNotes')}
                      className="rounded text-[#2AB573] focus:ring-[#2AB573] h-4 w-4"
                    />
                    Generate Common Mistakes & Pitfalls Guide
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={flags.mcqs}
                      onChange={() => handleCheckboxChange('mcqs')}
                      className="rounded text-[#2AB573] focus:ring-[#2AB573] h-4 w-4"
                    />
                    Create Printable Assessment MCQs & Q&A
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Action Trigger */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            {isGenerating ? (
              <div className="p-4 bg-[#1B71AC]/5 border border-[#1B71AC]/20 rounded-xl">
                <div className="flex items-center gap-3 mb-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#1B71AC] border-t-transparent"></div>
                  <span className="font-bold text-sm text-[#1B71AC]">Generating Document...</span>
                </div>
                <div className="space-y-1.5 mt-3">
                  {steps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs font-semibold">
                      <div className={`w-2 h-2 rounded-full ${
                        idx < currentStep ? 'bg-[#2AB573]' : idx === currentStep ? 'bg-[#1B71AC] animate-pulse' : 'bg-slate-200'
                      }`} />
                      <span className={idx === currentStep ? 'text-slate-800' : idx < currentStep ? 'text-[#2AB573]' : 'text-slate-400'}>
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!documentId}
                className={`w-full py-4 text-center text-white font-bold text-base rounded-xl transition-all shadow-md ${
                  documentId
                    ? mode === 'ai'
                      ? 'bg-[#2AB573] hover:bg-[#1e8452] hover:shadow-lg transform hover:-translate-y-0.5'
                      : 'bg-[#1B71AC] hover:bg-[#155582] hover:shadow-lg transform hover:-translate-y-0.5'
                    : 'bg-slate-300 cursor-not-allowed shadow-none'
                }`}
              >
                Compile Study Guide PDF →
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Document Insights */}
        <div className="w-full lg:w-96 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <span>📊</span> Document Insights
          </h2>

          {isAnalyzing && (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-500 font-medium">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#1B71AC] border-t-transparent mb-4"></div>
              Parsing HTML & AI Insights...
            </div>
          )}

          {!isAnalyzing && !stats && (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-400 font-semibold border-2 border-dashed border-slate-200 rounded-xl">
              <span className="text-3xl mb-2">📁</span>
              <span>Upload a study guide HTML file</span>
              <span className="text-xs text-slate-500 mt-1">Metrics update automatically</span>
            </div>
          )}

          {!isAnalyzing && stats && (
            <div className="flex-1 flex flex-col gap-5">
              {/* Core metrics grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Words</div>
                  <div className="text-lg font-extrabold text-slate-900 mt-1">{stats.wordCount}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Reading Time</div>
                  <div className="text-lg font-extrabold text-slate-900 mt-1">{stats.estimatedReadingTime}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Tables</div>
                  <div className="text-lg font-extrabold text-slate-900 mt-1">{stats.tables}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Images</div>
                  <div className="text-lg font-extrabold text-slate-900 mt-1">{stats.images}</div>
                </div>
              </div>

              {/* Headings */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-600">Total Headings</span>
                <span className="text-sm font-extrabold text-slate-900 bg-white border border-slate-200 px-3 py-1 rounded-md">
                  {stats.headings}
                </span>
              </div>

              {/* AI-Generated Insights */}
              <div className="mt-2 border-t border-slate-200 pt-5">
                <div className="flex items-center gap-1.5 text-[#2AB573] font-bold text-xs uppercase tracking-wider mb-4">
                  <span>✨</span> AI Assessment Analytics
                </div>
                <div className="space-y-4">
                  {/* Difficulty */}
                  <div className="bg-[#2AB573]/5 p-4 rounded-xl border border-[#2AB573]/20">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Conceptual Difficulty</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-base font-extrabold text-[#2AB573]">{stats.difficultyScore}</span>
                      <span className="text-[10px] bg-[#2AB573] text-white px-2 py-0.5 rounded font-bold uppercase tracking-wide">
                        ALIGNED
                      </span>
                    </div>
                  </div>
                  {/* Exam weight */}
                  <div className="bg-[#1B71AC]/5 p-4 rounded-xl border border-[#1B71AC]/20">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Estimated Exam Weightage</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-base font-extrabold text-[#1B71AC]">{stats.estimatedExamWeightage}%</span>
                      <span className="text-[10px] bg-[#1B71AC] text-white px-2 py-0.5 rounded font-bold uppercase tracking-wide">
                        HIGH YIELD
                      </span>
                    </div>
                  </div>
                  {/* Topic Density */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Topic Concept Density</div>
                    <div className="text-xs font-semibold text-slate-600 leading-normal">{stats.topicDensity}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
