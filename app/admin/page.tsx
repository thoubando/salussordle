'use client';

import { useState, useEffect, useCallback } from 'react';
import type { RoundData, LeaderboardEntry } from '@/lib/types';

const SESSION_KEY = 'rxsordle_admin_auth';

function getTodayET(): string {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
    .toISOString().split('T')[0];
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Rounds state
  const [rounds, setRounds] = useState<RoundData[] | null>(null);
  const [roundsDate, setRoundsDate] = useState('');
  const [roundsCreatedAt, setRoundsCreatedAt] = useState('');
  const [roundsLoading, setRoundsLoading] = useState(false);

  // Players state
  const [players, setPlayers] = useState<(LeaderboardEntry & { created_at: string })[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);

  // Reset state
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === 'true') setAuthed(true);
  }, []);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    // We verify against the env var server-side by trying the admin/rounds endpoint with a special header
    // But for simplicity, we check client-side via a lightweight ping
    fetch('/api/admin/rounds', { headers: { 'x-admin-password': password } })
      .then(async (res) => {
        if (res.ok) {
          sessionStorage.setItem(SESSION_KEY, 'true');
          sessionStorage.setItem('rxsordle_admin_pw', password);
          setAuthed(true);
        } else {
          setAuthError('Incorrect password');
        }
      })
      .catch(() => setAuthError('Network error'));
  }

  const storedPw = () => (typeof window !== 'undefined' ? sessionStorage.getItem('rxsordle_admin_pw') ?? '' : '');

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
    const res = await fetch(`/api/admin/players?date=${today}`, { headers: { 'x-admin-password': storedPw() } });
    if (res.ok) {
      const data = await res.json();
      setPlayers(data.players ?? []);
    }
    setPlayersLoading(false);
  }, []);

  useEffect(() => {
    if (!authed) return;
    fetchRounds();
    fetchPlayers();
    const interval = setInterval(fetchPlayers, 30_000);
    return () => clearInterval(interval);
  }, [authed, fetchRounds, fetchPlayers]);

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
    if (res.ok) {
      setResetMsg(`✓ Deleted ${data.deleted} score(s)`);
      fetchPlayers();
    } else {
      setResetMsg(`Error: ${data.error}`);
    }
    setResetLoading(false);
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-md p-8 w-full max-w-sm space-y-4">
          <h1 className="text-2xl font-bold text-gray-900 text-center">Admin</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            autoFocus
          />
          {authError && <p className="text-red-500 text-sm">{authError}</p>}
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Enter
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">RxSordle Admin</h1>
          <button
            onClick={() => { sessionStorage.clear(); setAuthed(false); }}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            Log out
          </button>
        </div>

        {/* ── Section 1: Today's Questions ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold text-gray-800">Today&apos;s Questions</h2>
            <button onClick={fetchRounds} className="text-xs text-indigo-500 hover:underline">Refresh</button>
          </div>
          {roundsLoading && <p className="text-gray-400 text-sm">Loading…</p>}
          {!roundsLoading && !rounds && (
            <p className="text-gray-400 text-sm">No rounds cached for today ({roundsDate}). First player load will generate them.</p>
          )}
          {rounds && (
            <div className="space-y-4">
              <p className="text-xs text-gray-400">Date: {roundsDate} · Generated: {roundsCreatedAt ? new Date(roundsCreatedAt).toLocaleString() : 'unknown'}</p>
              {rounds.map((round) => (
                <div key={round.roundNumber} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-xs font-bold text-indigo-400 bg-indigo-50 px-2 py-0.5 rounded-full">R{round.roundNumber}</span>
                    <p className="font-semibold text-gray-800 text-sm">{round.theme}</p>
                  </div>
                  <div className={`grid gap-3 ${round.categories.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                    {round.categories.map((cat) => (
                      <div key={cat} className="bg-slate-50 rounded-lg p-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">{cat}</p>
                        <div className="flex flex-wrap gap-1">
                          {round.items.filter((i) => i.category === cat).map((i) => (
                            <span key={i.name} className="text-xs bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-700">{i.name}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {round.explanation && (
                    <p className="mt-3 text-xs text-gray-500 italic border-t border-gray-100 pt-2">{round.explanation}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Section 2: Players Today ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold text-gray-800">Players Today</h2>
            <span className="text-xs text-gray-400">Auto-refreshes every 30s</span>
          </div>
          {playersLoading && players.length === 0 && <p className="text-gray-400 text-sm">Loading…</p>}
          {!playersLoading && players.length === 0 && <p className="text-gray-400 text-sm">No players yet today.</p>}
          {players.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-slate-50">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Rank</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Name</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Score</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p, i) => (
                    <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-bold text-gray-400">{i + 1}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-800">{p.name}</td>
                      <td className="px-4 py-2.5 font-bold text-indigo-600">{p.score}</td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{new Date(p.created_at).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Section 3: Reset Scoreboard ── */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-3">Reset Scoreboard</h2>
          <div className="bg-white rounded-xl border border-red-100 shadow-sm p-4 flex items-center gap-4">
            <button
              onClick={handleReset}
              disabled={resetLoading}
              className="px-5 py-2.5 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 disabled:opacity-40 transition-colors text-sm"
            >
              {resetLoading ? 'Resetting…' : "Delete Today's Scores"}
            </button>
            {resetMsg && <p className="text-sm text-gray-600">{resetMsg}</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
