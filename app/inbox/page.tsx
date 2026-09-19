'use client';

import React, { Suspense, useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Inbox as InboxIcon } from 'lucide-react';
import InboxToolbar from './_components/inbox-toolbar';
import ActiveFilterChips from './_components/active-filter-chips';
import EmailRow from './_components/email-row';
import EmailDetailDrawer from './_components/email-detail-drawer';
import EmptyState from './_components/empty-state';
import { DatePreset, InboxFilterState, EmailDetailData } from './types';
import { calculateDateRangeFromPreset } from '@/lib/date-utils';
import { EmailWithAccount } from '@/lib/db/repository';
import SyncDiagnosticsModal from '@/components/sync-diagnostics-modal';
import { FilterStats } from '@/lib/email/types';

function InboxContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Diagnostics Modal State
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [diagnosticsStats, setDiagnosticsStats] = useState<FilterStats | null>(null);
  const [diagnosticsAccountEmail, setDiagnosticsAccountEmail] = useState<string>('');
  const [diagnosticsDateRange, setDiagnosticsDateRange] = useState<string>('');

  // Hydrate latest sync stats from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('applyfeed_latest_sync_stats');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.stats) {
          setDiagnosticsStats(parsed.stats);
          setDiagnosticsAccountEmail(parsed.accountEmail || '');
          setDiagnosticsDateRange(parsed.dateRangeLabel || '');
        }
      }
    } catch (e) {}
  }, []);

  // Parse initial filters from URL params
  const initialFilter: InboxFilterState = useMemo(() => {
    return {
      search: searchParams.get('search') || '',
      datePreset: (searchParams.get('date') as DatePreset) || 'all',
      customFrom: searchParams.get('from') || undefined,
      customTo: searchParams.get('to') || undefined,
      accountId: searchParams.get('account') || 'all',
      category: searchParams.get('category') || 'all',
      needsAttention: searchParams.get('needsAttention') === 'true',
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: 20,
    };
  }, [searchParams]);

  const [filter, setFilter] = useState<InboxFilterState>(initialFilter);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(
    searchParams.get('selected') || null
  );
  const [syncSummary, setSyncSummary] = useState<string | null>(null);

  // Sync state to URL params cleanly
  const updateUrlParams = useCallback((newFilter: InboxFilterState, selectedId: string | null) => {
    const params = new URLSearchParams();
    if (newFilter.search) params.set('search', newFilter.search);
    if (newFilter.datePreset !== 'all') params.set('date', newFilter.datePreset);
    if (newFilter.datePreset === 'custom') {
      if (newFilter.customFrom) params.set('from', newFilter.customFrom);
      if (newFilter.customTo) params.set('to', newFilter.customTo);
    }
    if (newFilter.accountId !== 'all') params.set('account', newFilter.accountId);
    if (newFilter.category !== 'all') params.set('category', newFilter.category);
    if (newFilter.needsAttention) params.set('needsAttention', 'true');
    if (newFilter.page > 1) params.set('page', String(newFilter.page));
    if (selectedId) params.set('selected', selectedId);

    const queryStr = params.toString();
    const newPath = queryStr ? `/inbox?${queryStr}` : '/inbox';
    router.replace(newPath, { scroll: false });
  }, [router]);

  const handleFilterChange = (updates: Partial<InboxFilterState>) => {
    setFilter((prev) => {
      const next = { ...prev, ...updates };
      updateUrlParams(next, selectedEmailId);
      return next;
    });
  };

  // Fetch Accounts
  const { data: accountsData } = useQuery({
    queryKey: ['email-accounts'],
    queryFn: async () => {
      const res = await fetch('/api/email/accounts');
      if (!res.ok) throw new Error('Failed to load accounts');
      return res.json();
    },
  });

  const accounts = useMemo(() => accountsData?.accounts || [], [accountsData]);

  // Compute calculated from / to dates for backend query
  const dateBoundaries = useMemo(() => {
    return calculateDateRangeFromPreset(
      filter.datePreset,
      filter.customFrom,
      filter.customTo
    );
  }, [filter.datePreset, filter.customFrom, filter.customTo]);

  // Fetch Emails
  const {
    data: emailsData,
    isLoading: isEmailsLoading,
    refetch: refetchEmails,
  } = useQuery({
    queryKey: [
      'emails',
      filter.search,
      filter.datePreset,
      dateBoundaries.from,
      dateBoundaries.to,
      filter.accountId,
      filter.category,
      filter.needsAttention,
      filter.page,
      filter.limit,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter.search) params.set('search', filter.search);
      if (dateBoundaries.from) params.set('from', dateBoundaries.from);
      if (dateBoundaries.to) params.set('to', dateBoundaries.to);
      if (filter.accountId !== 'all') params.set('account', filter.accountId);
      if (filter.category !== 'all') params.set('category', filter.category);
      if (filter.needsAttention) params.set('needsAttention', 'true');
      params.set('page', String(filter.page));
      params.set('limit', String(filter.limit));

      const res = await fetch(`/api/emails?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load emails');
      return res.json();
    },
  });

  const emails: EmailWithAccount[] = emailsData?.emails || [];
  const totalEmails: number = emailsData?.total || 0;
  const totalPages: number = emailsData?.totalPages || 1;

  // Selected Email Detail Query
  const { data: selectedEmailDetail } = useQuery<EmailDetailData | null>({
    queryKey: ['email-detail', selectedEmailId],
    queryFn: async () => {
      if (!selectedEmailId) return null;
      const res = await fetch(`/api/emails/${selectedEmailId}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.email;
    },
    enabled: !!selectedEmailId,
  });

  // Global Sync Mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/email/sync', { method: 'POST' });
      if (!res.ok) throw new Error('Sync failed');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
      if (data.totalStats) {
        setDiagnosticsStats(data.totalStats);
        setDiagnosticsAccountEmail('All Accounts');
        setDiagnosticsDateRange('Recent sync');
        try {
          localStorage.setItem('applyfeed_latest_sync_stats', JSON.stringify({
            stats: data.totalStats,
            accountEmail: 'All Accounts',
            dateRangeLabel: 'Recent sync',
            timestamp: Date.now(),
          }));
        } catch (e) {}
      }
      setSyncSummary(
        `Synced ${data.accountsProcessed} account${
          data.accountsProcessed === 1 ? '' : 's'
        }. Scanned ${data.totalStats?.totalScanned || 0} emails • ${data.totalNewJobEmails} job email${
          data.totalNewJobEmails === 1 ? '' : 's'
        } indexed.`
      );
      setTimeout(() => setSyncSummary(null), 10000);
    },
  });

  // Mark Read/Unread Mutation
  const toggleReadMutation = useMutation({
    mutationFn: async ({ emailId, currentReadState }: { emailId: string; currentReadState: boolean }) => {
      const res = await fetch(`/api/emails/${emailId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: !currentReadState }),
      });
      if (!res.ok) throw new Error('Failed to update read state');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['email-detail', selectedEmailId] });
    },
  });

  const handleSelectEmail = (em: EmailWithAccount) => {
    setSelectedEmailId(em.id);
    updateUrlParams(filter, em.id);
    // Automatically mark as read when opened if unread
    if (!em.isRead) {
      toggleReadMutation.mutate({ emailId: em.id, currentReadState: false });
    }
  };

  const handleCloseDrawer = () => {
    setSelectedEmailId(null);
    updateUrlParams(filter, null);
  };

  const handleClearAllFilters = () => {
    const cleared: InboxFilterState = {
      search: '',
      datePreset: 'all',
      customFrom: undefined,
      customTo: undefined,
      accountId: 'all',
      category: 'all',
      needsAttention: false,
      page: 1,
      limit: 20,
    };
    setFilter(cleared);
    updateUrlParams(cleared, selectedEmailId);
  };

  const isFiltersActive =
    filter.search !== '' ||
    filter.datePreset !== 'all' ||
    filter.accountId !== 'all' ||
    filter.category !== 'all' ||
    filter.needsAttention;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      {/* Page Title & Count */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-100">Job Inbox</h1>
            {totalEmails > 0 && (
              <span className="text-xs font-mono font-medium text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full">
                {totalEmails}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Aggregated job-related emails across all your connected accounts.
          </p>
        </div>
      </div>

      {/* Main Filter Toolbar */}
      <InboxToolbar
        filter={filter}
        onFilterChange={handleFilterChange}
        accounts={accounts}
        onSyncAll={() => syncMutation.mutate()}
        isSyncing={syncMutation.isPending}
        syncSummary={syncSummary}
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
        hasSyncStats={!!diagnosticsStats}
      />

      {/* Active Filter Chips */}
      <ActiveFilterChips
        filter={filter}
        accounts={accounts}
        onRemoveFilter={(key, defaultVal) => handleFilterChange({ [key]: defaultVal, page: 1 })}
        onClearAll={handleClearAllFilters}
      />

      {/* Emails Table Container */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/60 overflow-hidden shadow-sm">
        {isEmailsLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading emails...</div>
        ) : accounts.length === 0 ? (
          <EmptyState type="no-accounts" />
        ) : emails.length === 0 ? (
          isFiltersActive ? (
            <EmptyState type="no-results" onClearFilters={handleClearAllFilters} />
          ) : (
            <EmptyState
              type="no-emails"
              onSync={() => syncMutation.mutate()}
              isSyncing={syncMutation.isPending}
            />
          )
        ) : (
          <div>
            {/* List Rows */}
            <div className="divide-y divide-slate-800/60">
              {emails.map((email) => (
                <EmailRow
                  key={email.id}
                  email={email}
                  isSelected={selectedEmailId === email.id}
                  onSelect={handleSelectEmail}
                />
              ))}
            </div>

            {/* Pagination Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900/50 border-t border-slate-800 text-xs text-slate-400">
              <div>
                Showing{' '}
                <span className="font-semibold text-slate-200">
                  {Math.min(totalEmails, (filter.page - 1) * filter.limit + 1)}
                </span>{' '}
                to{' '}
                <span className="font-semibold text-slate-200">
                  {Math.min(totalEmails, filter.page * filter.limit)}
                </span>{' '}
                of <span className="font-semibold text-slate-200">{totalEmails}</span> emails
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={filter.page <= 1}
                  onClick={() => handleFilterChange({ page: filter.page - 1 })}
                  className="flex items-center gap-1 h-7 px-2.5 rounded border border-slate-700 bg-slate-800 text-xs font-medium text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </button>

                <span className="text-xs text-slate-400 px-1 font-mono">
                  {filter.page} / {totalPages}
                </span>

                <button
                  type="button"
                  disabled={filter.page >= totalPages}
                  onClick={() => handleFilterChange({ page: filter.page + 1 })}
                  className="flex items-center gap-1 h-7 px-2.5 rounded border border-slate-700 bg-slate-800 text-xs font-medium text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Slide-out Email Detail Drawer */}
      <EmailDetailDrawer
        email={selectedEmailDetail || null}
        isOpen={!!selectedEmailId}
        onClose={handleCloseDrawer}
        onToggleRead={(id, current) => toggleReadMutation.mutate({ emailId: id, currentReadState: current })}
      />

      {/* Sync Diagnostics & Filter Transparency Modal */}
      <SyncDiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        stats={diagnosticsStats}
        accountEmail={diagnosticsAccountEmail}
        dateRangeLabel={diagnosticsDateRange}
      />
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading inbox...</div>}>
      <InboxContent />
    </Suspense>
  );
}
