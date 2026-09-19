'use client';

import React from 'react';
import { X } from 'lucide-react';
import { InboxFilterState } from '../types';

interface AccountOption {
  id: string;
  email: string;
  provider: string;
}

interface ActiveFilterChipsProps {
  filter: InboxFilterState;
  accounts: AccountOption[];
  onRemoveFilter: (key: keyof InboxFilterState, defaultValue?: any) => void;
  onClearAll: () => void;
}

export default function ActiveFilterChips({
  filter,
  accounts,
  onRemoveFilter,
  onClearAll,
}: ActiveFilterChipsProps) {
  const chips: Array<{ id: string; label: string; onRemove: () => void }> = [];

  // Search chip
  if (filter.search) {
    chips.push({
      id: 'search',
      label: `"${filter.search}"`,
      onRemove: () => onRemoveFilter('search', ''),
    });
  }

  // Date chip
  if (filter.datePreset !== 'all') {
    let dateLabel: string = filter.datePreset;
    if (filter.datePreset === 'today') dateLabel = 'Today';
    else if (filter.datePreset === 'yesterday') dateLabel = 'Yesterday';
    else if (filter.datePreset === '7d') dateLabel = 'Last 7 days';
    else if (filter.datePreset === '30d') dateLabel = 'Last 30 days';
    else if (filter.datePreset === '90d') dateLabel = 'Last 90 days';
    else if (filter.datePreset === 'year') dateLabel = 'This year';
    else if (filter.datePreset === 'custom') dateLabel = `${filter.customFrom || ''} to ${filter.customTo || ''}`;

    chips.push({
      id: 'date',
      label: `Date: ${dateLabel}`,
      onRemove: () => onRemoveFilter('datePreset', 'all'),
    });
  }

  // Account chip
  if (filter.accountId !== 'all') {
    const matchedAccount = accounts.find((a) => a.id === filter.accountId);
    const accountLabel = matchedAccount
      ? `${matchedAccount.email} (${matchedAccount.provider === 'gmail' ? 'Gmail' : 'Outlook'})`
      : 'Selected account';

    chips.push({
      id: 'account',
      label: accountLabel,
      onRemove: () => onRemoveFilter('accountId', 'all'),
    });
  }

  // Category chip
  if (filter.category !== 'all') {
    const categoryName = filter.category.replace(/_/g, ' ').toLowerCase();
    const formatted = categoryName.charAt(0).toUpperCase() + categoryName.slice(1);
    chips.push({
      id: 'category',
      label: formatted,
      onRemove: () => onRemoveFilter('category', 'all'),
    });
  }

  // Needs attention chip
  if (filter.needsAttention) {
    chips.push({
      id: 'needsAttention',
      label: 'Needs attention',
      onRemove: () => onRemoveFilter('needsAttention', false),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
      <span className="text-slate-500 font-medium mr-1 text-[11px]">Active:</span>
      {chips.map((chip) => (
        <span
          key={chip.id}
          className="inline-flex items-center gap-1 rounded bg-slate-800/90 border border-slate-700/80 px-2 py-0.5 text-xs text-slate-300 font-medium"
        >
          <span>{chip.label}</span>
          <button
            onClick={chip.onRemove}
            className="text-slate-400 hover:text-slate-100 transition-colors p-0.5 rounded-full hover:bg-slate-700"
            title="Remove filter"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <button
        onClick={onClearAll}
        className="text-[11px] text-blue-400 hover:text-blue-300 ml-1.5 font-medium hover:underline transition-colors"
      >
        Clear all
      </button>
    </div>
  );
}
