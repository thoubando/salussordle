'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { RoundData, LeaderboardEntry } from '@/lib/types';

const SESSION_KEY = 'rxsordle_admin_auth';
const SESSION_PW_KEY = 'rxsordle_admin_pw';

function getTodayET(): string {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
    .toISOString().split('T')[0];
}

function getTimeUntilReset(): string {
  // Next reset is at 04:01 UTC (12:01 AM EDT)
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(4, 1, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  const diff = next.getTime() - now.getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  return `${h}h ${m}m ${s}s`;
}

type Player = LeaderboardEntry & { created_at: string };

export default function DevPanel() {
  const [open, setOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [rounds, setRounds] = useState<RoundData[] | null>(null);
  const [roundsDate, setRoundsDate] = useState('');
  const [roundsCreatedAt, setRoundsCreatedAt] = useState('');
  const [roundsLoading, setRoundsLoading] = useState(false);

  const [players, setPlayers] = useState<Player[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);

  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  const [regenLoading, setRegenLoading] = useState(false);
  const [regenMsg, setRegenMsg] = useState('');

  const [countdown, setCountdown] = useState(getTimeUntilReset());
  const [activeTab, setActiveTab] = useState<'questions' | 'leaderboard'>('questions');

  const panelRef = useRef<HTMLDivElement>(null);

  // Restore auth from session
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === 'true') setAuthed(true);
  }, []);

  // Countdown timer
  useEffect(() => {
    const t = setInterval(() => setCountdown(getTimeUntilReset()), 1_000);
    return () => clearInterval(t);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (open && panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const storedPw = () => sessionStorage.getItem(SESSION_PW_KEY) ?? '';

  const fetchRounds = useCallback(async () => {
    setRoundsLoading(true);
    const res = await fetch('/api/admin/rounds', { headers: { 'x-admin-password': storedPw() } });
    if (res.ok) {
      const data = await res.json();
      setRounds(data.rounds);
      setRoundsDate(data.date);
      setRoundsCreatedAt(data.createdAt ?? '');
    }
    setRoundsLoading(false);
  }, []);

  const fetchPlayers = useCallback(async () => {
    setPlayersLoading(true);
    const today = getTodayET();
    const res = await fetch(`/api/admin/players?date=${today}`, {
      headers: { 'x-admin-password': storedPw() },
    });
    if (res.ok) {
      const data = await res.json();
      setPlayers(data.players ?? []);
    }
    setPlayersLoading(false);
  }, []);

  // Fetch data when panel opens and authed
  useEffect(() => {
    if (!open || !authed) return;
    fetchRounds();
    fetchPlayers();
    const interval = setInterval(fetchPlayers, 30_000);
    return () => clearInterval(interval);
  }, [open, authed, fetchRounds, fetchPlayers]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    const res = await fetch('/api/admin/rounds', { headers: { 'x-admin-password': pw } });
    if (res.ok) {
      sessionStorage.setItem(SESSION_KEY, 'true');
      sessionStorage.setItem(SESSION_PW_KEY, pw);
      setAuthed(true);
    } else {
      setAuthError('Incorrect password');
    }
    setAuthLoading(false);
  }

  async function handleRegenerate() {
    if (!confirm('Generate a brand-new set of questions for today? This will replace what all players see.')) return;
    setRegenLoading(true);
    setRegenMsg('');
    const res = await fetch('/api/admin/regenerate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: storedPw() }),
    });
    const data = await res.json();
    if (res.ok) {
      setRegenMsg('✓ New questions generated and cached globally');
      setRounds(data.rounds);
      setRoundsCreatedAt(new Date().toISOString());
    } else {
      setRegenMsg(`Error: ${data.error}`);
    }
    setRegenLoading(false);
  }

  async function handleReset() {
    if (!confirm('Delete all scores for today?')) return;
    setResetLoading(true);
    setResetMsg('');
    const res = await fetch('/api/admin/reset', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: storedPw() }),
    });
    const data = await res.json();
    setResetMsg(res.ok ? `✓ Deleted ${data.deleted} score(s)` : `Error: ${data.error}`);
    if (res.ok) fetchPlayers();
    setResetLoading(false);
  }

  const avgScore = players.length
    ? (players.reduce((s, p) => s + p.score, 0) / players.length).toFixed(1)
    : '—';
  const topScore = players.length ? Math.max(...players.map((p) => p.score)) : '—';

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        title="Dev tools"
        className="fixed bottom-5 right-5 z-50 w-9 h-9 flex items-center justify-center rounded-full bg-white/80 backdrop-blur border border-gray-200 shadow-md text-gray-400 hover:text-indigo-600 hover:border-indigo-300 transition-all text-base"
      >
        ⚙
      </button>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex justify-end">
          {/* Panel */}
          <div
            ref={panelRef}
            className="w-full max-w-sm h-full bg-white shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-slate-50">
              <span className="text-sm font-bold text-gray-700">🛠 Dev Tools</span>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            {!authed ? (
              /* ── Password gate ── */
              <form onSubmit={handleLogin} className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
                <p className="text-sm text-gray-500 text-center">Enter admin password to access dev tools</p>
                <input
                  type="password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder="Password"
                  autoFocus
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                {authError && <p className="text-red-500 text-xs">{authError}</p>}
                <button
                  type="submit"
                  disabled={authLoading || !pw}
                  className="w-full bg-indigo-600 text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-40 hover:bg-indigo-700 transition-colors"
                >
                  {authLoading ? 'Checking…' : 'Unlock'}
                </button>
              </form>
            ) : (
              /* ── Dashboard ── */
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Stats strip */}
                <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100 bg-slate-50">
                  <div className="px-3 py-2.5 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Players</p>
                    <p className="text-lg font-bold text-gray-800">{players.length}</p>
                  </div>
                  <div className="px-3 py-2.5 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Top Score</p>
                    <p className="text-lg font-bold text-indigo-600">{topScore}</p>
                  </div>
                  <div className="px-3 py-2.5 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Avg Score</p>
                    <p className="text-lg font-bold text-gray-800">{avgScore}</p>
                  </div>
                </div>

                {/* Countdown */}
                <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-400">Next reset (12:01 AM EDT)</span>
                  <span className="text-xs font-mono font-semibold text-indigo-500">{countdown}</span>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100">
                  {(['questions', 'leaderboard'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 py-2 text-xs font-semibold capitalize transition-colors ${
                        activeTab === tab
                          ? 'text-indigo-600 border-b-2 border-indigo-500'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {tab === 'questions' ? "Today's Questions" : 'Leaderboard'}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {activeTab === 'questions' && (
                    <>
                      {roundsLoading && <p className="text-xs text-gray-400 text-center py-4">Loading…</p>}
                      {!roundsLoading && !rounds && (
                        <p className="text-xs text-gray-400 text-center py-4">
                          No rounds cached for {roundsDate}.<br />First player load will generate them.
                        </p>
                      )}
                      {rounds && (
                        <>
                          <p className="text-[10px] text-gray-400">
                            {roundsDate} · Generated {roundsCreatedAt ? new Date(roundsCreatedAt).toLocaleTimeString() : 'unknown'}
                          </p>
                          {rounds.map((round) => (
                            <div key={round.roundNumber} className="bg-slate-50 rounded-xl p-3 border border-gray-100">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] font-bold text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded-full">R{round.roundNumber}</span>
                                <p className="text-xs font-semibold text-gray-800 leading-tight">{round.theme}</p>
                              </div>
                              {round.categories.map((cat) => (
                                <div key={cat} className="mb-1.5">
                                  <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mb-1">{cat}</p>
                                  <div className="flex flex-wrap gap-1">
                                    {round.items.filter((i) => i.category === cat).map((i) => (
                                      <span key={i.name} className="text-[10px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-700">{i.name}</span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  )}

                  {activeTab === 'leaderboard' && (
                    <>
                      {playersLoading && players.length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-4">Loading…</p>
                      )}
                      {!playersLoading && players.length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-4">No players yet today.</p>
                      )}
                      {players.map((p, i) => (
                        <div key={p.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border border-gray-100">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-300 w-4">{i + 1}</span>
                            <span className="text-sm font-medium text-gray-800">{p.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold text-indigo-600">{p.score}</span>
                            <p className="text-[9px] text-gray-400">{new Date(p.created_at).toLocaleTimeString()}</p>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                {/* Footer actions */}
                <div className="border-t border-gray-100 p-3 space-y-2">
                  {regenMsg && <p className="text-xs text-center text-indigo-600">{regenMsg}</p>}
                  <button
                    onClick={handleRegenerate}
                    disabled={regenLoading}
                    className="w-full py-2 text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50 disabled:opacity-40 transition-colors"
                  >
                    {regenLoading ? 'Generating…' : '⟳ Regenerate Today\'s Questions'}
                  </button>
                  {resetMsg && <p className="text-xs text-center text-gray-500">{resetMsg}</p>}
                  <button
                    onClick={handleReset}
                    disabled={resetLoading}
                    className="w-full py-2 text-xs font-semibold text-red-500 border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-40 transition-colors"
                  >
                    {resetLoading ? 'Resetting…' : "Reset Today's Leaderboard"}
                  </button>
                  <button
                    onClick={() => { sessionStorage.clear(); setAuthed(false); }}
                    className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Log out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
