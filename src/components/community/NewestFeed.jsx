import React from 'react';
import MangaStripView from '../manga/MangaStripView.jsx';
import { IconHeart, IconRemix, IconDownload } from '../Icons.jsx';

/**
 * Newest story chains feed.
 */
export default function NewestFeed({ stories, onLike, onRemix, onExport }) {
  const newest = [...stories].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  return (
    <section className="panel flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-b-2 border-ink-950 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-400">
          Newest
        </p>
        <h2 className="mt-0.5 font-display text-xl font-bold">最新發布</h2>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {newest.length === 0 ? (
          <p className="py-10 text-center text-sm italic text-ink-400">社群尚無故事串</p>
        ) : (
          newest.map((story) => (
            <article
              key={story.id}
              className="overflow-hidden rounded-xl border-2 border-ink-950 bg-[var(--strip-bg)]"
            >
              <header className="border-b-2 border-ink-950 bg-ink-50 px-3 py-2">
                <p className="truncate text-sm font-semibold">
                  {story.theme || story.title || `${story.cards?.length || 0} 格故事串`}
                </p>
                <p className="text-[11px] text-ink-500">
                  {story.author} · {new Date(story.createdAt).toLocaleString('zh-TW')}
                </p>
              </header>
              <div className="p-3">
                <MangaStripView
                  cards={story.cards}
                  storyText={story.storyText}
                  dialogues={story.dialogues}
                  panelBubbles={story.panelBubbles}
                  showScript={false}
                  compact
                  adaptive
                />
              </div>
              <div className="flex flex-wrap gap-2 border-t border-ink-200 px-3 py-2">
                <button
                  type="button"
                  className="btn-secondary !py-1.5 !text-xs"
                  onClick={() => onLike(story.id)}
                >
                  <IconHeart className="mr-1 h-3 w-3" /> {story.likes || 0}
                </button>
                <button
                  type="button"
                  className="btn-secondary !py-1.5 !text-xs"
                  onClick={() => onExport?.(story)}
                >
                  <IconDownload className="mr-1 h-3 w-3" /> 匯出
                </button>
                <button
                  type="button"
                  className="btn-accent !py-1.5 !text-xs"
                  onClick={() => onRemix(story)}
                >
                  <IconRemix className="mr-1 h-3 w-3" /> Remix
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
