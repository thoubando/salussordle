'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { LeaderboardEntry } from '@/lib/types';

interface Props {
  date: string;
}

export default function Leaderboard({ date }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEntries() {
      const { data } = await supabase
        .from('rxsordle_scores')
        .select('*')
        .eq('date', date)
        .order('score', { ascending: false })
        .limit(10);
      setEntries((data as LeaderboardEntry[]) ?? []);
      setLoading(false);
    }
    fetchEntries();
  }, [date]);

  if (loading) return <p className="text-gray-400 text-sm text-center">Loading leaderboard\u2026</p>;
  if (entries.length === 0) return <p className="text-gray-400 text-sm text-center">No scores yet today. Be the first!</p>;

  return (
    <div className="w-full max-w-md mx-auto">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3 text-center">
        Today&apos;s Leaderboard
      </h3>
      <ol className="space-y-2">
        {entries.map((entry, i) => (
          <li
            key={entry.id}
            className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-white border border-gray-100 shadow-sm"
          >
            <span className="flex items-center gap-3">
              <span className="text-sm font-bold text-gray-400 w-5">{i + 1}.</span>
              <span className="font-medium text-gray-800">{entry.name}</span>
            </span>
            <span className="font-bold text-indigo-600">{entry.score}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
