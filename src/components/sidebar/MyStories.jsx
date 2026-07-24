import React from 'react';
import { IconDownload } from '../Icons.jsx';

export default function MyStories({ stories, onOpen, onExport }) {
  return (
    <section className="panel flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-b-2 border-ink-950 px-4 py-3">
        <h2 className="font-display text-lg font-bold">故事記錄</h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {stories.length === 0 ? (
          <p className="py-8 text-center text-sm italic text-ink-400">尚無故事</p>
        ) : (
          <ul className="space-y-2">
            {stories.map((story) => (
              <li key={story.id}>
                <div className="flex items-center gap-2 rounded-xl border-2 border-ink-200 bg-ink-50/60 p-2 transition hover:border-ink-950">
                  <button
                    type="button"
                    onClick={() => onOpen?.(story)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <div className="flex -space-x-2">
                      {story.cards.slice(0, 3).map((card, i) => (
                        <img
                          key={`${story.id}-thumb-${i}`}
                          src={card.imageUrl}
                          alt=""
                          className="h-10 w-8 rounded border border-ink-950 object-cover grayscale"
                        />
                      ))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-ink-800">
                        {story.title || `${story.cards.length} 格`}
                      </p>
                      <p className="mt-0.5 flex gap-3 text-[11px] text-ink-500">
                        <span>❤ {story.likes || 0}</span>
                        <span>⚡ {story.remixCount || 0}</span>
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    title="匯出"
                    onClick={() => onExport?.(story)}
                    className="btn-secondary shrink-0 !px-2 !py-1.5 !text-xs"
                  >
                    <IconDownload className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
