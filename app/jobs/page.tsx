import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Briefcase } from 'lucide-react';

export default function JobsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-8 text-center space-y-4">
        <div className="mx-auto w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
          <Briefcase className="w-5 h-5" />
        </div>
        <h1 className="text-xl font-semibold text-slate-100">Jobs Feed</h1>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          View and aggregate all recruiter communications, interview invitations, and status updates directly in your unified Job Inbox.
        </p>
        <Link
          href="/inbox"
          className="inline-flex items-center gap-2 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Open Job Inbox</span>
        </Link>
      </div>
    </div>
  );
}
