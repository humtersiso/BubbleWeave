import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { generateDialogues } from '../lib/gemini';

const SortableCard = ({ card, index, dialogue }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="flex-shrink-0 w-40 cursor-grab active:cursor-grabbing">
      <div className="relative border-2 border-black rounded-md overflow-hidden bg-gray-100">
        <img src={card.imageUrl} alt={card.scene} className="w-full h-48 object-cover grayscale" />
        <div className="absolute top-0 left-0 bg-black text-white text-xs px-2 py-1">
          #{index + 1}
        </div>
      </div>
      <p className="text-[10px] text-gray-500 mt-1 truncate">{card.scene}</p>
      {dialogue && (
        <div className="mt-2 p-2 bg-yellow-50 border-l-2 border-yellow-400 text-sm italic">
          "{dialogue}"
        </div>
      )}
    </div>
  );
};

/**
 * 故事編輯器組件 (The Play Theater)
 * @param {Object} props
 * @param {Array} props.selectedCards - 被選中準備編排故事的卡牌
 * @param {Function} props.onPublish - 發布故事的回調函數
 */
const PlayTheater = ({ selectedCards, onPublish }) => {
  const [orderedCards, setOrderedCards] = useState(selectedCards);
  const [dialogues, setDialogues] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setOrderedCards((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
      // 排序變動後清除舊對白，因為順序已變
      setDialogues([]);
    }
  };

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

  const handlePublish = () => {
    const storyData = {
      cards: orderedCards,
      dialogues,
      author: "Me",
      createdAt: new Date().toISOString(),
    };
    if (onPublish) {
      onPublish(storyData);
    } else {
      console.log("Publishing story:", storyData);
      alert("Story Published Successfully!");
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-lg border border-gray-200">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <span>🎬</span> The Play Theater
      </h2>
      
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 mb-6 min-h-[200px]">
          <SortableContext 
            items={orderedCards.map(c => c.id)}
            strategy={horizontalListSortingStrategy}
          >
            {orderedCards.map((card, index) => (
              <SortableCard 
                key={card.id} 
                card={card} 
                index={index} 
                dialogue={dialogues[index]} 
              />
            ))}
          </SortableContext>
        </div>
      </DndContext>

      <div className="flex justify-between items-center mt-4">
        <p className="text-sm text-gray-500">
          {orderedCards.length} scenes selected.
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleGenerateStory}
            disabled={isGenerating || orderedCards.length === 0}
            className="px-6 py-2 bg-white border-2 border-black text-black rounded-full hover:bg-gray-50 disabled:bg-gray-100 disabled:border-gray-300 disabled:text-gray-400 transition-colors"
          >
            {isGenerating ? "AI Writing..." : "Generate AI Dialogues"}
          </button>
          <button
            onClick={handlePublish}
            disabled={isGenerating || orderedCards.length === 0 || dialogues.length === 0}
            className="px-6 py-2 bg-black text-white rounded-full hover:bg-gray-800 disabled:bg-gray-300 transition-colors flex items-center gap-2"
          >
            <span>🚀</span> Publish Story
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlayTheater;
