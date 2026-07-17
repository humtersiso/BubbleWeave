import React, { useState, useEffect } from 'react';
import WarehouseGrid from './components/WarehouseGrid.jsx';
import PlayTheater from './components/PlayTheater.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import StoryFeed from './components/StoryFeed.jsx';
import { initializeWarehouse } from './lib/warehouse.js';

function App() {
  const [cards, setCards] = useState([]);
  const [selectedCards, setSelectedCards] = useState([]);
  const [view, setView] = useState('warehouse'); // 'warehouse' | 'theater' | 'feed'
  const [stories, setStories] = useState([
    {
      id: 'demo-1',
      author: 'Admin',
      createdAt: new Date().toISOString(),
      cards: [
        { imageUrl: 'https://via.placeholder.com/400x600?text=Sample+1', scene: 'Office' },
        { imageUrl: 'https://via.placeholder.com/400x600?text=Sample+2', scene: 'Cafe' }
      ],
      dialogues: ['Why are you late?', 'The coffee was too good.'],
      likes: 12
    }
  ]);

  useEffect(() => {
    const loadCards = async () => {
      const initialCards = await initializeWarehouse();
      setCards(initialCards);
    };
    loadCards();
  }, []);

  const handleCardClick = (card) => {
    if (!selectedCards.find(c => c.id === card.id)) {
      setSelectedCards([...selectedCards, card]);
      // 自動切換到劇場模式方便編輯
      setView('theater');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-black">
      <nav className="bg-white border-b-2 border-black p-4 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-3xl font-black italic tracking-tighter">BUBBLE WEAVE</h1>
          <div className="flex gap-6 font-bold">
            <button onClick={() => setView('warehouse')} className={view === 'warehouse' ? 'underline decoration-4' : ''}>Warehouse</button>
            <button onClick={() => setView('theater')} className={view === 'theater' ? 'underline decoration-4' : ''}>Theater ({selectedCards.length})</button>
            <button onClick={() => setView('feed')} className={view === 'feed' ? 'underline decoration-4' : ''}>Community</button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto py-8 px-4 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {view === 'warehouse' && (
            <section>
              <h2 className="text-2xl font-bold mb-4 italic">Your Collection</h2>
              <WarehouseGrid cards={cards} onCardClick={handleCardClick} />
            </section>
          )}

          {view === 'theater' && (
            <section>
              <h2 className="text-2xl font-bold mb-4 italic">Story Workshop</h2>
              <PlayTheater key={selectedCards.length} selectedCards={selectedCards} />
            </section>
          )}

          {view === 'feed' && (
            <section>
              <h2 className="text-2xl font-bold mb-4 italic">Latest Weaves</h2>
              <StoryFeed stories={stories} onLike={(id) => console.log('Liked', id)} />
            </section>
          )}
        </div>

        <aside className="space-y-8">
          <Leaderboard stories={stories} />
          <div className="p-6 bg-yellow-400 border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="font-bold text-lg mb-2">Editor's Tip 💡</h3>
            <p className="text-sm">Select cards from your warehouse, then head to the Theater to weave your silent comedy!</p>
          </div>
        </aside>
      </main>
    </div>
  );
}

export default App;
