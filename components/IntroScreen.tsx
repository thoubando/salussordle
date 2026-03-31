'use client';

import { useState, useEffect } from 'react';

interface Props {
  onStart: (username: string) => void;
}

export default function IntroScreen({ onStart }: Props) {
  const [phase, setPhase] = useState<'fade-in' | 'show-text' | 'fade-out' | 'show-input'>('fade-in');
  const [username, setUsername] = useState('');

  useEffect(() => {
    // Phase 1: Fade-in starts immediately
    const t1 = setTimeout(() => setPhase('show-text'), 100);
    // Phase 2: Hold text for 2.5 seconds, then fade out
    const t2 = setTimeout(() => setPhase('fade-out'), 2500);
    // Phase 3: Total 3.5 seconds before input appears
    const t3 = setTimeout(() => setPhase('show-input'), 3200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (username.trim()) {
      onStart(username.trim());
    }
  }

  // Full screen, absolute positioned over the app if needed, or just taking up the main container space.
  // We'll give it a fixed inset-0 to cover the whole screen, with a premium dark or vibrant background.
  
  if (phase === 'show-input') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-50/90 backdrop-blur-md animate-in fade-in duration-500">
        <div className="bg-white p-8 md:p-12 rounded-3xl shadow-2xl max-w-md w-full mx-4 border border-indigo-50 transform hover:scale-[1.01] transition-all">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-500 tracking-tight">RxSordle</h1>
            <p className="text-gray-500 mt-2 font-medium">Daily NBEO Pharmacology Challenge</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-bold text-gray-700 mb-2">
                Enter your name for the leaderboard
              </label>
              <input
                id="username"
                type="text"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Dr. Optom..."
                maxLength={30}
                autoComplete="off"
                className="w-full border-2 border-indigo-100 rounded-2xl px-5 py-4 text-center font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-gray-800 text-lg placeholder-gray-300"
              />
            </div>
            
            <button
              type="submit"
              disabled={!username.trim()}
              className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-300 disabled:text-gray-500 text-white font-bold rounded-2xl transition-all shadow-lg hover:shadow-xl disabled:shadow-none transform hover:-translate-y-0.5 disabled:transform-none text-lg"
            >
              Start Game
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900">
      <h1
        className={`text-4xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-white tracking-tight drop-shadow-2xl transition-all duration-700 transform ${
          phase === 'fade-in'
            ? 'opacity-0 scale-95 translate-y-4'
            : phase === 'show-text'
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-105 -translate-y-4' // fade-out
        }`}
      >
        Welcome to Today&apos;s Sordle
      </h1>
    </div>
  );
}
