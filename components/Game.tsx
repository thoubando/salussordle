'use client';

import { useState, useEffect, useCallback } from 'react';
import DragDropRound from './DragDropRound';
import ScoreScreen from './ScoreScreen';
import Leaderboard from './Leaderboard';
import IntroScreen from './IntroScreen';
import { getDailyDateET } from '@/lib/date';
import type { RoundData, GameState } from '@/lib/types';

const STORAGE_KEY = 'rxsordle_state';

export default function Game() {
  const today = getDailyDateET();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load or initialize game state
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed: GameState = JSON.parse(stored);
        if (parsed.date === today) {
          setGameState(parsed);
          return;
        }
      } catch {
        // ignore parse errors
      }
    }
    // New game
    const initial: GameState = {
      rounds: [],
      currentRound: 1,
      scores: [],
      completed: false,
      date: today,
    };
    setGameState(initial);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  }, [today]);

  // Generate all 5 rounds in a single API call
  const generateAllRounds = useCallback(async (forceNew = false) => {
    setLoading(true);
    setError(null);
    try {
      const salt = forceNew ? (Math.random() * 100000 | 0) : undefined;
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today, forceNew, salt }),
      });
      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After') ?? '6';
        setError(`Too many requests — please wait ${retryAfter}s and refresh.`);
        return;
      }
      if (!res.ok) throw new Error('Failed to generate rounds');
      const data: { rounds: RoundData[] } = await res.json();
      setRounds(data.rounds);
    } catch {
      setError('Failed to load rounds. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [today]);

  // Fetch all rounds once when gameState is ready and rounds aren't loaded yet
  useEffect(() => {
    if (!gameState || gameState.completed || !gameState.started) return;
    if (rounds.length === 0 && !loading) {
      generateAllRounds();
    }
  }, [gameState, rounds.length, loading, generateAllRounds]);

  function handleRoundComplete(correct: number, _total: number) {
    if (!gameState) return;
    const newScores = [...gameState.scores, correct];
    const nextRound = gameState.currentRound + 1;
    const completed = nextRound > 5;

    const newState: GameState = {
      ...gameState,
      currentRound: nextRound,
      scores: newScores,
      completed,
    };
    setGameState(newState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  }

  // Auto-submit score when game completes
  useEffect(() => {
    if (gameState?.completed && gameState?.username && !gameState?.scoreSubmitted) {
      const totalScore = gameState.scores.reduce((a, b) => a + b, 0);
      fetch('/api/submit-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: gameState.username, score: totalScore, date: today }),
      })
        .then(() => {
          const fresh = { ...gameState, scoreSubmitted: true };
          setGameState(fresh);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
        })
        .catch(() => console.error('Failed to submit score'));
    }
  }, [gameState?.completed, gameState?.username, gameState?.scoreSubmitted, gameState?.scores, today, gameState]);

  if (!gameState) return null;

  // Sum actual item counts from completed rounds; fall back to 7 per round if rounds not loaded
  const totalItems = rounds.length > 0
    ? rounds.slice(0, gameState.scores.length).reduce((sum, r) => sum + r.items.length, 0)
    : gameState.scores.length * 7;
  const totalCorrect = gameState.scores.reduce((a, b) => a + b, 0);

  function handleNewGame() {
    // Clear rounds first so stale data from the previous generation can't bleed through
    setRounds([]);
    const fresh: GameState = {
      rounds: [],
      currentRound: 1,
      scores: [],
      completed: false,
      date: today,
      scoreSubmitted: false,
    };
    setGameState(fresh);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    // Salt is generated inside generateAllRounds when forceNew=true
    generateAllRounds(true);
  }

  if (!gameState.started) {
    return (
      <IntroScreen
        onStart={(username) => {
          const newState = { ...gameState, started: true, username };
          setGameState(newState);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
        }}
      />
    );
  }

  if (gameState.completed) {
    return (
      <div className="space-y-8 fade-in animate-in duration-500">
        <ScoreScreen
          totalCorrect={totalCorrect}
          totalItems={totalItems || 35}
          date={today}
          username={gameState.username}
          submitted={!!gameState.scoreSubmitted}
        />
        <div className="pt-4 border-t border-indigo-100">
          <Leaderboard date={today} />
        </div>
      </div>
    );
  }

  const currentRoundData = rounds.find((r) => r.roundNumber === gameState.currentRound);

  return (
    <div className="w-full">
      {/* Progress bar */}
      <div className="flex gap-1.5 mb-6 justify-center">
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            className={`h-2 flex-1 max-w-[60px] rounded-full transition-colors ${
              n < gameState.currentRound
                ? 'bg-indigo-500'
                : n === gameState.currentRound
                ? 'bg-indigo-300'
                : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {loading && (
        <div className="text-center py-16">
          <div className="inline-block w-8 h-8 border-4 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
          <p className="mt-3 text-gray-500 text-sm">Generating today&apos;s puzzle&hellip;</p>
        </div>
      )}

      {error && (
        <div className="text-center py-8">
          <p className="text-red-500">{error}</p>
          <button
            onClick={() => generateAllRounds()}
            className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && currentRoundData && (
        <DragDropRound
          key={currentRoundData.roundNumber}
          round={currentRoundData}
          onComplete={handleRoundComplete}
        />
      )}
    </div>
  );
}
