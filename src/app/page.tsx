import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
      {/* Top Banner Navigation */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-[#1B71AC] flex items-center justify-center text-white font-bold text-lg shadow-sm">
              AJ
            </span>
            <div className="flex flex-col">
              <span className="font-bold text-slate-900 tracking-tight text-sm sm:text-base">
                AI Publishing Platform
              </span>
              <span className="text-xs text-slate-500 font-medium leading-none">
                For Study Guide Compilation
              </span>
            </div>
          </div>
          <div>
            <Link
              href="/workspace"
              id="btn-goto-workspace"
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg text-white bg-[#1B71AC] hover:bg-[#155582] transition-colors shadow-sm"
            >
              Enter Workspace →
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col items-center justify-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2AB573]/10 text-[#2AB573] text-xs font-semibold mb-6 tracking-wide uppercase">
          🚀 Next-Generation Document Pipeline
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight max-w-3xl leading-none">
          Transform Raw Study Notes Into Branded{" "}
          <span className="text-[#1B71AC]">Exam-Focused Guides</span>
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl leading-relaxed">
          Upload Notion-exported HTML files or ZIP packages. Analyze metrics, auto-classify document layouts deterministically, and overlay deep educational AI layers (MCQs, revision notes, common pitfalls) to generate publication-grade PDF textbooks.
        </p>
        
        <div className="mt-10 flex flex-wrap gap-4 justify-center">
          <Link
            href="/workspace"
            id="btn-get-started"
            className="px-6 py-3.5 bg-[#1B71AC] hover:bg-[#155582] text-white font-semibold text-base rounded-xl transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            Launch Publishing Workspace
          </Link>
        </div>

        {/* Feature Cards Grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl">
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-left flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#1B71AC]/10 text-[#1B71AC] flex items-center justify-center text-xl mb-6 font-bold">
                📊
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                Structured Parsing & Analytics
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Extracts HTML nodes into a structured JSON schema. Runs instant token-efficient statistics and AI difficulty scores, topic density, and exam weightage evaluation.
              </p>
            </div>
            <div className="mt-6 text-xs font-semibold text-[#1B71AC]">
              FOUNDATION OF RAG & ASSESSMENT
            </div>
          </div>

          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-left flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#2AB573]/10 text-[#2AB573] flex items-center justify-center text-xl mb-6 font-bold">
                🧠
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                AI Educational Intelligence
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Add learning objectives, high-level summary boxes, conceptual definitions callouts, typical student errors guides, and automated high-yield practice MCQs.
              </p>
            </div>
            <div className="mt-6 text-xs font-semibold text-[#2AB573]">
              AI TEACHING LAYER OVERLAYS
            </div>
          </div>

          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-left flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center text-xl mb-6 font-bold">
                🖨️
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                Deterministic Layout Printer
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Preserves exact table heuristic sizing, column flow, running page watermarks, logo headers, and page numbers with zero formatting shifts.
              </p>
            </div>
            <div className="mt-6 text-xs font-semibold text-slate-500">
              100% RELIABLE PUPPETEER PRINT
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-500 font-medium">
        © 2026 Anujjindal.in AI Publishing Engine. All rights reserved.
      </footer>
    </div>
  );
}
