'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Sparkles, ArrowRight, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';

function GoogleIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

function LoginFormContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/inbox';
  const urlError = searchParams.get('error');

  const [demoLoading, setDemoLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(urlError || null);

  // Direct Google OAuth Login
  const handleGoogleLogin = () => {
    try {
      setGoogleLoading(true);
      setError(null);
      const authUrl = `/api/auth/google?callbackUrl=${encodeURIComponent(callbackUrl)}`;
      window.location.href = authUrl;
    } catch (err: any) {
      setError(err.message || 'Failed to start Google sign in');
      setGoogleLoading(false);
    }
  };

  // 1-Click Demo Sandbox Entry
  const handleDemoLogin = async () => {
    try {
      setDemoLoading(true);
      setError(null);

      const res = await fetch('/api/auth/demo', {
        method: 'POST',
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Demo login failed');
      }

      window.location.href = callbackUrl;
    } catch (err: any) {
      setError(err.message || 'Failed to start demo session');
      setDemoLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      {/* Brand Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Welcome to ApplyFeed
        </h1>
        <p className="text-sm text-slate-400 max-w-sm mx-auto">
          High-precision email ingestion & job application intelligence across your mailboxes.
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-rose-300 text-xs animate-in fade-in duration-200">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Primary Authentication Card: Google OAuth */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-md p-6 shadow-xl shadow-black/40 space-y-5">
        <div className="text-center space-y-1">
          <h2 className="text-base font-semibold text-slate-100">Sign in to your account</h2>
          <p className="text-xs text-slate-400">
            Sign in with Google to automatically create your profile and securely link your Gmail.
          </p>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading || demoLoading}
          className="w-full h-12 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-xl active:scale-[0.99] cursor-pointer disabled:opacity-50"
        >
          {googleLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-slate-600" />
          ) : (
            <GoogleIcon className="h-5 w-5" />
          )}
          <span>{googleLoading ? 'Redirecting to Google...' : 'Continue with Google'}</span>
        </button>

        <div className="flex items-center gap-2 text-[11px] text-slate-500 justify-center">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span>Secure OAuth 2.0 • Read-only access • Tokens encrypted via AES-256</span>
        </div>
      </div>

      {/* Divider */}
      <div className="relative flex items-center justify-center">
        <div className="border-t border-slate-800 w-full" />
        <span className="bg-slate-950 px-3 text-[11px] font-medium tracking-wider text-slate-400 uppercase">
          OR EXPLORE WITHOUT CONNECTING
        </span>
      </div>

      {/* Isolated Demo Sandbox Card */}
      <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-transparent p-5 shadow-lg shadow-amber-500/5 space-y-3.5">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Demo Sandbox
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Isolated Data
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Explore pre-populated simulated applications, interviews, and offers in an isolated test environment.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDemoLogin}
          disabled={demoLoading || googleLoading}
          className="w-full h-10 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99] cursor-pointer disabled:opacity-50"
        >
          {demoLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
          ) : (
            <>
              <span>Explore Demo Sandbox</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>

        <p className="text-[10px] text-slate-400 text-center">
          Zero real email access • Queries strictly isolated demo tables
        </p>
      </div>

      {/* Security & Privacy Notice */}
      <div className="text-center text-[11px] text-slate-400 space-y-1">
        <p>Your privacy is strictly protected.</p>
        <p>Production and testing data are isolated into separate database tables.</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin text-blue-500" />}>
        <LoginFormContent />
      </Suspense>
    </div>
  );
}
