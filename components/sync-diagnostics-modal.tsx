'use client';

import React from 'react';
import {
  X,
  Filter,
  CheckCircle2,
  ShieldCheck,
  ShoppingCart,
  Key,
  Megaphone,
  Briefcase,
  Layers,
  ArrowRight,
  Info,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { FilterStats } from '@/lib/email/types';

interface SyncDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats?: FilterStats | null;
  accountEmail?: string;
  dateRangeLabel?: string;
}

export default function SyncDiagnosticsModal({
  isOpen,
  onClose,
  stats,
  accountEmail,
  dateRangeLabel,
}: SyncDiagnosticsModalProps) {
  if (!isOpen) return null;

  // Fallback defaults if opened without fresh stats
  const activeStats: FilterStats = stats || {
    discovered: 0,
    fetched: 0,
    processed: 0,
    jobRelated: 0,
    uncertain: 0,
    nonJob: 0,
    errors: 0,
    totalScanned: 0,
    filteredOutDeterministic: 0,
    evaluatedByClassifier: 0,
    jobEmailsSaved: 0,
    duplicateOrSkipped: 0,
    nonJobBreakdown: {
      receiptsAndPurchases: 0,
      securityAndOtp: 0,
      generalMarketingAndSocial: 0,
      otherNonJob: 0,
    },
    jobCategoryBreakdown: {},
  };

  const totalNonJob =
    activeStats.filteredOutDeterministic +
    (activeStats.nonJobBreakdown?.otherNonJob || 0);

  const categoryLabels: Record<string, string> = {
    INTERVIEW: 'Interview Invitations',
    INTERVIEW_SCHEDULE: 'Interview Scheduling & Slots',
    APPLICATION_RECEIVED: 'Application Confirmations',
    APPLICATION: 'Application Updates',
    ASSESSMENT: 'Coding & Take-home Tests',
    RECRUITER: 'Recruiter Reachouts',
    OFFER: 'Job Offers',
    REJECTION: 'Rejection Notices',
    FOLLOW_UP: 'Status Follow-ups',
    OTHER_JOB: 'Other Job Correspondence',
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Filter className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Sync Diagnostics & Filter Transparency
              </h3>
              <p className="text-xs text-slate-400">
                {accountEmail ? `Account: ${accountEmail}` : 'All Connected Mailboxes'}
                {dateRangeLabel ? ` • Window: ${dateRangeLabel}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-md hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Summary Callout */}
          <div className="flex items-start gap-3 p-3.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200 leading-relaxed">
            <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-blue-100">Why only job emails appear: </span>
              ApplyFeed is strictly a <span className="underline font-medium">job-email aggregator</span>. It
              scans your mailbox, strips out thousands of shopping receipts, OTPs, promotional newsletters,
              and banking alerts, and indexes only confirmed job applications, interview invites, coding
              assessments, and recruiter reachouts.
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5">
              Mailbox Scan & Ingestion Counters
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {/* Discovered */}
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 flex flex-col justify-between">
                <span className="text-[11px] font-medium text-slate-400">Discovered</span>
                <span className="text-2xl font-bold font-mono text-slate-100 mt-1">
                  {activeStats.discovered ?? activeStats.totalScanned}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5">in date window</span>
              </div>

              {/* Processed */}
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 flex flex-col justify-between">
                <span className="text-[11px] font-medium text-slate-400">Processed</span>
                <span className="text-2xl font-bold font-mono text-blue-400 mt-1">
                  {activeStats.processed ?? activeStats.totalScanned}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5">MIME parsed</span>
              </div>

              {/* Job Related */}
              <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-950/20 flex flex-col justify-between">
                <span className="text-[11px] font-medium text-emerald-400">Job Inbox</span>
                <span className="text-2xl font-bold font-mono text-emerald-300 mt-1">
                  {activeStats.jobRelated ?? activeStats.jobEmailsSaved}
                </span>
                <span className="text-[10px] text-emerald-500/80 mt-0.5">classification = JOB</span>
              </div>

              {/* Uncertain */}
              <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-950/20 flex flex-col justify-between">
                <span className="text-[11px] font-medium text-amber-400">Uncertain</span>
                <span className="text-2xl font-bold font-mono text-amber-300 mt-1">
                  {activeStats.uncertain ?? 0}
                </span>
                <span className="text-[10px] text-amber-500/80 mt-0.5">requires review</span>
              </div>

              {/* Non-Job */}
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 flex flex-col justify-between">
                <span className="text-[11px] font-medium text-slate-400">Non-Job</span>
                <span className="text-2xl font-bold font-mono text-slate-400 mt-1">
                  {activeStats.nonJob ?? totalNonJob}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5">receipts / OTP / promo</span>
              </div>
            </div>
          </div>

          {/* Non-Job Filter Breakdown */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Non-Job Filter Breakdown (Eliminated)</span>
              <span className="text-[10px] font-mono text-slate-500 font-normal">
                {totalNonJob} emails skipped
              </span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/40 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded bg-slate-800 text-slate-400">
                    <ShoppingCart className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-300">Shopping & Receipts</div>
                    <div className="text-[10px] text-slate-500">Amazon, Uber, Swiggy, invoices</div>
                  </div>
                </div>
                <span className="font-mono font-semibold text-slate-200">
                  {activeStats.nonJobBreakdown?.receiptsAndPurchases || 0}
                </span>
              </div>

              <div className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/40 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded bg-slate-800 text-slate-400">
                    <Key className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-300">Security & OTP Codes</div>
                    <div className="text-[10px] text-slate-500">2FA, verification codes, logins</div>
                  </div>
                </div>
                <span className="font-mono font-semibold text-slate-200">
                  {activeStats.nonJobBreakdown?.securityAndOtp || 0}
                </span>
              </div>

              <div className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/40 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded bg-slate-800 text-slate-400">
                    <Megaphone className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-300">Marketing & Newsletters</div>
                    <div className="text-[10px] text-slate-500">Medium, Spotify, promotions</div>
                  </div>
                </div>
                <span className="font-mono font-semibold text-slate-200">
                  {activeStats.nonJobBreakdown?.generalMarketingAndSocial || 0}
                </span>
              </div>

              <div className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/40 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded bg-slate-800 text-slate-400">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-300">Other Non-Job</div>
                    <div className="text-[10px] text-slate-500">Conversations, social updates</div>
                  </div>
                </div>
                <span className="font-mono font-semibold text-slate-200">
                  {activeStats.nonJobBreakdown?.otherNonJob || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Job Emails Category Breakdown */}
          {activeStats.jobCategoryBreakdown && Object.keys(activeStats.jobCategoryBreakdown).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5 text-emerald-400" />
                  Job Emails Categorized ({activeStats.jobEmailsSaved})
                </span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {Object.entries(activeStats.jobCategoryBreakdown).map(([cat, count]) => (
                  <div
                    key={cat}
                    className="p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-950/10 flex items-center justify-between"
                  >
                    <span className="font-medium text-emerald-200">
                      {categoryLabels[cat] || cat}
                    </span>
                    <span className="font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* How Filtering Works Explanation */}
          <div className="p-4 rounded-lg border border-slate-800 bg-slate-950/70 space-y-3">
            <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-blue-400" />
              How ApplyFeed Filters Your Mailbox
            </h4>
            <div className="space-y-2 text-[11px] text-slate-400">
              <div className="flex items-start gap-2">
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-mono shrink-0 mt-0.5">
                  1
                </span>
                <span>
                  <strong className="text-slate-300">Mailbox Query: </strong>
                  Fetches emails in your date range using read-only API with <code className="text-slate-300">-in:trash -in:spam</code> (scanning Primary, Updates, and Promotions tabs).
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-mono shrink-0 mt-0.5">
                  2
                </span>
                <span>
                  <strong className="text-slate-300">Deterministic Pre-Filter: </strong>
                  Instantly skips known non-job emails (shopping orders, OTPs, newsletters) to optimize performance and privacy.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-mono shrink-0 mt-0.5">
                  3
                </span>
                <span>
                  <strong className="text-slate-300">Deterministic Evidence Engine: </strong>
                  Analyzes candidate emails for ATS platform signatures (Greenhouse, Lever, Ashby, Workday), scheduling tools (Calendly, GoodTime), coding assessments, and recruiter signals with 100% explainability and zero AI/LLM.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-mono shrink-0 mt-0.5">
                  4
                </span>
                <span>
                  <strong className="text-slate-300">3-State Classification & Aggregator: </strong>
                  Classifies messages as JOB, UNCERTAIN, or NOT_JOB. Preserves all synced records so rules can be refined without downloading mailboxes again.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Read-only aggregator • Mailbox is never modified</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-4 rounded-md bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
