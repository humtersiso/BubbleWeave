import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DailyReward from './components/sidebar/DailyReward.jsx';
import Warehouse from './components/sidebar/Warehouse.jsx';
import MyStories from './components/sidebar/MyStories.jsx';
import PlayTheater from './components/theater/PlayTheater.jsx';
import ProfileCard from './components/profile/ProfileCard.jsx';
import Leaderboard from './components/community/Leaderboard.jsx';
import NewestFeed from './components/community/NewestFeed.jsx';
import { IconGift, IconHistory, IconTheater, IconSparkles, IconFlame, IconClose } from './components/Icons.jsx';
import {
  clearState,
  createId,
  getRewardCountdownSeconds,
  loadState,
  saveState,
} from './lib/storage.js';
import {
  bootstrapWarehouseFromSeason,
  claimDailyCards,
  generateCharacterPortraits,
  needsCardRebuild,
  needsWarehouseRebuild,
  portraitsComplete,
  TOTAL_BOOTSTRAP_CARDS,
} from './lib/warehouse.js';
import seasonTaiwan from '../data/generated/season-taiwan-diverse.json';
import { CHARACTERS } from './lib/casts.js';
import { buildDemoStories } from './lib/demoStories.js';
import { dumpPublishedStory } from './lib/publishDump.js';
import {
  hasApiKey,
  generateDialogues,
  generatePlayerPortraitFromPhoto,
  generatePlayerFaceIconOnWhite,
  STORY_STYLES,
} from './lib/gemini.js';
import { attachFacesToBubbles, attachFacesToStory, FACE_SOURCE_YOLO, prefetchCardFaces } from './lib/faceDetection.js';
import { buildStoryMeta, storyToMeta } from './lib/storyMeta.js';
import { splitStoryToDialogues } from './lib/storyText.js';
import { exportMangaStripImage } from './lib/exportMangaCanvas.js';
import { exportStoryAsHtml } from './lib/exportManga.js';
import { SEASON } from './lib/cardRecipes.js';
import { bubblesFromPlainLine } from './lib/speechBubble.js';
import {
  PLAYER_ID,
  defaultPlayerProfile,
  hasPlayerPortrait,
} from './lib/playerCharacter.js';
import {
  reframingPersonPortrait,
  cropDetectedFaceRegion,
  validatePlayerPhotoUpload,
} from './lib/playerPortraitProcess.js';
import { DEFAULT_BADGE_STYLE } from './lib/rarity.js';
import { APP_CHANNEL, APP_RELEASE } from './lib/appVersion.js';

const STORY_PACK_VERSION = 23;
/** 升版強制重建：新權重槽位 + season-taiwan-diverse.json */
const CARD_SCHEMA_VERSION = 35; // 3:4／1080×1440 場景卡
/** 僅簿記用；升版不會強制重跑既有 icon（見 warehouse.needsWarehouseRebuild） */
const PORTRAIT_VERSION = 25;

/** 再生成對白時，依「同格＋同說話者」保留手動對話框位置 */
function mergeManualBubblePositions(nextPanels = [], prevPanels = []) {
  return (nextPanels || []).map((panel, i) => {
    const prev = prevPanels[i] || [];
    return (panel || []).map((b) => {
      if (!b?.speakerId) return b;
      const old = prev.find((p) => p.speakerId === b.speakerId);
      if (!old?.manualPos) return b;
      return { ...b, manualPos: { ...old.manualPos } };
    });
  });
}

const migrateLegacyLocalStorage = async () => {
  try {
    const raw = localStorage.getItem('bubbleweave.v1');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.cards?.length) return null;
    await saveState({ ...parsed, initialized: true });
    localStorage.removeItem('bubbleweave.v1');
    return parsed;
  } catch {
    return null;
  }
};

export default function App() {
  const [cards, setCards] = useState([]);
  const [portraits, setPortraits] = useState({});
  const [stories, setStories] = useState([]);
  const [lastClaimAt, setLastClaimAt] = useState(null);
  const [theaterCards, setTheaterCards] = useState([]);
  const [theaterSession, setTheaterSession] = useState(0);
  const [focusCardId, setFocusCardId] = useState(null);
  const [bootProgress, setBootProgress] = useState({
    done: 0,
    total: TOTAL_BOOTSTRAP_CARDS,
    info: '',
  });
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [toast, setToast] = useState('');
  const [characterFilter, setCharacterFilter] = useState('all');
  const [view, setView] = useState('theater'); // 'theater' | 'newest' | 'hot'
  const [activeOverlay, setActiveOverlay] = useState(null); // 'reward' | 'history' | 'publish' | 'export' | null
  const [exportTarget, setExportTarget] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [theaterDialogues, setTheaterDialogues] = useState({});
  /** @type {[object[][], Function]} 與劇場卡序對齊的短對白氣泡 */
  const [theaterPanelBubbles, setTheaterPanelBubbles] = useState([]);

  // 劇本相關狀態
  const [storyText, setStoryText] = useState('');
  const [storyTheme, setStoryTheme] = useState('');
  const [storyStyleId, setStoryStyleId] = useState('comedy');
  const [editingDialogues, setEditingDialogues] = useState(false);
  /** 編輯模式的暫存氣泡 { [cardId]: { speakerId, text } } */
  const [editBubbles, setEditBubbles] = useState({});
  const faceDetectTimerRef = useRef(null);
  const [playerProfile, setPlayerProfile] = useState(() => defaultPlayerProfile());
  const [playerGenerating, setPlayerGenerating] = useState(false);
  const [playerGenStatus, setPlayerGenStatus] = useState('');
  const [rewardReveal, setRewardReveal] = useState(null);

  const persist = useCallback(async (next) => {
    await saveState(next);
  }, []);

  const showToast = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2800);
  }, []);

  const basePersist = useMemo(() => ({
    initialized: true,
    demoSeeded: true,
    storyPackVersion: STORY_PACK_VERSION,
    cardSchemaVersion: CARD_SCHEMA_VERSION,
    portraitVersion: PORTRAIT_VERSION,
    theme: 'atelier',
    portraits,
    playerProfile,
  }), [portraits, playerProfile]);

  const playerReady = hasPlayerPortrait(playerProfile, portraits);
  const badgeStyleId = playerProfile?.badgeStyleId || DEFAULT_BADGE_STYLE;
  const meCardCount = useMemo(
    () => cards.filter((c) => (c.characterIds || []).includes(PLAYER_ID)).length,
    [cards]
  );

  const handlePublish = async ({
    cards: publishedCards,
    dialogues,
    panelBubbles = [],
    storyText = '',
    theme = '',
    exportFormat = null,
  }) => {
    const createdAt = new Date().toISOString();
    const meta = buildStoryMeta(publishedCards, {
      author: '我',
      createdAt,
      theme,
    });
    const story = {
      id: createId('story'),
      author: meta.author,
      isMine: true,
      characterIds: publishedCards[0]?.characterIds,
      title: meta.title,
      theme: meta.theme,
      cast: meta.cast,
      cards: publishedCards,
      dialogues,
      panelBubbles,
      storyText,
      likes: 0,
      remixCount: 0,
      createdAt,
    };

    if (exportFormat === 'image') {
      await exportMangaStripImage({
        cards: publishedCards,
        panelLines: dialogues,
        panelBubbles,
        meta,
        filename: `bubbleweave-${Date.now()}.jpg`,
      });
    } else if (exportFormat === 'html') {
      await exportStoryAsHtml({
        cards: publishedCards,
        dialogues,
        panelBubbles,
        meta,
        filename: `bubbleweave-${Date.now()}.html`,
      });
    }

    const nextStories = [story, ...stories];
    setStories(nextStories);
    setTheaterCards([]);
    setTheaterSession((n) => n + 1);
    setTheaterDialogues({});
    setTheaterPanelBubbles([]);
    setStoryText('');
    setStoryTheme('');
    setEditingDialogues(false);
    setEditBubbles({});
    setFocusCardId(null);
    await persist({
      ...basePersist,
      cards,
      stories: nextStories,
      lastClaimAt,
    });
    // 開發用：寫入 data/generated/publish-log/ 方便對照實圖與座標
    dumpPublishedStory(story).then((r) => {
      if (r?.ok) console.info('[publish-dump]', r.dir);
    });
    showToast(
      exportFormat === 'image'
        ? '已發布並下載圖片'
        : exportFormat === 'html'
          ? '已發布並下載 HTML'
          : '故事串已發布！'
    );
    setView('newest');
  };

  const handleGenerateScript = async () => {
    if (!theaterCards.length) return;
    setGenerating(true);
    try {
      const rawOutline = storyText.trim();
      const outlineParts = [
        storyTheme.trim() ? `主題方向：${storyTheme.trim()}` : '',
        rawOutline && rawOutline.length < 180 ? rawOutline : '',
      ].filter(Boolean);

      const result = await generateDialogues(theaterCards, {
        styleId: storyStyleId,
        outline: outlineParts.join('\n'),
      });
      const lines = result.lines || [];
      const next = {};
      theaterCards.forEach((card, i) => {
        next[card.id] = lines[i] || '';
      });

      // 臉已在放卡時預熱：此處 await 通常很快，一次設好避免「先跳站位再跳臉」
      let bubbles = result.panelBubbles || [];
      // 再生成：保留使用者手動拖過的對話框位置（同格同說話者）
      bubbles = mergeManualBubblePositions(bubbles, theaterPanelBubbles);
      try {
        bubbles = await attachFacesToStory(theaterCards, bubbles, { force: false });
      } catch (err) {
        console.warn('face attach after generate:', err);
      }

      setTheaterDialogues(next);
      setTheaterPanelBubbles(bubbles);
      setStoryText(result.storyText || lines.join('\n\n'));
      if (result.theme) setStoryTheme(result.theme);
      setEditingDialogues(false);
      setEditBubbles({});
      const styleLabel =
        STORY_STYLES.find((s) => s.id === storyStyleId)?.label || '';
      showToast(styleLabel ? `已用「${styleLabel}」短對白生成！` : 'AI 短對白已生成！');
    } catch (err) {
      showToast(err.message || '生成失敗');
    } finally {
      setGenerating(false);
    }
  };

  /**
   * editBubbles 格式：{ [cardId]: { [speakerId]: { text, face, manualPos } } }
   * 提交成正式 panelBubbles；臉座標背景補，不擋關閉編輯
   */
  const commitEditBubbles = useCallback(() => {
    const draftBubbles = theaterCards.map((c, cardIdx) => {
      const perSpeaker = editBubbles[c.id] || {};
      const prevPanel = theaterPanelBubbles[cardIdx] || [];
      const bubbles = Object.entries(perSpeaker)
        .map(([sid, v]) => {
          const text = typeof v === 'string' ? v : v?.text;
          const face = typeof v === 'string' ? undefined : v?.face;
          const manualPos =
            (typeof v === 'object' && v?.manualPos) ||
            prevPanel.find((b) => b.speakerId === sid)?.manualPos;
          return text?.trim()
            ? {
                speakerId: sid,
                text: text.trim(),
                face,
                ...(manualPos ? { manualPos } : {}),
              }
            : null;
        })
        .filter(Boolean);
      if (!bubbles.length) return prevPanel;
      return bubbles;
    });
    setTheaterPanelBubbles(draftBubbles);
    const nextDialogues = {};
    theaterCards.forEach((c, i) => {
      const texts = (draftBubbles[i] || []).map((b) => b.text).filter(Boolean);
      nextDialogues[c.id] = texts.join('／') || theaterDialogues[c.id] || '';
    });
    setTheaterDialogues(nextDialogues);

    attachFacesToStory(theaterCards, draftBubbles, { force: false })
      .then((withFaces) => setTheaterPanelBubbles(withFaces))
      .catch((err) => console.warn('edit face attach failed:', err));
  }, [theaterCards, editBubbles, theaterPanelBubbles, theaterDialogues]);

  const handleBubbleMove = useCallback(
    ({ cardId, speakerId, index, manualPos }) => {
      setTheaterPanelBubbles((prev) => {
        const cardIdx = theaterCards.findIndex((c) => c.id === cardId);
        if (cardIdx < 0) return prev;
        const next = [...prev];
        while (next.length <= cardIdx) next.push([]);
        const panel = [...(next[cardIdx] || [])];
        let hit = -1;
        if (typeof index === 'number' && panel[index]?.speakerId === speakerId) {
          hit = index;
        } else {
          hit = panel.findIndex((b) => b.speakerId === speakerId);
        }
        if (hit < 0) return prev;
        panel[hit] = { ...panel[hit], manualPos };
        next[cardIdx] = panel;
        return next;
      });
    },
    [theaterCards]
  );

  const handlePublishClick = () => {
    const hasDialogue = theaterCards.some((c) => (theaterDialogues[c.id] || '').trim());
    if (!theaterCards.length || !hasDialogue) {
      showToast('請先用「編輯」輸入對白或先按 AI 生成');
      return;
    }
    setActiveOverlay('publish');
  };

  const handlePublishWithFormat = async (exportFormat) => {
    if (!theaterCards.length || publishing) return;
    setPublishing(true);
    setActiveOverlay(null);
    try {
      const dialogues = theaterCards.map((c) => theaterDialogues[c.id] || '');
      let panelBubbles =
        theaterPanelBubbles.length === theaterCards.length
          ? theaterPanelBubbles
          : theaterCards.map((c, i) => bubblesFromPlainLine(c, dialogues[i] || ''));
      try {
        panelBubbles = await attachFacesToStory(theaterCards, panelBubbles, {
          force: true,
        });
        setTheaterPanelBubbles(panelBubbles);
      } catch (err) {
        console.warn('publish face detect:', err);
      }
      await handlePublish({
        cards: theaterCards,
        dialogues,
        panelBubbles,
        storyText,
        theme: storyTheme,
        exportFormat,
      });
    } catch (err) {
      showToast(err.message || '匯出失敗，請重試');
    } finally {
      setPublishing(false);
    }
  };

  const handleExportStoryClick = (story) => {
    if (!story?.cards?.length) {
      showToast('此故事沒有可匯出的分鏡');
      return;
    }
    setExportTarget(story);
    setActiveOverlay('export');
  };

  const handleExportPublishedWithFormat = async (exportFormat) => {
    if (!exportTarget?.cards?.length || publishing) return;
    setPublishing(true);
    setActiveOverlay(null);
    try {
      const cards = exportTarget.cards;
      const dialogues =
        exportTarget.dialogues?.length === cards.length
          ? exportTarget.dialogues
          : splitStoryToDialogues(exportTarget.storyText || '', cards.length);
      const meta = storyToMeta(exportTarget);
      const stamp = Date.now();

      if (exportFormat === 'image') {
        await exportMangaStripImage({
          cards,
          panelLines: dialogues,
          panelBubbles: exportTarget.panelBubbles || [],
          meta,
          filename: `bubbleweave-${stamp}.jpg`,
        });
        showToast('已下載圖片');
      } else if (exportFormat === 'html') {
        await exportStoryAsHtml({
          cards,
          dialogues,
          panelBubbles: exportTarget.panelBubbles || [],
          meta,
          filename: `bubbleweave-${stamp}.html`,
        });
        showToast('已下載 HTML');
      }
    } catch (err) {
      showToast(err.message || '匯出失敗，請重試');
    } finally {
      setPublishing(false);
      setExportTarget(null);
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'atelier');
  }, []);

  const mergeStories = useCallback((warehouseCards, existingStories, storyPackVersion) => {
    const list = existingStories || [];
    const userStories = list.filter((s) => !String(s.id).startsWith('demo-'));
    const existingDemos = list.filter((s) => String(s.id).startsWith('demo-'));

    if (warehouseCards.filter((c) => c.characterIds?.length).length < CHARACTERS.length) {
      return { stories: userStories, storyPackVersion: STORY_PACK_VERSION };
    }

    if (storyPackVersion === STORY_PACK_VERSION && existingDemos.length > 0) {
      return { stories: [...userStories, ...existingDemos], storyPackVersion };
    }

    return {
      stories: [...userStories, ...buildDemoStories(warehouseCards)],
      storyPackVersion: STORY_PACK_VERSION,
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const runBootstrap = async (existingPortraits = {}) => {
      const haveAll = CHARACTERS.every((c) => Boolean(existingPortraits?.[c.id]));
      let faceMap = existingPortraits || {};

      if (!haveAll) {
        setBootProgress({
          done: 0,
          total: CHARACTERS.length,
          info: '階段一：補齊缺的角色肖像…',
        });
        faceMap = await generateCharacterPortraits((done, total, name) => {
          if (!cancelled) {
            setBootProgress({
              done,
              total,
              info: name ? `階段一：${name}` : '階段一：補齊角色肖像…',
            });
          }
        }, existingPortraits);
        if (cancelled) return;
      } else {
        // 既有 icon 視為定案：靈感池升級只重跑場景卡
        setBootProgress({
          done: CHARACTERS.length,
          total: CHARACTERS.length,
          info: '階段一：沿用現有角色 icon',
        });
      }

      setBootProgress({ done: 0, total: TOTAL_BOOTSTRAP_CARDS, info: '階段二：生成場景卡…' });
      const generated = await bootstrapWarehouseFromSeason(
        seasonTaiwan.cards,
        faceMap,
        (done, total, info) => {
          if (!cancelled) {
            setBootProgress({
              done,
              total,
              info: info ? `階段二：${info}` : '階段二：生成場景卡…',
            });
          }
        }
      );
      if (cancelled) return;

      const merged = mergeStories(generated, [], 0);
      setPortraits(faceMap);
      setCards(generated);
      setStories(merged.stories);
      setLastClaimAt(null);
      setCharacterFilter('all');
      await saveState({
        cards: generated,
        portraits: faceMap,
        portraitVersion: PORTRAIT_VERSION,
        stories: merged.stories,
        lastClaimAt: null,
        initialized: true,
        demoSeeded: true,
        storyPackVersion: merged.storyPackVersion,
        cardSchemaVersion: CARD_SCHEMA_VERSION,
        theme: 'atelier',
      });
    };

    const boot = async () => {
      setBooting(true);
      setBootError('');

      await migrateLegacyLocalStorage();
      const cached = await loadState();

      const cacheReady =
        cached.initialized &&
        !needsWarehouseRebuild(cached, CARD_SCHEMA_VERSION, PORTRAIT_VERSION);

      if (cacheReady) {
        if (cancelled) return;
        const merged = mergeStories(
          cached.cards,
          cached.stories || [],
          cached.storyPackVersion
        );
        setCards(cached.cards);
        setPortraits(cached.portraits || {});
        setPlayerProfile({
          ...defaultPlayerProfile(),
          ...(cached.playerProfile || {}),
          portraitUrl:
            cached.playerProfile?.portraitUrl ||
            cached.portraits?.[PLAYER_ID] ||
            null,
          iconUrl:
            cached.playerProfile?.iconUrl ||
            cached.portraits?.[PLAYER_ID] ||
            null,
        });
        setStories(merged.stories);
        setLastClaimAt(cached.lastClaimAt);
        setBooting(false);
        return;
      }

      if (!hasApiKey()) {
        setBootError('請在專案根目錄建立 .env，並設定 VITE_GEMINI_API_KEY。');
        setBooting(false);
        return;
      }

      try {
        // 場景卡已符合 schema、只缺肖像 → 只補 icon，不重跑整池
        const cardsOk =
          cached.initialized &&
          !needsCardRebuild(cached, CARD_SCHEMA_VERSION) &&
          Array.isArray(cached.cards) &&
          cached.cards.length > 0;

        if (cardsOk && !portraitsComplete(cached.portraits || {})) {
          showToast('補齊缺的角色 icon…');
          setBootProgress({
            done: 0,
            total: CHARACTERS.length,
            info: '補齊角色肖像…',
          });
          const faceMap = await generateCharacterPortraits((done, total, name) => {
            if (!cancelled) {
              setBootProgress({
                done,
                total,
                info: name ? `肖像：${name}` : '補齊角色肖像…',
              });
            }
          }, cached.portraits || {});
          if (cancelled) return;
          const merged = mergeStories(
            cached.cards,
            cached.stories || [],
            cached.storyPackVersion
          );
          setPortraits(faceMap);
          setCards(cached.cards);
          setStories(merged.stories);
          setLastClaimAt(cached.lastClaimAt);
          await saveState({
            ...cached,
            portraits: faceMap,
            portraitVersion: PORTRAIT_VERSION,
            stories: merged.stories,
            storyPackVersion: merged.storyPackVersion,
            cardSchemaVersion: CARD_SCHEMA_VERSION,
            initialized: true,
            theme: 'atelier',
          });
          return;
        }

        if (cached.initialized) {
          showToast(
            portraitsComplete(cached.portraits || {})
              ? '靈感池升級中（沿用現有角色 icon）…'
              : '靈感池升級中…'
          );
        }
        await runBootstrap(cached.portraits || {});
      } catch (err) {
        if (!cancelled) {
          setBootError(err.message || '靈感池初始化失敗，請檢查 API 金鑰與配額。');
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    };

    boot();
    return () => {
      cancelled = true;
    };
  }, [mergeStories, showToast]);

  useEffect(() => {
    const tick = () => setCountdown(getRewardCountdownSeconds(lastClaimAt));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [lastClaimAt]);

  const canClaim = countdown === 0 && !claiming && !booting;
  const hasDialogue = useMemo(
    () => theaterCards.some((c) => (theaterDialogues[c.id] || '').trim()),
    [theaterCards, theaterDialogues]
  );
  const selectedIds = useMemo(
    () => new Set(theaterCards.map((c) => c.id)),
    [theaterCards]
  );

  const focusCard = useMemo(() => {
    if (!theaterCards.length) return null;
    return (
      theaterCards.find((c) => c.id === focusCardId) ||
      theaterCards[theaterCards.length - 1]
    );
  }, [theaterCards, focusCardId]);

  const myStories = useMemo(
    () => stories.filter((s) => s.author === 'Me' || s.isMine || s.author === '我'),
    [stories]
  );

  const handleSelectCard = (card) => {
    if (!card?.characterIds?.length && !card?.imageUrl) {
      showToast('此卡缺少圖片，無法加入劇場');
      return;
    }
    const exists = theaterCards.some((c) => c.id === card.id);
    if (exists) {
      const next = theaterCards.filter((c) => c.id !== card.id);
      setTheaterCards(next);
      setFocusCardId((cur) => {
        if (cur !== card.id) return cur;
        return next.length ? next[next.length - 1].id : null;
      });
      return;
    }
    setTheaterCards([...theaterCards, card]);
    setFocusCardId(card.id);
    // 放卡即背景預熱臉辨識，之後 AI／編輯幾乎零等待
    prefetchCardFaces(card);
  };

  const handleDropCardId = (cardId) => {
    const card = cards.find((c) => c.id === cardId);
    if (card) handleSelectCard(card);
  };

  const handleReorderTheaterCards = (fromIndex, toIndex) => {
    setTheaterCards((prev) => {
      const next = [...prev];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    });
    setTheaterPanelBubbles((prev) => {
      if (!prev?.length) return prev;
      const next = [...prev];
      while (next.length < theaterCards.length) next.push([]);
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item || []);
      return next;
    });
  };

  const handleClaim = async () => {
    if (!canClaim || !playerReady) return;
    setClaiming(true);
    setClaimError('');
    try {
      const rewardCards = await claimDailyCards(
        seasonTaiwan.cards,
        portraits,
        cards,
        3,
        { playerProfile, requirePlayer: true }
      );
      const nextCards = [...rewardCards, ...cards];
      const claimedAt = new Date().toISOString();
      setCards(nextCards);
      setLastClaimAt(claimedAt);
      setRewardReveal(rewardCards);
      setActiveOverlay('reward');
      await persist({
        ...basePersist,
        cards: nextCards,
        stories,
        lastClaimAt: claimedAt,
      });
      showToast('開獎完成！三張都有你登場');
    } catch (err) {
      setClaimError(err.message || '領取失敗');
    } finally {
      setClaiming(false);
    }
  };

  const handlePlayerProfileChange = (patch) => {
    setPlayerProfile((prev) => {
      const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
      persist({ ...basePersist, playerProfile: next, cards, stories, lastClaimAt });
      return next;
    });
  };

  const handleSelectBadgeStyle = (styleId) => {
    handlePlayerProfileChange({ badgeStyleId: styleId });
  };

  const handleUploadPlayerPhoto = async (photoDataUrl) => {
    if (!hasApiKey()) {
      showToast('請先設定 VITE_GEMINI_API_KEY');
      return;
    }
    setPlayerGenerating(true);
    setPlayerGenStatus('檢查照片中…');
    try {
      // 防呆：單人＋臉夠清楚，否則直接擋下（不進轉繪）
      await validatePlayerPhotoUpload(photoDataUrl);

      const name = playerProfile.displayName || '我';
      setPlayerGenStatus('轉繪全身中…');
      const rawStylized = await generatePlayerPortraitFromPhoto(photoDataUrl, {
        displayName: name,
      });
      setPlayerGenStatus('構圖調整中…');
      const portraitUrl = await reframingPersonPortrait(rawStylized);
      setPlayerGenStatus('製作頭像 icon…');
      const { cropDataUrl } = await cropDetectedFaceRegion(portraitUrl);
      const iconUrl = await generatePlayerFaceIconOnWhite(cropDataUrl, {
        displayName: name,
      });
      const nextProfile = {
        ...playerProfile,
        displayName: name,
        rawPhotoUrl: photoDataUrl,
        portraitUrl,
        iconUrl,
        createdAt: playerProfile.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const nextPortraits = { ...portraits, [PLAYER_ID]: iconUrl };
      setPlayerProfile(nextProfile);
      setPortraits(nextPortraits);
      await persist({
        ...basePersist,
        portraits: nextPortraits,
        playerProfile: nextProfile,
        cards,
        stories,
        lastClaimAt,
      });
      showToast('個人角色與頭像 icon 已就緒');
    } catch (err) {
      showToast(err.message || '角色生成失敗');
      throw err;
    } finally {
      setPlayerGenerating(false);
      setPlayerGenStatus('');
    }
  };

  const handleLike = async (storyId) => {
    const nextStories = stories.map((s) =>
      s.id === storyId ? { ...s, likes: (s.likes || 0) + 1 } : s
    );
    setStories(nextStories);
    await persist({
      ...basePersist,
      cards,
      stories: nextStories,
      lastClaimAt,
    });
  };

  const handleRemix = async (story) => {
    const remixedCards = (story.cards || []).map((c) => ({ ...c }));
    const nextStories = stories.map((s) =>
      s.id === story.id ? { ...s, remixCount: (s.remixCount || 0) + 1 } : s
    );
    setStories(nextStories);
    setTheaterCards(remixedCards);
    setTheaterSession((n) => n + 1);
    setStoryText('');
    setTheaterDialogues({});
    setTheaterPanelBubbles([]);
    setEditingDialogues(false);
    setEditBubbles({});
    setFocusCardId(remixedCards.length ? remixedCards[remixedCards.length - 1].id : null);
    setView('theater');
    remixedCards.forEach((c) => prefetchCardFaces(c));
    await persist({
      ...basePersist,
      cards,
      stories: nextStories,
      lastClaimAt,
    });
    showToast('已複製到劇場（對白已清空），重新編輯吧！');
  };

  const handleRetryBoot = async () => {
    await clearState();
    window.location.reload();
  };

  if (booting) {
    const pct = Math.round((bootProgress.done / Math.max(bootProgress.total, 1)) * 100);
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="panel w-full max-w-md p-8 text-center">
          <h1 className="font-display text-3xl font-bold">織泡劇場</h1>
          <p className="mt-1 text-xs font-semibold tracking-wide text-accent">
            第 {SEASON.number} 季 · {SEASON.title}
          </p>
          <p className="mt-3 text-sm text-ink-500">準備中，請稍候…</p>
          {bootProgress.info && (
            <p className="mt-2 truncate text-xs text-ink-400">{bootProgress.info}</p>
          )}
          <div className="mt-6 h-3 overflow-hidden rounded-full border-2 border-ink-950 bg-ink-100">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-3 font-mono text-sm text-ink-600">
            {bootProgress.done} / {bootProgress.total}
          </p>
        </div>
      </div>
    );
  }

  if (bootError && cards.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="panel w-full max-w-md p-8 text-center">
          <h1 className="font-display text-2xl font-bold">暫時無法啟動</h1>
          <p className="mt-3 text-sm text-red-700">{bootError}</p>
          <button type="button" className="btn-primary mt-6" onClick={handleRetryBoot}>
            重試
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell min-h-screen">
      <header className="sticky top-0 z-40 border-b-[3px] border-ink-950 bg-[var(--header-bg)] backdrop-blur-md">
        <div className="mx-auto flex w-full items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex items-center gap-8">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
                織泡劇場 <span className="text-accent">BubbleWeave</span>
              </h1>
              <p className="mt-0.5 text-[11px] font-semibold tracking-wide text-ink-500">
                第 {SEASON.number} 季 · {SEASON.title}
                {APP_CHANNEL === 'v2-dev' ? (
                  <span className="ml-2 rounded border border-ink-300 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-ink-400">
                    v{APP_RELEASE}
                  </span>
                ) : null}
              </p>
            </div>
            <nav className="hidden items-center gap-1 md:flex">
              {[
                { id: 'theater', label: '劇場創作', icon: <IconTheater /> },
                { id: 'newest', label: '最新發布', icon: <IconSparkles /> },
                { id: 'hot', label: '熱門排行', icon: <IconFlame /> },
              ].map((n) => (
                <button
                  key={n.id}
                  onClick={() => setView(n.id)}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all ${
                    view === n.id
                      ? 'bg-ink-950 text-paper'
                      : 'text-ink-600 hover:bg-ink-100'
                  }`}
                >
                  {n.icon}
                  {n.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* 手機版導覽 (可選) */}
      <nav className="flex border-b-2 border-ink-950 bg-white md:hidden">
        {['theater', 'newest', 'hot'].map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 py-3 text-sm font-bold ${
              view === v ? 'bg-ink-950 text-paper' : 'text-ink-600'
            }`}
          >
            {v === 'theater' ? '劇場' : v === 'newest' ? '最新' : '熱門'}
          </button>
        ))}
      </nav>

      <main className="flex w-full flex-col gap-6 px-4 py-5 md:px-6">
        {view === 'theater' ? (
          <>
            {/* 上半部：個人卡 + 劇場 */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
              <ProfileCard
                profile={playerProfile}
                generating={playerGenerating}
                generatingStatus={playerGenStatus}
                meCardCount={meCardCount}
                badgeStyleId={badgeStyleId}
                onProfileChange={handlePlayerProfileChange}
                onUploadPhoto={handleUploadPlayerPhoto}
              />
              <div className="min-w-0 flex-1">
              <PlayTheater
                key={theaterSession}
                theaterCards={theaterCards}
                theaterDialogues={theaterDialogues}
                theaterPanelBubbles={theaterPanelBubbles}
                focusCardId={focusCard?.id}
                editing={editingDialogues}
                generating={generating}
                publishing={publishing}
                canPublish={Boolean(theaterCards.length && hasDialogue)}
                storyTheme={storyTheme}
                styleId={storyStyleId}
                onThemeChange={setStoryTheme}
                onStyleChange={setStoryStyleId}
                onToggleEdit={() => {
                  if (!editingDialogues) {
                    // 進入編輯：從現有 panelBubbles 或 dialogues 初始化暫存
                    const init = {};
                    theaterCards.forEach((c, i) => {
                      const existing = theaterPanelBubbles[i] || [];
                      if (existing.length) {
                        const perSpeaker = {};
                        existing.forEach((b) => {
                          perSpeaker[b.speakerId] = {
                            text: b.text,
                            face: b.face,
                            ...(b.manualPos ? { manualPos: b.manualPos } : {}),
                          };
                        });
                        init[c.id] = perSpeaker;
                      } else {
                        const firstId = c.characterIds?.[0] || '';
                        init[c.id] = firstId
                          ? { [firstId]: { text: theaterDialogues[c.id] || '', face: null } }
                          : {};
                      }
                    });
                    setEditBubbles(init);
                    setEditingDialogues(true);
                  } else {
                    commitEditBubbles();
                    setEditBubbles({});
                    setEditingDialogues(false);
                  }
                }}
                onGenerate={handleGenerateScript}
                onPublish={handlePublishClick}
                editBubbles={editBubbles}
                onBubbleMove={handleBubbleMove}
                onBubbleEdit={({ cardId, speakerId, text }) => {
                  const cardPrev = editBubbles[cardId] || {};
                  const prevRaw = cardPrev[speakerId];
                  const prevVal =
                    typeof prevRaw === 'string'
                      ? { text: prevRaw, face: null }
                      : prevRaw || {};
                  const cardNext = {
                    ...cardPrev,
                    [speakerId]: { ...prevVal, text }, // 保留 face／manualPos
                  };
                  const next = { ...editBubbles, [cardId]: cardNext };
                  setEditBubbles(next);
                  const bubbles = Object.entries(cardNext)
                    .map(([sid, v]) => {
                      const t = typeof v === 'string' ? v : v?.text;
                      const face = typeof v === 'string' ? undefined : v?.face;
                      const manualPos =
                        typeof v === 'object' ? v?.manualPos : undefined;
                      return t?.trim()
                        ? {
                            speakerId: sid,
                            text: t.trim(),
                            face,
                            ...(manualPos ? { manualPos } : {}),
                          }
                        : null;
                    })
                    .filter(Boolean);
                  const card = theaterCards.find((c) => c.id === cardId);
                  const idx = theaterCards.findIndex((c) => c.id === cardId);
                  if (idx < 0) return;
                  setTheaterPanelBubbles((prev) => {
                    const arr = [...prev];
                    while (arr.length <= idx) arr.push([]);
                    arr[idx] = bubbles;
                    return arr;
                  });
                  // 僅缺 face 時才偵測；debounce 拉長
                  const missing = bubbles.some(
                    (b) => !b.face || b.face.source !== FACE_SOURCE_YOLO
                  );
                  if (card && bubbles.length && missing) {
                    if (faceDetectTimerRef.current) {
                      window.clearTimeout(faceDetectTimerRef.current);
                    }
                    faceDetectTimerRef.current = window.setTimeout(() => {
                      attachFacesToBubbles(card, bubbles, { force: false })
                        .then((withFaces) => {
                          setTheaterPanelBubbles((prev) => {
                            const arr = [...prev];
                            while (arr.length <= idx) arr.push([]);
                            arr[idx] = withFaces;
                            return arr;
                          });
                          setEditBubbles((eb) => {
                            const per = { ...(eb[cardId] || {}) };
                            withFaces.forEach((b) => {
                              const cur = per[b.speakerId];
                              const curText = typeof cur === 'string' ? cur : cur?.text;
                              if (curText?.trim()) {
                                per[b.speakerId] = {
                                  text: curText,
                                  face: b.face,
                                  ...(b.manualPos
                                    ? { manualPos: b.manualPos }
                                    : typeof cur === 'object' && cur?.manualPos
                                      ? { manualPos: cur.manualPos }
                                      : {}),
                                };
                              }
                            });
                            return { ...eb, [cardId]: per };
                          });
                        })
                        .catch((err) => console.warn('edit face detect:', err));
                    }, 700);
                  }
                }}
                onFocusCard={setFocusCardId}
                onRemove={(id) => {
                  setTheaterCards((prev) => {
                    const next = prev.filter((c) => c.id !== id);
                    setFocusCardId((cur) => {
                      if (cur !== id) return cur;
                      return next.length ? next[next.length - 1].id : null;
                    });
                    if (!next.length) {
                      setTheaterDialogues({});
                      setTheaterPanelBubbles([]);
                      setStoryText('');
                      setStoryTheme('');
                      setEditingDialogues(false);
                      setEditBubbles({});
                      setTheaterSession((n) => n + 1);
                    }
                    return next;
                  });
                  setTheaterPanelBubbles((prev) => {
                    const idx = theaterCards.findIndex((c) => c.id === id);
                    if (idx < 0) return prev;
                    return prev.filter((_, i) => i !== idx);
                  });
                  setTheaterDialogues((prev) => {
                    const next = { ...prev };
                    delete next[id];
                    return next;
                  });
                }}
                onClear={() => {
                  setTheaterCards([]);
                  setTheaterSession((n) => n + 1);
                  setTheaterDialogues({});
                  setTheaterPanelBubbles([]);
                  setStoryText('');
                  setStoryTheme('');
                  setEditingDialogues(false);
                  setEditBubbles({});
                  setFocusCardId(null);
                }}
                onDropCardId={handleDropCardId}
                onReorder={handleReorderTheaterCards}
              />
              </div>
            </div>

            {/* 下半部：靈感池 */}
            <Warehouse
              cards={cards}
              selectedIds={selectedIds}
              focusCard={focusCard}
              onSelect={handleSelectCard}
              characterFilter={characterFilter}
              onCharacterFilterChange={setCharacterFilter}
              portraits={portraits}
              playerProfile={playerProfile}
              badgeStyleId={badgeStyleId}
              onSelectBadgeStyle={handleSelectBadgeStyle}
            />
          </>
        ) : (
          <div className="min-w-0">
            {view === 'hot' && (
              <Leaderboard
                stories={stories}
                onLike={handleLike}
                onRemix={handleRemix}
                onExport={handleExportStoryClick}
              />
            )}
            {view === 'newest' && (
              <NewestFeed
                stories={stories}
                onLike={handleLike}
                onRemix={handleRemix}
                onExport={handleExportStoryClick}
              />
            )}
          </div>
        )}
      </main>

      {/* 懸浮按鈕組 */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setActiveOverlay(activeOverlay === 'reward' ? null : 'reward')}
          className={`flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-ink-950 shadow-lift transition-all hover:-translate-y-1 active:translate-y-0 ${
            canClaim
              ? 'bg-accent text-white animate-pulse'
              : 'bg-white text-ink-600'
          }`}
          title="每日獎勵"
        >
          <IconGift className="h-7 w-7" />
        </button>

        <button
          type="button"
          onClick={() => setActiveOverlay(activeOverlay === 'history' ? null : 'history')}
          className="flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-ink-950 bg-white text-ink-600 shadow-lift transition-all hover:-translate-y-1 active:translate-y-0"
          title="故事紀錄"
        >
          <IconHistory className="h-7 w-7" />
        </button>
      </div>

      {/* 懸浮彈窗內容 */}
      {activeOverlay && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm"
            onClick={() => {
              setActiveOverlay(null);
              setExportTarget(null);
            }}
          />
          <div className="relative w-full max-w-md animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => {
                setActiveOverlay(null);
                setExportTarget(null);
              }}
              className="absolute -right-2 -top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-ink-950 bg-white font-bold shadow-sm transition hover:bg-ink-100"
            >
              <IconClose />
            </button>
            {activeOverlay === 'reward' && (
              <div className="overflow-hidden rounded-2xl border-[3px] border-ink-950 bg-white shadow-lift">
                <DailyReward
                  canClaim={canClaim}
                  countdownSeconds={countdown}
                  claiming={claiming}
                  onClaim={handleClaim}
                  error={claimError}
                  isModal={true}
                  playerReady={playerReady}
                  revealCards={rewardReveal}
                  badgeStyleId={badgeStyleId}
                  onCloseReveal={() => {
                    setRewardReveal(null);
                    setActiveOverlay(null);
                  }}
                />
              </div>
            )}
            {activeOverlay === 'history' && (
              <div className="max-h-[80vh] overflow-hidden rounded-2xl border-[3px] border-ink-950 bg-white">
                <MyStories
                  stories={myStories}
                  onOpen={(story) => {
                    handleRemix(story);
                    setActiveOverlay(null);
                  }}
                  onExport={(story) => {
                    setActiveOverlay(null);
                    handleExportStoryClick(story);
                  }}
                />
              </div>
            )}
            {activeOverlay === 'publish' && (
              <div className="overflow-hidden rounded-2xl border-[3px] border-ink-950 bg-white p-6 shadow-lift">
                <h3 className="font-display text-xl font-bold">發布並匯出</h3>
                <p className="mt-2 text-sm text-ink-500">
                  故事會寫入社群，並依你選擇的格式下載檔案。HTML 可用瀏覽器「列印 → 另存 PDF」。
                </p>
                <div className="mt-5 flex flex-col gap-2.5">
                  <button
                    type="button"
                    disabled={publishing}
                    className="btn-accent w-full !py-3"
                    onClick={() => handlePublishWithFormat('image')}
                  >
                    下載圖片檔（JPEG）
                  </button>
                  <button
                    type="button"
                    disabled={publishing}
                    className="btn-primary w-full !py-3"
                    onClick={() => handlePublishWithFormat('html')}
                  >
                    下載 HTML
                  </button>
                  <button
                    type="button"
                    disabled={publishing}
                    className="btn-secondary w-full !py-2.5 text-sm"
                    onClick={() => handlePublishWithFormat(null)}
                  >
                    只發布、不下載
                  </button>
                </div>
              </div>
            )}
            {activeOverlay === 'export' && (
              <div className="overflow-hidden rounded-2xl border-[3px] border-ink-950 bg-white p-6 shadow-lift">
                <h3 className="font-display text-xl font-bold">匯出已發布故事</h3>
                <p className="mt-2 text-sm text-ink-500">
                  {exportTarget?.theme || exportTarget?.title || '故事串'}
                </p>
                <p className="mt-1 text-xs text-ink-400">
                  HTML 可用瀏覽器「列印 → 另存 PDF」。
                </p>
                <div className="mt-5 flex flex-col gap-2.5">
                  <button
                    type="button"
                    disabled={publishing}
                    className="btn-accent w-full !py-3"
                    onClick={() => handleExportPublishedWithFormat('image')}
                  >
                    下載圖片檔（JPEG）
                  </button>
                  <button
                    type="button"
                    disabled={publishing}
                    className="btn-primary w-full !py-3"
                    onClick={() => handleExportPublishedWithFormat('html')}
                  >
                    下載 HTML
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border-2 border-ink-950 bg-ink-950 px-4 py-2.5 text-sm font-medium text-paper shadow-lift">
          {toast}
        </div>
      )}
    </div>
  );
}
