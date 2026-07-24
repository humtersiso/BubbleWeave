import {
  composePanelImage,
  normalizePanelBubbles,
  resolveCardPartySize,
  MANGA_PANEL_COMPOSE_WIDTH,
} from './speechBubble.js';

/**
 * 開發時把發布故事寫入 data/generated/publish-log/（經 Vite middleware）
 * 方便對照實圖與 face／bubble 座標
 */
export const dumpPublishedStory = async (story) => {
  if (!import.meta.env.DEV) return null;
  if (!story?.cards?.length) return null;

  const panels = [];
  for (let i = 0; i < story.cards.length; i += 1) {
    const card = story.cards[i];
    const bubbles = story.panelBubbles?.[i] || [];
    const normalized = normalizePanelBubbles(card, bubbles);
    let composedJpeg = null;
    try {
      composedJpeg = await composePanelImage(card, normalized, {
        width: MANGA_PANEL_COMPOSE_WIDTH,
        mime: 'image/jpeg',
        quality: 0.88,
        debugFaces: false,
      });
    } catch {
      /* skip image */
    }
    panels.push({
      i: i + 1,
      partySize: resolveCardPartySize(card),
      characterIds: card.characterIds || [],
      scene: card.scene || card.recipe?.scene || '',
      bubbles: normalized.map((b) => ({
        speakerId: b.speakerId,
        speaker: b.speaker,
        text: b.text,
        face: b.face,
        slot: b.slot,
      })),
      faceDebug: normalized.map((b) => ({
        speakerId: b.speakerId,
        raw: b.face,
        note: 'layout 會做 content-fit 映射；YOLO 來源 lift=0',
      })),
      composedJpeg,
    });
  }

  try {
    const res = await fetch('/__bw/publish-dump', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: story.id,
        title: story.title,
        createdAt: story.createdAt,
        theme: story.theme,
        dialogues: story.dialogues,
        panels,
      }),
    });
    if (!res.ok) throw new Error(`dump HTTP ${res.status}`);
    return res.json();
  } catch (err) {
    console.warn('[publish-dump]', err);
    return null;
  }
};
