import React, { useState } from 'react';
import { IconDownload } from '../../components/Icons.jsx';
import { buildStoryCaption, composeStoryExport } from '../lib/shareExport.js';
import { createShareLink, shareUrlForCode } from '../lib/shareApi.js';
import { fortuneDisplay } from '../data/fortune.js';
import { StepHeading } from './HelpTip.jsx';
import FortuneBubble from './FortuneBubble.jsx';
import FortuneCornerBadge, {
  loadBadgeStyle,
} from './FortuneCornerBadge.jsx';
import FortuneCardStage from './FortuneCardStage.jsx';
import { DIALOGUE_MAX_CHARS } from '../lib/fortuneDraw.js';

export default function StepShare({
  card,
  profile,
  playerId,
  onShared,
  onAgain,
  toast,
}) {
  const [busy, setBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [err, setErr] = useState('');
  const badgeStyle = loadBadgeStyle();

  if (!card) return null;
  const fortune = fortuneDisplay(card.fortuneId);
  const caption = buildStoryCaption({
    displayName: profile?.displayName,
    categoryId: card.categoryId,
    fortuneId: card.fortuneId,
  });
  const bubbleText =
    card.chosenIndex === 3
      ? String(card.customText || '').slice(0, DIALOGUE_MAX_CHARS)
      : card.dialogues?.[card.chosenIndex] || '';
  const bubblePos = card.manualPos || { x: 0.62, y: 0.16 };

  const download = (dataUrl, name) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = name;
    a.click();
  };

  const handleDownloadStory = async () => {
    setBusy(true);
    setErr('');
    try {
      const url = await composeStoryExport({
        cardImageUrl: card.imageUrl,
        caption,
        bubbleText,
        manualPos: bubblePos,
        fortuneId: card.fortuneId,
        fortuneLabel: fortune?.label || card.fortuneLabel,
        badgeStyle: badgeStyle || 'foil',
      });
      download(url, `kujiwords-story-${fortune?.label || 'card'}.jpg`);
      toast?.('已下載 9:16 限動圖（含對白）');
    } catch (e) {
      setErr(e.message || '匯出失敗');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateLink = async () => {
    setBusy(true);
    setErr('');
    try {
      const payload = {
        id: card.id,
        displayName: profile?.displayName || '我',
        categoryId: card.categoryId,
        fortuneId: card.fortuneId,
        fortuneLabel: card.fortuneLabel,
        fortuneEmoji: card.fortuneEmoji,
        imageUrl: card.imageUrl,
        dialogues: card.dialogues,
        chosenIndex: card.chosenIndex,
        customText: card.customText,
        manualPos: bubblePos,
        bubbleText,
        createdAt: card.createdAt,
      };
      const res = await createShareLink(playerId, payload);
      if (!res.ok) throw new Error(res.reason || '建立連結失敗');
      const url = shareUrlForCode(res.code);
      setShareUrl(url);
      onShared?.(res.code);
      try {
        await navigator.clipboard.writeText(url);
        toast?.('分享連結已複製');
      } catch {
        toast?.('分享連結已建立');
      }
    } catch (e) {
      setErr(e.message || '分享失敗');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden px-5 pb-3 pt-2">
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="shrink-0">
          <StepHeading
            step="STEP 5"
            title="分享改運"
            hint="下載限動圖，或產生連結給朋友；對方完成流程後可互拿卡片。"
            helpTitle="分享規則"
          >
            <p>限動圖會把對白與籤等一起燒進畫面，方便直接發限動。</p>
            <p>好友連結最多兌換 5 次；同一人同一連結只能兌一次，也不能自己兌自己。</p>
            <p>對方走完抽籤流程後，雙方會各拿到對方的籤卡。</p>
          </StepHeading>
        </div>

        <FortuneCardStage className="mt-3" imageUrl={card.imageUrl}>
          <FortuneCornerBadge fortune={fortune} variant={badgeStyle} />
          <FortuneBubble text={bubbleText} x={bubblePos.x} y={bubblePos.y} />
        </FortuneCardStage>

        <div className="mt-4 space-y-3 pb-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--ink)]/50">
            限動文案
          </p>
          <p className="border-2 border-[var(--ink)] bg-white px-3 py-2 text-[12px] font-semibold leading-snug">
            {caption}
          </p>

          {shareUrl ? (
            <p className="break-all border-2 border-[var(--ink)] bg-white px-3 py-2 text-xs">
              {shareUrl}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 shrink-0 space-y-2 border-t-2 border-dashed border-[var(--ink)]/15 pt-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="btn-secondary min-h-[44px]"
            onClick={handleDownloadStory}
            disabled={busy || !card.imageUrl}
          >
            <IconDownload className="h-4 w-4" />
            下載限動圖
          </button>
          <button
            type="button"
            className="btn-primary min-h-[44px]"
            onClick={handleCreateLink}
            disabled={busy}
          >
            產生好友連結
          </button>
        </div>
        <button
          type="button"
          className="btn-secondary w-full min-h-[40px] text-sm"
          onClick={onAgain}
          disabled={busy}
        >
          再抽一張
        </button>
        {err ? (
          <p className="border-2 border-[var(--ink)] bg-[color-mix(in_srgb,#dc2626_12%,white)] px-3 py-2 text-sm">
            {err}
          </p>
        ) : null}
      </div>
    </section>
  );
}
