'use client';

import React from 'react';
import Link from 'next/link';
import { Mail, RefreshCw, FilterX } from 'lucide-react';

interface EmptyStateProps {
  type: 'no-accounts' | 'no-emails' | 'no-results';
  onSync?: () => void;
  onClearFilters?: () => void;
  isSyncing?: boolean;
}

export default function EmptyState({
  type,
  onSync,
  onClearFilters,
  isSyncing = false,
}: EmptyStateProps) {
  if (type === 'no-accounts') {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-12 text-center my-6 max-w-md mx-auto space-y-4">
        <div className="mx-auto w-10 h-10 rounded-full bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
          <Mail className="w-5 h-5" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-slate-100">No connected accounts</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Connect an email account to aggregate job-related emails into one place.
          </p>
        </div>
        <div className="flex justify-center pt-2">
          <Link
            href="/settings/email-accounts"
            className="inline-flex items-center justify-center h-8 px-4 rounded bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors"
          >
            Connect Gmail Account
          </Link>
        </div>
      </div>
    );
  }

  if (type === 'no-emails') {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-12 text-center my-6 max-w-md mx-auto space-y-4">
        <div className="mx-auto w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
          <Mail className="w-5 h-5" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-slate-100">No job emails found</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Try syncing your connected accounts or changing the date range.
          </p>
        </div>
        {onSync && (
          <div className="pt-2">
            <button
              type="button"
              onClick={onSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 h-8 px-4 rounded bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-12 text-center my-6 max-w-md mx-auto space-y-4">
      <div className="mx-auto w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
        <FilterX className="w-5 h-5" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-sm font-semibold text-slate-100">No matching emails</h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          No job emails match these filters.
        </p>
      </div>
      {onClearFilters && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
