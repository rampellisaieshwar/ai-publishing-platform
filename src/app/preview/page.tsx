'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getDocFromDB } from '@/lib/db';

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
  const [renderingPdf, setRenderingPdf] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!documentId) return;

    const loadDocumentAndRender = async () => {
      try {
        setLoading(true);
        setError('');
        
        // 1. Fetch document state from IndexedDB
        console.log(`Loading document ${documentId} from IndexedDB`);
        const docData = await getDocFromDB(documentId);
        
        if (!docData) {
          throw new Error('Document data not found. Please upload the file again in the workspace.');
        }

        setMetadata(docData.stats);
        setLoading(false);
        setRenderingPdf(true);

        // 2. Fetch the dynamically rendered PDF
        console.log('Fetching rendered PDF from in-memory Puppeteer route...');
        const response = await fetch('/api/render', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            htmlContent: docData.htmlContent,
            enhancements: docData.enhancements,
          }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to render PDF document.');
        }

        // 3. Create a local object URL for the PDF blob
        const pdfBlob = await response.blob();
        const objectUrl = URL.createObjectURL(pdfBlob);
        setPdfUrl(objectUrl);
        setRenderingPdf(false);

      } catch (err: any) {
        console.error('Error in Preview Page:', err);
        setError(err.message || 'An error occurred while compiling the PDF.');
        setLoading(false);
        setRenderingPdf(false);
      }
    };

    loadDocumentAndRender();
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

  const sanitizedTitle = metadata?.title
    ? metadata.title.replace(/[^a-zA-Z0-9-_]/g, '_')
    : 'study-guide';

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-64px)] overflow-hidden">
      {/* Left Screen: PDF Iframe Preview */}
      <div className="flex-1 bg-slate-800 border-r border-slate-700 h-full relative flex flex-col items-center justify-center">
        {renderingPdf && (
          <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center text-white z-10 p-6">
            <div className="relative mb-6">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#2AB573] border-t-transparent"></div>
              <div className="absolute inset-0 flex items-center justify-center text-lg">📄</div>
            </div>
            <h3 className="text-lg font-bold">Compiling PDF Layout</h3>
            <p className="text-sm text-slate-400 mt-2 text-center max-w-sm leading-relaxed">
              Applying CSS column splits, sizing tables, and rendering running page headers in Puppeteer...
            </p>
          </div>
        )}

        {error ? (
          <div className="text-center p-8 text-white max-w-md">
            <div className="text-5xl mb-4">⚠️</div>
            <h3 className="text-lg font-bold text-red-400">Compilation Error</h3>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed bg-red-950/45 p-4 rounded-xl border border-red-900/50">
              {error}
            </p>
            <Link
              href="/workspace"
              className="mt-6 inline-block py-2.5 px-6 bg-[#1B71AC] hover:bg-[#155582] text-white text-sm font-bold rounded-xl transition-all"
            >
              ← Back to Workspace
            </Link>
          </div>
        ) : pdfUrl ? (
          <iframe
            src={pdfUrl}
            className="w-full h-full border-none"
            title="Study Guide PDF Preview"
          />
        ) : (
          <div className="text-center text-slate-400">
            <div className="text-4xl mb-2">📥</div>
            <p className="text-sm">Waiting to render PDF document...</p>
          </div>
        )}
      </div>

      {/* Right Screen: Action Panel & Stats */}
      <div className="w-full lg:w-96 bg-white flex flex-col h-full overflow-y-auto border-l border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#2AB573] bg-[#2AB573]/10 px-2 py-0.5 rounded">
            Study Guide Stats
          </span>
          <h2 className="text-lg font-extrabold text-slate-900 mt-2 line-clamp-2 leading-snug">
            {metadata?.title || 'Loading parameters...'}
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
          {pdfUrl ? (
            <a
              href={pdfUrl}
              download={`${sanitizedTitle}.pdf`}
              id="btn-download-pdf"
              className="w-full inline-flex items-center justify-center py-3.5 px-4 bg-[#1B71AC] hover:bg-[#155582] text-white font-bold text-sm rounded-xl transition-all shadow-md hover:shadow-lg text-center cursor-pointer"
            >
              📥 Download PDF File
            </a>
          ) : (
            <button
              disabled
              className="w-full inline-flex items-center justify-center py-3.5 px-4 bg-slate-300 text-white font-bold text-sm rounded-xl text-center cursor-not-allowed"
            >
              ⏳ Preparing Download...
            </button>
          )}
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
