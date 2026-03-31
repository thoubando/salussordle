import Game from '@/components/Game';
import DevPanel from '@/components/DevPanel';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col bg-slate-50">
      <DevPanel />
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-indigo-100/50 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 tracking-tight">
              RxSordle
            </h1>
            <p className="text-xs font-semibold text-gray-400 mt-0.5">Daily NBEO Pharmacology Challenge</p>
          </div>
          <span className="text-sm font-bold text-indigo-500 bg-indigo-50 px-3 py-1.5 rounded-full ring-1 ring-indigo-100">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
      </header>

      {/* Game Area */}
      <div className="flex-1 w-full max-w-3xl mx-auto px-4 py-8 md:py-12 flex flex-col">
        <Game />
      </div>

      {/* Footer */}
      <footer className="py-6 text-center text-sm font-medium text-gray-400">
        RxSordle &middot; Built for optometry students
      </footer>
    </main>
  );
}
