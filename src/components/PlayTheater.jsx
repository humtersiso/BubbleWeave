import React, { useState } from 'react';
import { generateDialogues } from '../lib/gemini';

/**
 * 故事編輯器組件 (The Play Theater)
 * @param {Object} props
 * @param {Array} props.selectedCards - 被選中準備編排故事的卡牌
 */
const PlayTheater = ({ selectedCards }) => {
  const [orderedCards, setOrderedCards] = useState(selectedCards);
  const [dialogues, setDialogues] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateStory = async () => {
    if (orderedCards.length === 0) return;
    setIsGenerating(true);
    try {
      const result = await generateDialogues(orderedCards);
      setDialogues(result);
    } catch (error) {
      console.error("Failed to generate dialogues:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-lg border border-gray-200">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <span>🎬</span> The Play Theater
      </h2>
      
      <div className="flex gap-4 overflow-x-auto pb-4 mb-6 min-h-[200px]">
        {orderedCards.map((card, index) => (
          <div key={`${card.id}-${index}`} className="flex-shrink-0 w-40">
            <div className="relative border-2 border-black rounded-md overflow-hidden bg-gray-100">
              <img src={card.imageUrl} alt={card.scene} className="w-full h-48 object-cover grayscale" />
              <div className="absolute top-0 left-0 bg-black text-white text-xs px-2 py-1">
                #{index + 1}
              </div>
            </div>
            <p className="text-[10px] text-gray-500 mt-1 truncate">{card.scene}</p>
            {dialogues[index] && (
              <div className="mt-2 p-2 bg-yellow-50 border-l-2 border-yellow-400 text-sm italic">
                "{dialogues[index]}"
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center mt-4">
        <p className="text-sm text-gray-500">
          {orderedCards.length} scenes selected.
        </p>
        <button
          onClick={handleGenerateStory}
          disabled={isGenerating || orderedCards.length === 0}
          className="px-6 py-2 bg-black text-white rounded-full hover:bg-gray-800 disabled:bg-gray-300 transition-colors"
        >
          {isGenerating ? "AI Writing..." : "Generate AI Dialogues"}
        </button>
      </div>
    </div>
  );
};

export default PlayTheater;
