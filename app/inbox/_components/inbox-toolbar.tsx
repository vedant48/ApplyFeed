'use client';

import React, { useState } from 'react';
import {
  Search,
  Calendar,
  Filter,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  X,
  Check,
  Building2,
  Mail,
} from 'lucide-react';
import { DatePreset, InboxFilterState } from '../types';

interface AccountOption {
  id: string;
  email: string;
  provider: string;
}

interface InboxToolbarProps {
  filter: InboxFilterState;
  onFilterChange: (updates: Partial<InboxFilterState>) => void;
  accounts: AccountOption[];
  onSyncAll: () => void;
  isSyncing: boolean;
  syncSummary?: string | null;
  onOpenDiagnostics?: () => void;
  hasSyncStats?: boolean;
}

export default function InboxToolbar({
  filter,
  onFilterChange,
  accounts,
  onSyncAll,
  isSyncing,
  syncSummary,
  onOpenDiagnostics,
  hasSyncStats,
}: InboxToolbarProps) {
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false);
  const [customFromInput, setCustomFromInput] = useState(filter.customFrom || '');
  const [customToInput, setCustomToInput] = useState(filter.customTo || '');
  const [dateError, setDateError] = useState<string | null>(null);

  const datePresetLabels: Record<DatePreset, string> = {
    all: 'All time',
    today: 'Today',
    yesterday: 'Yesterday',
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    '90d': 'Last 90 days',
    year: 'This year',
    custom: filter.customFrom && filter.customTo ? `${filter.customFrom} - ${filter.customTo}` : 'Custom range',
  };

  const categories = [
    { value: 'all', label: 'All categories' },
    { value: 'APPLICATION', label: 'Application' },
    { value: 'APPLICATION_RECEIVED', label: 'Application received' },
    { value: 'RECRUITER', label: 'Recruiter' },
    { value: 'ASSESSMENT', label: 'Assessment' },
    { value: 'INTERVIEW', label: 'Interview' },
    { value: 'INTERVIEW_SCHEDULE', label: 'Interview schedule' },
    { value: 'OFFER', label: 'Offer' },
    { value: 'REJECTION', label: 'Rejection' },
    { value: 'FOLLOW_UP', label: 'Follow up' },
    { value: 'OTHER_JOB', label: 'Other job' },
  ];

  const handleApplyCustomDate = () => {
    if (!customFromInput || !customToInput) {
      setDateError('Please enter both From and To dates');
      return;
    }
    if (new Date(customFromInput) > new Date(customToInput)) {
      setDateError('From date cannot be after To date');
      return;
    }
    setDateError(null);
    onFilterChange({
      datePreset: 'custom',
      customFrom: customFromInput,
      customTo: customToInput,
      page: 1,
    });
    setIsCustomDateOpen(false);
  };

  return (
    <div className="space-y-2">
      {/* Compact Toolbar Row */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 shadow-sm">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={filter.search}
              onChange={(e) => onFilterChange({ search: e.target.value, page: 1 })}
              placeholder="Search company, role, subject..."
              className="h-8 w-full rounded-md border border-slate-700/80 bg-slate-950 pl-8 pr-7 text-xs text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
            />
            {filter.search && (
              <button
                onClick={() => onFilterChange({ search: '', page: 1 })}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Date Filter Dropdown */}
          <div className="relative">
            <select
              value={filter.datePreset}
              onChange={(e) => {
                const val = e.target.value as DatePreset;
                if (val === 'custom') {
                  setIsCustomDateOpen(true);
                } else {
                  setIsCustomDateOpen(false);
                  onFilterChange({ datePreset: val, page: 1 });
                }
              }}
              className="h-8 appearance-none rounded-md border border-slate-700/80 bg-slate-950 px-2.5 pr-7 text-xs font-medium text-slate-300 hover:border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">Date: All time</option>
              <option value="today">Date: Today</option>
              <option value="yesterday">Date: Yesterday</option>
              <option value="7d">Date: Last 7 days</option>
              <option value="30d">Date: Last 30 days</option>
              <option value="90d">Date: Last 90 days</option>
              <option value="year">Date: This year</option>
              <option value="custom">Date: Custom range...</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          </div>

          {/* Account Filter Dropdown */}
          <div className="relative">
            <select
              value={filter.accountId}
              onChange={(e) => onFilterChange({ accountId: e.target.value, page: 1 })}
              className="h-8 appearance-none rounded-md border border-slate-700/80 bg-slate-950 px-2.5 pr-7 text-xs font-medium text-slate-300 hover:border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer max-w-[180px] truncate"
            >
              <option value="all">Account: All accounts</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.email} ({acc.provider === 'gmail' ? 'Gmail' : 'Outlook'})
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          </div>

          {/* Category Filter Dropdown */}
          <div className="relative">
            <select
              value={filter.category}
              onChange={(e) => onFilterChange({ category: e.target.value, page: 1 })}
              className="h-8 appearance-none rounded-md border border-slate-700/80 bg-slate-950 px-2.5 pr-7 text-xs font-medium text-slate-300 hover:border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.value === 'all' ? 'Category: All' : cat.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          </div>

          {/* Needs Attention Toggle */}
          <button
            type="button"
            onClick={() => onFilterChange({ needsAttention: !filter.needsAttention, page: 1 })}
            className={`flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-medium border transition-colors ${
              filter.needsAttention
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                : 'bg-slate-950 border-slate-700/80 text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            <AlertCircle className={`h-3.5 w-3.5 ${filter.needsAttention ? 'text-amber-400' : 'text-slate-500'}`} />
            <span>Needs attention</span>
          </button>
        </div>

        {/* Global Sync and Diagnostics Buttons */}
        <div className="flex items-center gap-2 self-end lg:self-auto">
          {onOpenDiagnostics && (
            <button
              type="button"
              onClick={onOpenDiagnostics}
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-medium border border-slate-700/80 bg-slate-950 text-slate-300 hover:text-white hover:border-slate-600 transition-colors shadow-sm"
              title="View how ApplyFeed scanned and filtered your mailboxes"
            >
              <Filter className="h-3.5 w-3.5 text-blue-400" />
              <span>Filter Diagnostics</span>
            </button>
          )}

          <button
            type="button"
            onClick={onSyncAll}
            disabled={isSyncing}
            className={`flex items-center gap-2 h-8 px-3.5 rounded-md text-xs font-semibold transition-all shadow-sm ${
              isSyncing
                ? 'bg-blue-800 text-slate-300 cursor-not-allowed opacity-75'
                : 'bg-blue-600 text-white hover:bg-blue-500 active:bg-blue-700'
            }`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncSummary && (
        <div className="flex items-center justify-between text-xs py-2 px-3 rounded-md bg-blue-950/40 border border-blue-900/60 text-blue-200">
          <div className="flex items-center gap-2">
            <Check className="h-3.5 w-3.5 text-blue-400 shrink-0" />
            <span>{syncSummary}</span>
          </div>
          {onOpenDiagnostics && (
            <button
              type="button"
              onClick={onOpenDiagnostics}
              className="text-blue-400 hover:text-blue-300 underline font-medium text-xs ml-3 shrink-0"
            >
              View filter breakdown &rarr;
            </button>
          )}
        </div>
      )}

      {/* Custom Date Range Popover/Modal */}
      {isCustomDateOpen && (
        <div className="p-3 rounded-lg border border-slate-700 bg-slate-900 shadow-xl max-w-sm space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-blue-400" />
              Custom Date Range
            </h4>
            <button
              onClick={() => setIsCustomDateOpen(false)}
              className="text-slate-500 hover:text-slate-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-medium text-slate-400 block mb-1">From</label>
              <input
                type="date"
                value={customFromInput}
                onChange={(e) => setCustomFromInput(e.target.value)}
                className="h-8 w-full rounded border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-slate-400 block mb-1">To</label>
              <input
                type="date"
                value={customToInput}
                onChange={(e) => setCustomToInput(e.target.value)}
                className="h-8 w-full rounded border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {dateError && (
            <p className="text-[11px] text-red-400">{dateError}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsCustomDateOpen(false)}
              className="h-7 px-2.5 rounded text-xs text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyCustomDate}
              className="h-7 px-3 rounded bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white"
            >
              Apply Range
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
