'use client';

interface Props {
  totalCorrect: number;
  totalItems: number;
  date: string;
  username?: string;
  submitted: boolean;
}

export default function ScoreScreen({ totalCorrect, totalItems, date, username, submitted }: Props) {
  const percentage = Math.round((totalCorrect / totalItems) * 100);

  const emoji =
    percentage === 100 ? '🏆' : percentage >= 80 ? '🎉' : percentage >= 60 ? '👍' : '📚';

  return (
    <div className="w-full max-w-md mx-auto text-center space-y-6">
      <div className="text-6xl">{emoji}</div>
      <div>
        <h2 className="text-3xl font-bold text-gray-900">{totalCorrect}/{totalItems}</h2>
        <p className="text-gray-500 mt-1">{percentage}% correct · {date}</p>
      </div>

      {/* Score bar */}
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className="bg-indigo-500 h-3 rounded-full transition-all duration-700"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Auto-submission feedback */}
      <div className="pt-2">
        {!submitted ? (
          <p className="text-gray-500 text-sm animate-pulse">Submitting score for {username}...</p>
        ) : (
          <p className="text-emerald-600 font-semibold text-lg bg-emerald-50 py-2 px-4 rounded-xl inline-block">
            ✓ Score saved to leaderboard!
          </p>
        )}
      </div>
    </div>
  );
}
