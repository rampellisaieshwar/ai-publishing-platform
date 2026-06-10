'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface DocumentMetadata {
  title: string;
  wordCount: number;
  estimatedReadingTime: string;
  headings: number;
  tables: number;
  images: number;
  difficultyScore: string;
  topicDensity: string;
  estimatedExamWeightage: number;
}

function PreviewContent() {
  const searchParams = useSearchParams();
  const documentId = searchParams.get('id');

  const [metadata, setMetadata] = useState<DocumentMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string>('');

  useEffect(() => {
    if (!documentId) return;

    setPdfUrl(`/temp/${documentId}/output.pdf`);

    // Fetch the persisted metadata.json file statically
    fetch(`/temp/${documentId}/metadata.json`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load metadata');
        return res.json();
      })
      .then(data => {
        setMetadata(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [documentId]);

  if (!documentId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500 bg-slate-50">
        <div className="text-4xl mb-4">⚠️</div>
        <p className="font-bold text-lg">No document ID provided</p>
        <Link href="/workspace" className="mt-4 text-[#1B71AC] font-semibold hover:underline">
          Go to Workspace
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-64px)] overflow-hidden">
      {/* Left Screen: PDF Iframe Preview */}
      <div className="flex-1 bg-slate-800 border-r border-slate-700 h-full relative">
        {pdfUrl && (
          <iframe
            src={pdfUrl}
            className="w-full h-full border-none"
            title="Study Guide PDF Preview"
          />
        )}
      </div>

      {/* Right Screen: Action Panel & Stats */}
      <div className="w-full lg:w-96 bg-white flex flex-col h-full overflow-y-auto border-l border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#2AB573] bg-[#2AB573]/10 px-2 py-0.5 rounded">
            Study Guide Compiled
          </span>
          <h2 className="text-lg font-extrabold text-slate-900 mt-2 line-clamp-2 leading-snug">
            {metadata?.title || 'Compilation Completed'}
          </h2>
        </div>

        {/* Details & Statistics */}
        <div className="p-6 flex-1 space-y-6">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-sm">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-400 border-t-transparent mb-3"></div>
              Loading document parameters...
            </div>
          ) : (
            <>
              {/* Document Overview */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Document Overview
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Words</span>
                    <span className="text-sm font-extrabold text-slate-900">{metadata?.wordCount}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Read Time</span>
                    <span className="text-sm font-extrabold text-slate-900">{metadata?.estimatedReadingTime}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Tables</span>
                    <span className="text-sm font-extrabold text-slate-900">{metadata?.tables}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Images</span>
                    <span className="text-sm font-extrabold text-slate-900">{metadata?.images}</span>
                  </div>
                </div>
              </div>

              {/* AI Teaching Layer assessment */}
              {metadata?.difficultyScore && (
                <div className="border-t border-slate-100 pt-5">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                    Educational Intelligence
                  </h3>
                  <div className="space-y-3.5">
                    {/* Difficulty */}
                    <div className="flex justify-between items-center bg-[#2AB573]/5 px-3 py-2 rounded-lg border border-[#2AB573]/15">
                      <span className="text-xs font-bold text-slate-600">Conceptual Level</span>
                      <span className="text-xs font-extrabold text-[#2AB573]">{metadata.difficultyScore}</span>
                    </div>
                    {/* Weight */}
                    <div className="flex justify-between items-center bg-[#1B71AC]/5 px-3 py-2 rounded-lg border border-[#1B71AC]/15">
                      <span className="text-xs font-bold text-slate-600">Exam Weightage</span>
                      <span className="text-xs font-extrabold text-[#1B71AC]">{metadata.estimatedExamWeightage}%</span>
                    </div>
                    {/* Density */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Concept Density</span>
                      <span className="text-xs font-semibold text-slate-600 leading-normal block">{metadata.topicDensity}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-6 border-t border-slate-200 bg-slate-50 space-y-3">
          <a
            href={`/api/download/${documentId}/${metadata ? metadata.title.replace(/[^a-zA-Z0-9-_]/g, '_') : 'study-guide'}.pdf`}
            download={`${metadata ? metadata.title.replace(/[^a-zA-Z0-9-_]/g, '_') : 'study-guide'}.pdf`}
            target="_self"
            rel="noopener noreferrer"
            id="btn-download-pdf"
            className="w-full inline-flex items-center justify-center py-3.5 px-4 bg-[#1B71AC] hover:bg-[#155582] text-white font-bold text-sm rounded-xl transition-all shadow-md hover:shadow-lg text-center"
          >
            📥 Download PDF File
          </a>
          <Link
            href="/workspace"
            className="w-full inline-flex items-center justify-center py-3.5 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm rounded-xl transition-all text-center"
          >
            ← Compile Another Document
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PreviewPage() {
  return (
    <div className="flex flex-col h-screen bg-slate-100">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white h-16 shrink-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="w-8 h-8 rounded-lg bg-[#1B71AC] flex items-center justify-center text-white font-bold text-lg shadow-sm hover:opacity-90">
              AJ
            </Link>
            <div className="flex flex-col">
              <span className="font-bold text-slate-900 text-sm sm:text-base">
                PDF Preview Panel
              </span>
              <span className="text-xs text-slate-500 font-medium leading-none">
                Interactive Viewer
              </span>
            </div>
          </div>
          <Link href="/workspace" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
            Back to Workspace
          </Link>
        </div>
      </header>

      <Suspense fallback={
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-slate-500 text-sm font-medium">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#1B71AC] border-t-transparent mb-4"></div>
          Loading preview panel...
        </div>
      }>
        <PreviewContent />
      </Suspense>
    </div>
  );
}
