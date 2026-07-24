import React, { useEffect, useRef, useState } from 'react';
import { DEFAULT_BADGE_STYLE, computePlayerRank } from '../../lib/rarity.js';
import RarityBadge from '../rarity/RarityBadge.jsx';
import { IconSparkles } from '../Icons.jsx';

/**
 * 個人資料卡：預設展示態（點擊資料區進入編輯），含玩家收藏等級。
 */
export default function ProfileCard({
  profile,
  generating = false,
  generatingStatus = '',
  meCardCount = 0,
  badgeStyleId = DEFAULT_BADGE_STYLE,
  onProfileChange,
  onUploadPhoto,
}) {
  const fileRef = useRef(null);
  const nameRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(profile?.displayName || '我');
  const [draftBio, setDraftBio] = useState(profile?.bio || '');
  const [localError, setLocalError] = useState('');

  const portrait = profile?.portraitUrl || null;
  const rank = computePlayerRank(meCardCount);
  const styleId = badgeStyleId || DEFAULT_BADGE_STYLE;

  useEffect(() => {
    if (!editing) {
      setDraftName(profile?.displayName || '我');
      setDraftBio(profile?.bio || '');
    }
  }, [profile?.displayName, profile?.bio, editing]);

  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => nameRef.current?.focus());
    }
  }, [editing]);

  const openEdit = () => {
    setDraftName(profile?.displayName || '我');
    setDraftBio(profile?.bio || '');
    setEditing(true);
  };

  const saveEdit = () => {
    onProfileChange?.({
      displayName: (draftName || '我').trim().slice(0, 16) || '我',
      bio: (draftBio || '').trim().slice(0, 40),
    });
    setEditing(false);
  };

  const cancelEdit = () => {
    setDraftName(profile?.displayName || '我');
    setDraftBio(profile?.bio || '');
    setEditing(false);
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLocalError('請上傳圖片檔');
      return;
    }
    setLocalError('');
    try {
      const dataUrl = await readFileAsDataUrl(file);
      await onUploadPhoto?.(dataUrl);
    } catch (err) {
      setLocalError(err.message || '上傳失敗');
    }
  };

  return (
    <aside className="profile-card panel relative flex h-[440px] w-full max-w-[260px] flex-col overflow-hidden lg:max-w-[280px]">
      <div className="profile-card__grain pointer-events-none absolute inset-0" aria-hidden />

      {/* 資料區：點擊進入編輯 */}
      <div className="relative z-[1] border-b-2 border-ink-950">
        {editing ? (
          <div className="space-y-2 bg-white/70 px-3 py-2.5 backdrop-blur-[2px]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
                編輯資料
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  className="rounded border border-ink-300 px-2 py-0.5 text-[10px] font-bold text-ink-500 hover:border-ink-950"
                  onClick={cancelEdit}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="rounded border border-ink-950 bg-ink-950 px-2 py-0.5 text-[10px] font-bold text-paper"
                  onClick={saveEdit}
                >
                  完成
                </button>
              </div>
            </div>
            <input
              ref={nameRef}
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value.slice(0, 16))}
              placeholder="暱稱"
              className="w-full border-0 border-b-2 border-ink-200 bg-transparent font-display text-lg font-bold outline-none focus:border-accent"
            />
            <input
              type="text"
              value={draftBio}
              onChange={(e) => setDraftBio(e.target.value.slice(0, 40))}
              placeholder="一句介紹（可選）"
              className="w-full rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-[11px] text-ink-600 outline-none focus:border-ink-950"
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit();
                if (e.key === 'Escape') cancelEdit();
              }}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={openEdit}
            className="group w-full px-3 py-2.5 text-left transition hover:bg-white/50"
            title="點擊編輯個人資料"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-400">
                  Player
                </p>
                <h3 className="mt-0.5 truncate font-display text-xl font-bold leading-tight text-ink-950 group-hover:text-accent">
                  {profile?.displayName || '我'}
                </h3>
                <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-ink-500">
                  {profile?.bio?.trim() || '點此編輯介紹'}
                </p>
              </div>
              <span className="mt-1 shrink-0 rounded-full border border-ink-300 bg-white/80 px-2 py-0.5 text-[9px] font-bold text-ink-400 opacity-0 transition group-hover:opacity-100">
                編輯
              </span>
            </div>
          </button>
        )}
      </div>

      {/* 角色圖＋等級 */}
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col gap-2 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold tracking-wide text-ink-500">我的 2D 角色</p>
          <div className="flex items-center gap-1.5" title={`含你登場的靈感卡 ${rank.meCardCount} 張`}>
            <RarityBadge tier={rank.id} styleId={styleId} size="sm" />
            <span className="text-[10px] font-bold text-ink-600">{rank.labelZh}</span>
          </div>
        </div>

        <div className="profile-card__frame relative min-h-0 w-full flex-1 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(255,255,255,0.9),rgba(244,241,235,0.5))]" />
          {portrait ? (
            <img
              src={portrait}
              alt={profile?.displayName || '我'}
              className="relative z-[1] h-full w-full object-contain"
              draggable={false}
            />
          ) : (
            <div className="relative z-[1] flex h-full flex-col items-center justify-center gap-1 px-3 text-center">
              <p className="font-display text-sm font-semibold text-ink-500">上傳個人照</p>
              <p className="text-[10px] text-ink-400">轉成平台墨線角色</p>
            </div>
          )}

          {/* 角落等級印 */}
          <div className="pointer-events-none absolute bottom-2 left-2 z-[2]">
            <RarityBadge tier={rank.id} styleId={styleId} size="md" />
          </div>

          {rank.nextAt != null ? (
            <div className="pointer-events-none absolute bottom-2 right-2 z-[2] rounded border border-ink-950/20 bg-white/85 px-1.5 py-0.5 text-[9px] font-bold text-ink-500 backdrop-blur-[1px]">
              {rank.meCardCount}/{rank.nextAt}
            </div>
          ) : (
            <div className="pointer-events-none absolute bottom-2 right-2 z-[2] rounded border border-ink-950/20 bg-white/85 px-1.5 py-0.5 text-[9px] font-bold text-ink-500">
              MAX
            </div>
          )}

          {generating ? (
            <div className="absolute inset-0 z-[3] flex flex-col items-center justify-center bg-paper/80 backdrop-blur-[1px]">
              <IconSparkles className="h-6 w-6 animate-spin text-accent" />
              <p className="mt-2 text-[10px] font-bold text-ink-700">
                {generatingStatus || '處理中…'}
              </p>
            </div>
          ) : null}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/jpg"
          className="hidden"
          onChange={handleFile}
        />
        <button
          type="button"
          className="btn-accent relative z-[1] w-full !py-1.5 !text-xs"
          disabled={generating}
          onClick={() => fileRef.current?.click()}
        >
          {portrait ? '更換照片' : '上傳照片'}
        </button>

        {localError ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-[10px] leading-snug text-amber-950">
            {localError}
          </p>
        ) : (
          <p className="text-[10px] leading-snug text-ink-400">
            請傳單人、正面、臉清楚的照片；多人或不清楚會無法繪製。
          </p>
        )}
      </div>
    </aside>
  );
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('讀取圖片失敗'));
    reader.readAsDataURL(file);
  });
}
