import React from 'react';

/**
 * 倉庫卡片展示組件 (Grid View)
 * @param {Object} props
 * @param {Array} props.cards - 卡牌資料陣列
 * @param {Function} props.onCardClick - 點擊卡牌的回調函數
 */
const WarehouseGrid = ({ cards, onCardClick }) => {
  return (
    <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg overflow-y-auto max-h-[600px]">
      {cards.map((card) => (
        <div 
          key={card.id} 
          className="relative group cursor-pointer border-2 border-transparent hover:border-black transition-all rounded-md overflow-hidden bg-white shadow-sm"
          onClick={() => onCardClick && onCardClick(card)}
        >
          <img 
            src={card.imageUrl} 
            alt={card.id} 
            className="w-full h-40 object-cover grayscale group-hover:grayscale-0 transition-all"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-[10px] p-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {new Date(card.timestamp).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  );
};

export default WarehouseGrid;
