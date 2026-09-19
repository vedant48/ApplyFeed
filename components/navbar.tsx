'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Inbox,
  Settings,
  Mail,
  FileText,
  Briefcase,
  Sparkles,
  LogOut,
  User,
  ChevronDown,
  LogIn,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { AuthUser } from '@/lib/auth';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [switchingToDemo, setSwitchingToDemo] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch current user session
  const { data } = useQuery<{ user: AuthUser | null; authenticated: boolean }>({
    queryKey: ['auth-me'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me');
      if (!res.ok) return { user: null, authenticated: false };
      return res.json();
    },
    staleTime: 30000,
  });

  const user = data?.user || null;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      queryClient.setQueryData(['auth-me'], { user: null, authenticated: false });
      queryClient.clear();
      setDropdownOpen(false);
      router.push('/login');
      router.refresh();
    } catch (e) {
      console.error('Sign out error:', e);
    }
  };

  const handleSwitchToDemo = async () => {
    try {
      setSwitchingToDemo(true);
      const res = await fetch('/api/auth/demo', { method: 'POST' });
      if (res.ok) {
        queryClient.invalidateQueries();
        setDropdownOpen(false);
        router.push('/inbox');
        router.refresh();
      }
    } catch (e) {
      console.error('Switch to demo error:', e);
    } finally {
      setSwitchingToDemo(false);
    }
  };

  const navItems = [
    { label: 'Resume', href: '/resume', icon: FileText },
    { label: 'Jobs', href: '/jobs', icon: Briefcase },
    { label: 'Job Inbox', href: '/inbox', icon: Inbox },
  ];

  return (
    <>
      {/* Demo Account Indicator Strip */}
      {user?.isDemo && pathname !== '/login' && (
        <div className="bg-gradient-to-r from-amber-950/60 via-amber-900/40 to-slate-950 border-b border-amber-500/20 px-4 py-1 text-[11px] text-amber-200/90 flex items-center justify-between">
          <div className="mx-auto max-w-7xl w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span>
                <strong className="text-amber-300 font-semibold">Demo Sandbox:</strong> Exploring isolated simulated applications & test accounts. Zero access to real mailboxes.
              </span>
            </div>
            <Link
              href="/login"
              className="text-amber-300 hover:text-amber-200 underline font-medium flex items-center gap-1 transition-colors"
            >
              <span>Sign in with Google</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand & Main Nav */}
          <div className="flex items-center gap-8">
            <Link
              href="/inbox"
              className="flex items-center gap-2 font-semibold text-slate-100 hover:text-blue-400 transition-colors"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-500/20">
                <Mail className="h-4 w-4" />
              </div>
              <span className="text-base tracking-tight font-bold">ApplyFeed</span>
            </Link>

            {user && (
              <nav className="flex items-center gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    pathname === item.href ||
                    (item.href === '/inbox' && (pathname === '/' || pathname.startsWith('/inbox')));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-slate-800 text-blue-400 font-semibold shadow-inner'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>

          {/* Right User & Settings Controls */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link
                  href="/settings/email-accounts"
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    pathname.startsWith('/settings')
                      ? 'bg-slate-800 text-blue-400'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800/80'
                  }`}
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Email Accounts</span>
                </Link>

                {/* User Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setDropdownOpen((prev) => !prev)}
                    className="flex items-center gap-2 p-1 pl-2 pr-2.5 rounded-lg border border-slate-800 bg-slate-900/80 hover:bg-slate-850 hover:border-slate-700 text-xs text-slate-200 transition-colors cursor-pointer"
                  >
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt="Profile"
                        className="h-6 w-6 rounded-full object-cover border border-slate-700"
                      />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-semibold text-[11px]">
                        {user.email ? user.email[0].toUpperCase() : 'U'}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-left">
                      <span className="hidden md:inline font-medium text-slate-200 max-w-[120px] truncate">
                        {user.name || user.email.split('@')[0]}
                      </span>
                      {user.isDemo ? (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          <Sparkles className="h-2.5 w-2.5" />
                          Demo
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          Personal
                        </span>
                      )}
                    </div>
                    <ChevronDown className="h-3 w-3 text-slate-400" />
                  </button>

                  {/* Dropdown Menu */}
                  {dropdownOpen && (
                    <div className="absolute right-0 mt-1.5 w-60 rounded-xl border border-slate-800 bg-slate-900/95 backdrop-blur-md p-2 shadow-2xl shadow-black/80 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="px-3 py-2 border-b border-slate-800/80 mb-1">
                        <p className="text-xs font-semibold text-slate-200 truncate">
                          {user.name || 'ApplyFeed User'}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                        <div className="mt-1.5">
                          {user.isDemo ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              <Sparkles className="h-3 w-3" />
                              Isolated Demo Sandbox
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20">
                              Personal Workspace
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="py-1 space-y-0.5">
                        {!user.isDemo ? (
                          <button
                            type="button"
                            onClick={handleSwitchToDemo}
                            disabled={switchingToDemo}
                            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-amber-300 hover:bg-amber-500/10 transition-colors text-left cursor-pointer"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>Explore Demo Sandbox</span>
                          </button>
                        ) : (
                          <Link
                            href="/login"
                            onClick={() => setDropdownOpen(false)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-blue-400 hover:bg-blue-500/10 transition-colors text-left"
                          >
                            <User className="h-3.5 w-3.5" />
                            <span>Sign in with Google</span>
                          </Link>
                        )}

                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 transition-colors text-left cursor-pointer"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
