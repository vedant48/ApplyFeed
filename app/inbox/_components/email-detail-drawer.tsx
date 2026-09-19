'use client';

import React from 'react';
import {
  X,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Mail,
  Building2,
  Calendar,
  User,
  Briefcase,
  Layers,
} from 'lucide-react';
import { EmailDetailData } from '../types';
import { formatExactTimestamp } from '@/lib/date-utils';

interface EmailDetailDrawerProps {
  email: EmailDetailData | null;
  isOpen: boolean;
  onClose: () => void;
  onToggleRead: (emailId: string, currentReadState: boolean) => void;
}

export default function EmailDetailDrawer({
  email,
  isOpen,
  onClose,
  onToggleRead,
}: EmailDetailDrawerProps) {
  if (!isOpen || !email) return null;

  const formattedCategory = email.category.replace(/_/g, ' ');

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-xl md:max-w-2xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col transition-transform duration-200 ease-in-out">
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60">
        <div className="flex items-center gap-2">
          {email.deepLink && (
            <a
              href={email.deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600/30 text-xs font-semibold transition-colors"
            >
              <span>{email.accountProvider === 'microsoft' ? 'Open in Outlook' : 'Open in Gmail'}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <button
            type="button"
            onClick={() => onToggleRead(email.id, email.isRead)}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded border border-slate-700 bg-slate-800 text-slate-300 hover:text-white text-xs font-medium transition-colors"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{email.isRead ? 'Mark as unread' : 'Mark as read'}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          title="Close email details"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Drawer Body (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Needs Attention Alert Banner */}
        {email.requiresAttention && (
          <div className="flex items-start gap-2.5 p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium">
            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Requires Attention:</span> This communication appears to require a response, time slot selection, or action.
            </div>
          </div>
        )}

        {/* Company & Subject */}
        <div>
          <div className="text-xs uppercase tracking-wider font-bold text-blue-400 mb-1">
            {email.company || 'Job Communication'}
          </div>
          <h2 className="text-lg font-bold text-slate-100 leading-snug">
            {email.subject}
          </h2>
        </div>

        {/* Sender & Account Metadata Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <User className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            <span className="truncate">
              <span className="text-slate-500">From:</span> {email.sender} &lt;{email.senderEmail}&gt;
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-300">
            <Mail className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            <span className="truncate">
              <span className="text-slate-500">Account:</span> {email.accountEmail || 'Connected Account'} ({email.accountProvider === 'microsoft' ? 'Outlook' : 'Gmail'})
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-300">
            <Calendar className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            <span className="font-mono text-slate-300">
              <span className="text-slate-500 font-sans">Received:</span> {formatExactTimestamp(email.receivedAt)}
            </span>
          </div>
        </div>

        {/* Detected Intelligence Grid */}
        <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/40 space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Identified Details
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
              <div className="text-[10px] text-slate-500">Company</div>
              <div className="font-semibold text-slate-200 truncate">{email.company || '—'}</div>
            </div>

            <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
              <div className="text-[10px] text-slate-500">Role</div>
              <div className="font-semibold text-slate-200 truncate">{email.role || '—'}</div>
            </div>

            <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
              <div className="text-[10px] text-slate-500">Platform</div>
              <div className="font-semibold text-slate-200 truncate">{email.platform || 'Unknown'}</div>
            </div>

            <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
              <div className="text-[10px] text-slate-500">Category</div>
              <div className="font-semibold text-slate-200 uppercase text-[11px] truncate">
                {formattedCategory}
              </div>
            </div>
          </div>
        </div>

        {/* Full Email Message Content */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Email Content
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/90 p-4 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed font-sans select-text">
            {email.bodyText || email.snippet}
          </div>
        </div>
      </div>
    </div>
  );
}
