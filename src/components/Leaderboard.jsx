import React from 'react';

/**
 * 熱門排行榜組件 (Leaderboard)
 * @param {Object} props
 * @param {Array} props.stories - 故事資料陣列
 */
const Leaderboard = ({ stories = [] }) => {
  return (
    <div className="p-6 bg-white rounded-xl shadow-lg border border-gray-200">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <span>🏆</span> Hot Leaderboard
      </h2>
      <div className="space-y-4">
        {stories.map((story, index) => (
          <div key={story.id} className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-100 last:border-0">
            <div className="text-2xl font-black text-gray-300 w-8">
              {index + 1}
            </div>
            <div className="flex-shrink-0 w-12 h-12 border-2 border-black rounded-md overflow-hidden bg-gray-100">
              <img src={story.cards[0]?.imageUrl} alt="preview" className="w-full h-full object-cover grayscale" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm truncate">Story by {story.author}</h3>
              <p className="text-xs text-gray-500 italic truncate">"{story.dialogues[0]}"</p>
            </div>
            <div className="flex items-center gap-1 text-red-500 font-bold">
              <span>❤️</span>
              <span>{story.likes || 0}</span>
            </div>
          </div>
        ))}
        {stories.length === 0 && (
          <p className="text-center text-gray-400 py-8 italic">No stories trending yet...</p>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
