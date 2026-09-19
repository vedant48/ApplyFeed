'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Mail,
  RefreshCw,
  History,
  Trash2,
  Plus,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  Calendar,
  X,
  Filter,
} from 'lucide-react';
import { formatTimeAgo, formatExactTimestamp } from '@/lib/date-utils';
import { subDays, subYears, format } from 'date-fns';
import SyncDiagnosticsModal from '@/components/sync-diagnostics-modal';
import { FilterStats } from '@/lib/email/types';

interface EmailAccountItem {
  id: string;
  provider: 'gmail' | 'microsoft';
  email: string;
  status: 'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR' | 'AUTH_EXPIRED';
  lastSyncedAt?: string | null;
  lastError?: string | null;
  createdAt: string;
}

export default function EmailAccountsPage() {
  const queryClient = useQueryClient();

  // Modals state
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [connectProvider, setConnectProvider] = useState<'gmail' | 'microsoft'>('gmail');
  const [connectEmailInput, setConnectEmailInput] = useState('');

  const [historyModalAccount, setHistoryModalAccount] = useState<EmailAccountItem | null>(null);
  const [historyPreset, setHistoryPreset] = useState<'30d' | '90d' | '1y' | 'custom'>('30d');
  const [historyFromInput, setHistoryFromInput] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [historyToInput, setHistoryToInput] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [historyStatusMessage, setHistoryStatusMessage] = useState<string | null>(null);

  // Diagnostics Modal State
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [diagnosticsStats, setDiagnosticsStats] = useState<FilterStats | null>(null);
  const [diagnosticsAccountEmail, setDiagnosticsAccountEmail] = useState<string>('');
  const [diagnosticsDateRange, setDiagnosticsDateRange] = useState<string>('');

  // Hydrate diagnostics from localStorage if available
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

  // Fetch Accounts
  const { data, isLoading } = useQuery<{ accounts: EmailAccountItem[] }>({
    queryKey: ['email-accounts'],
    queryFn: async () => {
      const res = await fetch('/api/email/accounts');
      if (!res.ok) throw new Error('Failed to load email accounts');
      return res.json();
    },
  });

  const accounts = data?.accounts || [];

  // Per-account Sync Mutation
  const syncAccountMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const res = await fetch(`/api/email/accounts/${accountId}/sync`, { method: 'POST' });
      if (!res.ok) throw new Error('Sync failed');
      return res.json();
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      if (resData.stats) {
        setDiagnosticsStats(resData.stats);
        setDiagnosticsAccountEmail(resData.accountEmail || '');
        setDiagnosticsDateRange('Recent sync');
        setIsDiagnosticsOpen(true);
        try {
          localStorage.setItem('applyfeed_latest_sync_stats', JSON.stringify({
            stats: resData.stats,
            accountEmail: resData.accountEmail || '',
            dateRangeLabel: 'Recent sync',
            timestamp: Date.now(),
          }));
        } catch (e) {}
      }
    },
  });

  // Historical Sync Mutation
  const syncHistoryMutation = useMutation({
    mutationFn: async ({ accountId, from, to }: { accountId: string; from: string; to: string }) => {
      const res = await fetch(`/api/email/accounts/${accountId}/sync-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to }),
      });
      if (!res.ok) throw new Error('Historical sync failed');
      return res.json();
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      setHistoryStatusMessage(`Historical scan complete. Found ${resData.newEmailsFound || 0} job emails.`);

      const rangeLabel =
        historyPreset === '30d'
          ? 'Last 30 days'
          : historyPreset === '90d'
          ? 'Last 90 days (3 months)'
          : historyPreset === '1y'
          ? 'Last 1 year'
          : `${historyFromInput} to ${historyToInput}`;

      if (resData.stats) {
        setDiagnosticsStats(resData.stats);
        setDiagnosticsAccountEmail(resData.accountEmail || historyModalAccount?.email || '');
        setDiagnosticsDateRange(rangeLabel);
        try {
          localStorage.setItem('applyfeed_latest_sync_stats', JSON.stringify({
            stats: resData.stats,
            accountEmail: resData.accountEmail || historyModalAccount?.email || '',
            dateRangeLabel: rangeLabel,
            timestamp: Date.now(),
          }));
        } catch (e) {}
      }

      setTimeout(() => {
        setHistoryModalAccount(null);
        setHistoryStatusMessage(null);
        if (resData.stats) {
          setIsDiagnosticsOpen(true);
        }
      }, 1500);
    },
  });

  // Disconnect Account Mutation
  const disconnectMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const res = await fetch(`/api/email/accounts/${accountId}/disconnect`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to disconnect account');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['emails'] });
    },
  });

  // Connect Account Mutation
  const connectMutation = useMutation({
    mutationFn: async ({ provider, email }: { provider: 'gmail' | 'microsoft'; email: string }) => {
      const res = await fetch('/api/email/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, email }),
      });
      if (!res.ok) throw new Error('Failed to connect account');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
      setIsConnectModalOpen(false);
      setConnectEmailInput('');
    },
  });

  const handleOpenHistoryModal = (acc: EmailAccountItem) => {
    setHistoryModalAccount(acc);
    setHistoryPreset('30d');
    setHistoryFromInput(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
    setHistoryToInput(format(new Date(), 'yyyy-MM-dd'));
    setHistoryStatusMessage(null);
  };

  const handleStartHistorySync = () => {
    if (!historyModalAccount) return;
    let from = historyFromInput;
    const to = historyToInput;

    if (historyPreset === '30d') {
      from = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    } else if (historyPreset === '90d') {
      from = format(subDays(new Date(), 90), 'yyyy-MM-dd');
    } else if (historyPreset === '1y') {
      from = format(subYears(new Date(), 1), 'yyyy-MM-dd');
    }

    syncHistoryMutation.mutate({ accountId: historyModalAccount.id, from, to });
  };

  const handleConnectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectEmailInput.trim()) return;
    connectMutation.mutate({ provider: connectProvider, email: connectEmailInput.trim() });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">
            Email Accounts
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage connected email accounts. Job-related emails will be aggregated into your unified Job Inbox.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setIsDiagnosticsOpen(true)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors"
          >
            <Filter className="h-3.5 w-3.5 text-blue-400" />
            <span>Filter Diagnostics</span>
          </button>

          <button
            type="button"
            onClick={() => setIsConnectModalOpen(true)}
            className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Connect email</span>
          </button>
        </div>
      </div>

      {/* Privacy Guarantee Card */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-300">
        <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-slate-100">Read-Only Privacy Guarantee</div>
          <p className="text-slate-400 leading-relaxed">
            Your email accounts are connected with strictly read-only permissions. ApplyFeed only scans for job-related messages. We never store mailbox passwords, and we never send, reply, archive, delete, or modify your emails.
          </p>
        </div>
      </div>

      {/* Connected Accounts List */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Connected Mailboxes ({accounts.length})
        </h2>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading accounts...</div>
        ) : accounts.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-8 text-center space-y-3">
            <Mail className="w-8 h-8 text-slate-500 mx-auto" />
            <p className="text-xs text-slate-400">No email accounts connected yet.</p>
            <button
              onClick={() => setIsConnectModalOpen(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white"
            >
              <Plus className="h-3.5 w-3.5" /> Connect your first account
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {accounts.map((acc) => {
              const isSyncingThis = syncAccountMutation.isPending && syncAccountMutation.variables === acc.id;

              return (
                <div
                  key={acc.id}
                  className="flex flex-col justify-between p-4 rounded-lg border border-slate-800 bg-slate-900/60 space-y-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded bg-slate-800 border border-slate-700/80 flex items-center justify-center text-xs font-bold text-slate-200 shrink-0">
                        {acc.provider === 'gmail' ? 'G' : 'O'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-200">
                            {acc.provider === 'gmail' ? 'Gmail' : 'Microsoft Outlook'}
                          </span>
                          {acc.status === 'SUCCESS' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                              Connected
                            </span>
                          )}
                          {acc.status === 'SYNCING' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-400 bg-blue-500/10 px-1.5 py-0.2 rounded border border-blue-500/20">
                              Syncing...
                            </span>
                          )}
                          {acc.status === 'ERROR' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-rose-400 bg-rose-500/10 px-1.5 py-0.2 rounded border border-rose-500/20">
                              Sync failed
                            </span>
                          )}
                          {acc.status === 'AUTH_EXPIRED' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                              Auth expired
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">{acc.email}</div>
                      </div>
                    </div>
                  </div>

                  {/* Sync Timestamps */}
                  <div className="text-[11px] text-slate-400 space-y-0.5 pt-1 border-t border-slate-800/80">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Last synced:</span>
                      <span className="font-medium text-slate-300">
                        {formatTimeAgo(acc.lastSyncedAt)}
                      </span>
                    </div>
                    {acc.lastSyncedAt && (
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>Exact timestamp:</span>
                        <span>{formatExactTimestamp(acc.lastSyncedAt)}</span>
                      </div>
                    )}
                    {diagnosticsStats && (
                      <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-800/40">
                        <span className="text-slate-400">Scan stats:</span>
                        <button
                          type="button"
                          onClick={() => {
                            setDiagnosticsAccountEmail(acc.email);
                            setIsDiagnosticsOpen(true);
                          }}
                          className="text-blue-400 hover:text-blue-300 font-medium underline flex items-center gap-1"
                        >
                          <span>{diagnosticsStats.totalScanned} scanned • {diagnosticsStats.jobEmailsSaved} job emails</span>
                          <span>(breakdown)</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => syncAccountMutation.mutate(acc.id)}
                        disabled={isSyncingThis || acc.status === 'SYNCING'}
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-xs font-medium text-slate-200 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={`h-3 w-3 ${isSyncingThis ? 'animate-spin' : ''}`} />
                        <span>Sync now</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenHistoryModal(acc)}
                        className="inline-flex items-center gap-1 h-7 px-2 rounded bg-slate-800/60 hover:bg-slate-700/60 border border-slate-800 text-xs font-medium text-slate-300 transition-colors"
                      >
                        <History className="h-3 w-3 text-slate-400" />
                        <span>Sync history</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Disconnect ${acc.email}? Previously imported emails will remain.`)) {
                          disconnectMutation.mutate(acc.id);
                        }
                      }}
                      className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Disconnect account"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Disconnect</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Connect Account Modal */}
      {isConnectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-400" />
                Connect Email Account
              </h3>
              <button
                onClick={() => setIsConnectModalOpen(false)}
                className="text-slate-500 hover:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConnectSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 block">Select Provider</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConnectProvider('gmail')}
                    className={`flex items-center justify-center gap-2 h-9 rounded border text-xs font-medium transition-colors ${
                      connectProvider === 'gmail'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>Google Gmail</span>
                  </button>
                  <button
                    type="button"
                    disabled
                    className="flex flex-col items-center justify-center h-9 rounded border border-slate-800/60 bg-slate-950/40 text-slate-600 cursor-not-allowed text-[11px]"
                    title="Microsoft Outlook integration is temporarily deprecated"
                  >
                    <span>Outlook</span>
                    <span className="text-[9px] text-slate-600 font-mono">(Deprecated)</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 block">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder={connectProvider === 'gmail' ? 'your.name@gmail.com' : 'your.name@outlook.com'}
                  value={connectEmailInput}
                  onChange={(e) => setConnectEmailInput(e.target.value)}
                  className="h-9 w-full rounded border border-slate-700 bg-slate-950 px-3 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="space-y-2 pt-1">
                <a
                  href="/api/email/oauth/google"
                  className="w-full flex items-center justify-center gap-2 h-9 rounded bg-white hover:bg-slate-100 text-slate-900 text-xs font-semibold shadow-sm transition-colors"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Connect with Google OAuth</span>
                </a>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-slate-800"></div>
                  <span className="flex-shrink mx-2 text-[10px] text-slate-500 uppercase tracking-wider">or add mailbox</span>
                  <div className="flex-grow border-t border-slate-800"></div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsConnectModalOpen(false)}
                  className="h-8 px-3 rounded text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connectMutation.isPending}
                  className="h-8 px-4 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 disabled:opacity-50"
                >
                  {connectMutation.isPending ? 'Adding...' : 'Add Gmail'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Historical Sync Modal */}
      {historyModalAccount && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <History className="h-4 w-4 text-blue-400" />
                Sync Email History
              </h3>
              <button
                onClick={() => setHistoryModalAccount(null)}
                className="text-slate-500 hover:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="text-xs text-slate-300">
              Account: <span className="font-mono text-blue-400">{historyModalAccount.email}</span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400 block">How far back should we scan?</label>
              <div className="grid grid-cols-2 gap-2">
                {(['30d', '90d', '1y', 'custom'] as const).map((preset) => {
                  const labels = {
                    '30d': 'Last 30 days',
                    '90d': 'Last 90 days',
                    '1y': 'Last 1 year',
                    custom: 'Custom range',
                  };
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setHistoryPreset(preset)}
                      className={`h-8 rounded border text-xs font-medium transition-colors ${
                        historyPreset === preset
                          ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {labels[preset]}
                    </button>
                  );
                })}
              </div>
            </div>

            {historyPreset === 'custom' && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[10px] font-medium text-slate-400 block mb-1">From</label>
                  <input
                    type="date"
                    value={historyFromInput}
                    onChange={(e) => setHistoryFromInput(e.target.value)}
                    className="h-8 w-full rounded border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-slate-400 block mb-1">To</label>
                  <input
                    type="date"
                    value={historyToInput}
                    onChange={(e) => setHistoryToInput(e.target.value)}
                    className="h-8 w-full rounded border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Warning Note */}
            <div className="flex items-start gap-2 p-3 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] leading-relaxed">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                This may scan a large number of emails and can take longer. Only job-related messages will be classified and indexed.
              </div>
            </div>

            {historyStatusMessage && (
              <div className="p-2 rounded bg-blue-950 border border-blue-800 text-blue-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-400 shrink-0" />
                <span>{historyStatusMessage}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setHistoryModalAccount(null)}
                className="h-8 px-3 rounded text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartHistorySync}
                disabled={syncHistoryMutation.isPending}
                className="inline-flex items-center gap-1.5 h-8 px-4 rounded bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${syncHistoryMutation.isPending ? 'animate-spin' : ''}`} />
                <span>{syncHistoryMutation.isPending ? 'Scanning...' : 'Start sync'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diagnostics Modal */}
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
