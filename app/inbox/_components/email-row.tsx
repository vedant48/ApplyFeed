'use client';

import React from 'react';
import { AlertCircle, Building2 } from 'lucide-react';
import { EmailWithAccount } from '@/lib/db/repository';
import { formatEmailDate, formatExactTimestamp } from '@/lib/date-utils';

interface EmailRowProps {
  email: EmailWithAccount;
  isSelected: boolean;
  onSelect: (email: EmailWithAccount) => void;
}

export default function EmailRow({ email, isSelected, onSelect }: EmailRowProps) {
  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'INTERVIEW':
      case 'INTERVIEW_SCHEDULE':
        return 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30';
      case 'OFFER':
        return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
      case 'REJECTION':
        return 'bg-rose-500/10 text-rose-300 border-rose-500/30';
      case 'ASSESSMENT':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
      case 'APPLICATION':
      case 'APPLICATION_RECEIVED':
        return 'bg-sky-500/10 text-sky-300 border-sky-500/30';
      case 'RECRUITER':
        return 'bg-purple-500/10 text-purple-300 border-purple-500/30';
      default:
        return 'bg-slate-700/30 text-slate-300 border-slate-700/50';
    }
  };

  const formattedCategory = email.category.replace(/_/g, ' ');

  return (
    <div
      onClick={() => onSelect(email)}
      className={`group flex items-start sm:items-center justify-between gap-3 px-3.5 py-3 border-b border-slate-800/80 transition-colors cursor-pointer ${
        isSelected
          ? 'bg-blue-950/20 border-l-2 border-l-blue-500'
          : !email.isRead
          ? 'bg-slate-900/60 hover:bg-slate-900 border-l-2 border-l-blue-400'
          : 'bg-slate-950/40 hover:bg-slate-900/40 border-l-2 border-l-transparent'
      }`}
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        {/* Unread / Attention Indicators */}
        <div className="flex items-center gap-1.5 shrink-0 pt-0.5 sm:pt-0">
          {!email.isRead ? (
            <div className="h-2 w-2 rounded-full bg-blue-500" title="Unread" />
          ) : (
            <div className="h-2 w-2" />
          )}
          {email.requiresAttention && (
            <span title="Needs attention">
              <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            </span>
          )}
        </div>

        {/* Company & Content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className={`text-xs tracking-tight ${!email.isRead ? 'font-semibold text-slate-100' : 'font-medium text-slate-200'}`}>
              {email.company || email.sender}
            </span>

            {/* Platform Tag */}
            {email.platform && email.platform !== 'Unknown' && (
              <span className="text-[10px] font-medium text-slate-400 bg-slate-800/80 px-1.5 py-0.2 rounded border border-slate-700/60">
                {email.platform}
              </span>
            )}

            {/* Category Badge */}
            <span
              className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.2 rounded border ${getCategoryBadgeClass(
                email.category
              )}`}
            >
              {formattedCategory}
            </span>

            {/* Role if available */}
            {email.role && (
              <span className="text-[11px] text-slate-400 truncate max-w-[200px]">
                · {email.role}
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-2">
            <span
              className={`text-xs truncate max-w-md ${
                !email.isRead ? 'font-medium text-slate-200' : 'text-slate-300'
              }`}
            >
              {email.subject}
            </span>
            <span className="hidden md:inline-block text-xs text-slate-500 truncate max-w-sm">
              — {email.snippet}
            </span>
          </div>
        </div>
      </div>

      {/* Account Source & Date */}
      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-3 shrink-0 text-right">
        {/* Source email account badge */}
        <span className="text-[10px] font-medium text-slate-400 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded">
          {email.accountProvider === 'microsoft' ? 'Outlook' : 'Gmail'}
          {email.accountEmail ? ` · ${email.accountEmail.split('@')[0]}` : ''}
        </span>

        {/* Date */}
        <span
          className="text-xs text-slate-400 whitespace-nowrap font-mono"
          title={formatExactTimestamp(email.receivedAt)}
        >
          {formatEmailDate(email.receivedAt)}
        </span>
      </div>
    </div>
  );
}
