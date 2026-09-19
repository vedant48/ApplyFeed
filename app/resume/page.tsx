import React from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';

export default function ResumePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-8 text-center space-y-4">
        <div className="mx-auto w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
          <FileText className="w-5 h-5" />
        </div>
        <h1 className="text-xl font-semibold text-slate-100">Resume Management</h1>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          The unified job inbox is active. Resume management and job matching are kept modular and separate from email aggregation.
        </p>
        <Link
          href="/inbox"
          className="inline-flex items-center gap-2 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Job Inbox</span>
        </Link>
      </div>
    </div>
  );
}
