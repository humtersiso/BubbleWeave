import React from 'react';

/**
 * 最新發布故事流組件 (Newest Feed)
 * @param {Object} props
 * @param {Array} props.stories - 故事資料陣列
 * @param {Function} props.onLike - 點讚回調
 * @param {Function} props.onRemix - Remix 回調
 */
const StoryFeed = ({ stories = [], onLike, onRemix }) => {
  return (
    <div className="space-y-8 p-4">
      {stories.map((story) => (
        <div key={story.id} className="bg-white border-2 border-black rounded-xl overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          {/* Story Header */}
          <div className="p-4 border-b-2 border-black flex justify-between items-center bg-yellow-50">
            <span className="font-bold">👤 {story.author}</span>
            <span className="text-xs text-gray-500">{new Date(story.createdAt).toLocaleDateString()}</span>
          </div>

          {/* Story Panels */}
          <div className="flex overflow-x-auto p-4 gap-4 bg-gray-50 scrollbar-hide">
            {story.cards.map((card, idx) => (
              <div key={`${story.id}-card-${idx}`} className="flex-shrink-0 w-48">
                <div className="border-2 border-black rounded-lg overflow-hidden bg-white">
                  <img src={card.imageUrl} alt="panel" className="w-full h-64 object-cover grayscale" />
                </div>
                <div className="mt-2 text-center">
                  <span className="inline-block bg-black text-white text-[10px] px-2 py-0.5 rounded mb-1">
                    PANEL {idx + 1}
                  </span>
                  <p className="text-sm font-medium italic leading-tight">"{story.dialogues[idx]}"</p>
                </div>
              </div>
            ))}
          </div>

          {/* Story Actions */}
          <div className="p-4 border-t-2 border-black flex justify-between items-center bg-white">
            <div className="flex gap-4">
              <button 
                onClick={() => onLike && onLike(story.id)}
                className="flex items-center gap-1 hover:scale-110 active:scale-95 transition-transform"
              >
                <span className="text-xl">❤️</span>
                <span className="font-bold">{story.likes || 0}</span>
              </button>
              <button 
                onClick={() => onRemix && onRemix(story)}
                className="flex items-center gap-1 hover:scale-110 transition-transform text-blue-600"
              >
                <span className="text-xl">⚡</span>
                <span className="font-bold text-sm">Remix</span>
              </button>
            </div>
            <div className="text-xs text-gray-400">
              {story.cards.length} Scenes
            </div>
          </div>
        </div>
      ))}
      {stories.length === 0 && (
        <div className="text-center py-20 border-2 border-dashed border-gray-300 rounded-xl">
          <p className="text-gray-400 italic">No stories in the weave yet...</p>
        </div>
      )}
    </div>
  );
};

export default StoryFeed;
