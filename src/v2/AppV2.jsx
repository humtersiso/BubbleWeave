import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createId, loadState, saveState } from '../lib/storage.js';
import {
  generatePlayerFaceIconOnWhite,
  generatePlayerPortraitFromPhoto,
  hasApiKey,
} from '../lib/gemini.js';
import {
  cropDetectedFaceRegion,
  preparePlayerPhotoFile,
  reframingPersonPortrait,
  validatePlayerPhotoUpload,
} from '../lib/playerPortraitProcess.js';
import { defaultPlayerProfile, PLAYER_ID } from '../lib/playerCharacter.js';
import { CHARACTERS } from '../lib/casts.js';
import {
  generateCharacterPortraits,
  portraitsComplete,
} from '../lib/warehouse.js';
import { buildPersonalityTags } from './lib/personality.js';
import {
  DIALOGUE_MAX_CHARS,
  drawFortuneCard,
  recolorFortuneInk,
} from './lib/fortuneDraw.js';
import {
  claimShareMutual,
  fetchIncomingCopiesForOwner,
  fetchShareLink,
  upsertPlayerRemote,
} from './lib/shareApi.js';
import FloatingDock from './components/FloatingDock.jsx';
import { GallerySheet, HistorySheet, ProfileSheet } from './components/Sheets.jsx';
import StepUpload from './components/StepUpload.jsx';
import StepPersonality from './components/StepPersonality.jsx';
import StepDraw from './components/StepDraw.jsx';
import StepDialogue from './components/StepDialogue.jsx';
import StepShare from './components/StepShare.jsx';
import ColorStyleSelect from './components/ColorStyleSelect.jsx';
import { BRAND_MARK } from './lib/brand.js';
import { resolveFlowStep } from './lib/flowStep.js';
import { pickPsychQuizSetId, PSYCH_SET_BY_ID } from './data/psychQuiz.js';
import {
  colorStyleLabel,
  colorStyleStatus,
  DEFAULT_COLOR_STYLE,
  normalizeColorStyle,
} from './lib/colorStyles.js';

const parseHashRoute = () => {
  const h = String(window.location.hash || '').replace(/^#/, '');
  const m = h.match(/^\/?s\/([^/?#]+)/);
  return m ? { shareCode: decodeURIComponent(m[1]) } : { shareCode: null };
};

export default function AppV2() {
  const [booting, setBooting] = useState(true);
  const [playerId, setPlayerId] = useState(null);
  const [playerProfile, setPlayerProfile] = useState(() => defaultPlayerProfile());
  const [portraits, setPortraits] = useState({});
  const [fortuneCards, setFortuneCards] = useState([]);
  const [friendCopies, setFriendCopies] = useState([]);
  const [flowStep, setFlowStep] = useState(1);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSetId, setQuizSetId] = useState(null);
  const [tags, setTags] = useState([]);
  const [categoryId, setCategoryId] = useState(null);
  const [draftCard, setDraftCard] = useState(null);
  const [pendingShareCode, setPendingShareCode] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [drawPhase, setDrawPhase] = useState(null); // null | 'scan' | 'seal'
  const [sealLabel, setSealLabel] = useState('');
  const [colorStyle, setColorStyle] = useState(DEFAULT_COLOR_STYLE);

  const [previewUrl, setPreviewUrl] = useState('');
  const [pendingPhoto, setPendingPhoto] = useState('');
  const [faceOk, setFaceOk] = useState(false);
  const [checkStatus, setCheckStatus] = useState('');

  const portraitsRef = useRef(portraits);
  portraitsRef.current = portraits;

  const showToast = useCallback((msg) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 3200);
  }, []);

  const allGallery = useMemo(
    () => [...fortuneCards, ...friendCopies],
    [fortuneCards, friendCopies]
  );

  const persist = useCallback(async (patch) => {
    await saveState({
      initialized: true,
      theme: 'atelier',
      ...patch,
    });
  }, []);

  const warmCastPortraits = useCallback(async (base) => {
    if (portraitsComplete(base)) return base;
    try {
      const filled = await generateCharacterPortraits(() => {}, base);
      setPortraits(filled);
      await persist({ portraits: filled });
      return filled;
    } catch (err) {
      console.warn('portrait bootstrap', err);
      return base;
    }
  }, [persist]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const cached = await loadState();
        if (cancelled) return;

        let playerUuid = cached.playerId;
        if (!playerUuid || !/^[0-9a-f-]{36}$/i.test(playerUuid)) {
          playerUuid =
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `${Date.now().toString(16)}-0000-4000-8000-${Math.random()
                  .toString(16)
                  .slice(2, 14)
                  .padEnd(12, '0')}`;
        }

        const profile = { ...defaultPlayerProfile(), ...(cached.playerProfile || {}) };
        const nextPortraits = cached.portraits || {};
        const nextFortune = cached.fortuneCards || [];
        const nextFriends = cached.friendCopies || [];
        const draft = cached.draftCard || null;
        const { step, draft: resolvedDraft } = resolveFlowStep(cached, profile, draft);

        setPlayerId(playerUuid);
        setPlayerProfile(profile);
        setPortraits(nextPortraits);
        setFortuneCards(nextFortune);
        setFriendCopies(nextFriends);
        setTags(profile.tags || []);
        const answers = cached.quizAnswers || profile.quizAnswers || {};
        setQuizAnswers(answers);
        let nextQuizSetId = cached.quizSetId || profile.quizSetId || null;
        if (!nextQuizSetId || !PSYCH_SET_BY_ID[nextQuizSetId]) {
          nextQuizSetId = pickPsychQuizSetId();
        }
        setQuizSetId(nextQuizSetId);
        setCategoryId(cached.categoryId || null);
        setColorStyle(normalizeColorStyle(cached.colorStyle));
        setDraftCard(resolvedDraft);
        setFlowStep(step);

        const route = parseHashRoute();
        const pending = route.shareCode || cached.pendingShareCode || null;
        setPendingShareCode(pending);

        await saveState({
          ...cached,
          initialized: true,
          playerId: playerUuid,
          playerProfile: { ...profile, quizSetId: nextQuizSetId },
          portraits: nextPortraits,
          fortuneCards: nextFortune,
          friendCopies: nextFriends,
          flowStep: step,
          pendingShareCode: pending,
          draftCard: resolvedDraft,
          quizAnswers: answers,
          quizSetId: nextQuizSetId,
          categoryId: cached.categoryId || null,
          colorStyle: normalizeColorStyle(cached.colorStyle),
        });

        // 先解除載入畫面，四角生圖改背景（避免桌面載入畫面卡死）
        if (!cancelled) setBooting(false);

        upsertPlayerRemote(playerUuid, profile.displayName).catch(() => {});
        warmCastPortraits(nextPortraits);

        try {
          const incoming = await fetchIncomingCopiesForOwner(playerUuid);
          if (!cancelled && incoming.length) {
            const known = new Set((nextFriends || []).map((c) => c.id));
            const merged = [
              ...incoming.filter((c) => c?.id && !known.has(c.id)),
              ...(nextFriends || []),
            ];
            if (merged.length !== (nextFriends || []).length) {
              setFriendCopies(merged);
              await persist({ friendCopies: merged });
            }
          }
        } catch (err) {
          console.warn('claim sync', err);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setBooting(false);
          setError(err.message || '啟動失敗，請重新整理');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [persist, warmCastPortraits]);

  useEffect(() => {
    const onHash = () => {
      const { shareCode } = parseHashRoute();
      if (shareCode) {
        setPendingShareCode(shareCode);
        persist({ pendingShareCode: shareCode });
        showToast('好友邀請已載入，完成抽籤後可互拿卡片');
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [persist, showToast]);

  const clearUpload = () => {
    setPreviewUrl('');
    setPendingPhoto('');
    setFaceOk(false);
    setCheckStatus('');
    setError('');
  };

  const handleSelectFile = async (file) => {
    setError('');
    setFaceOk(false);
    setPendingPhoto('');
    setCheckStatus('讀取照片中…');
    try {
      const dataUrl = await preparePlayerPhotoFile(file);
      setPreviewUrl(dataUrl);
      setCheckStatus('找臉中（需清楚看到一張臉）…');
      await validatePlayerPhotoUpload(dataUrl);
      setPendingPhoto(dataUrl);
      setFaceOk(true);
      setCheckStatus('');
    } catch (err) {
      setFaceOk(false);
      setPendingPhoto('');
      setCheckStatus('');
      setError(err.message || '這張照片不合用，換一張試試');
    }
  };

  const handleConfirmPortrait = async (croppedDataUrl) => {
    setError('');
    if (!hasApiKey()) {
      setError('請先在專案根目錄 .env 設定 VITE_GEMINI_API_KEY，並重新執行 npm run dev');
      return;
    }
    const photo = croppedDataUrl || pendingPhoto;
    if (!photo || !faceOk) {
      setError('請先選一張有單一人臉的照片，或按「跳過」領現成角色');
      return;
    }
    setBusy(true);
    try {
      // 裁切／放大後再驗一次臉，避免框歪把臉裁掉
      if (croppedDataUrl) {
        setStatus('確認構圖中…');
        await validatePlayerPhotoUpload(croppedDataUrl);
        setPendingPhoto(croppedDataUrl);
        setPreviewUrl(croppedDataUrl);
      }
      const name = playerProfile.displayName || '我';
      setStatus('正在把你畫成 2D…');
      const raw = await generatePlayerPortraitFromPhoto(photo, { displayName: name });
      setStatus('調整構圖中…');
      const portraitUrl = await reframingPersonPortrait(raw);
      setStatus('製作頭像中…');
      const { cropDataUrl } = await cropDetectedFaceRegion(portraitUrl);
      const iconUrl = await generatePlayerFaceIconOnWhite(cropDataUrl, { displayName: name });

      const nextProfile = {
        ...playerProfile,
        displayName: name,
        rawPhotoUrl: photo,
        portraitUrl,
        iconUrl,
        avatarSource: 'photo',
        borrowedCastId: null,
        createdAt: playerProfile.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const nextPortraits = { ...portraitsRef.current, [PLAYER_ID]: iconUrl };
      setPlayerProfile(nextProfile);
      setPortraits(nextPortraits);
      let nextSetId = quizSetId;
      if (!nextSetId || !PSYCH_SET_BY_ID[nextSetId]) {
        nextSetId = pickPsychQuizSetId();
        setQuizSetId(nextSetId);
      }
      setFlowStep(2);
      setStatus('');
      clearUpload();
      await persist({
        playerProfile: { ...nextProfile, quizSetId: nextSetId },
        portraits: nextPortraits,
        flowStep: 2,
        quizSetId: nextSetId,
        quizAnswers: {},
      });
      setQuizAnswers({});
      showToast('角色完成，接著測個性');
      warmCastPortraits(nextPortraits);
    } catch (err) {
      setError(err.message || '轉繪失敗，再試一次');
      setStatus('');
    } finally {
      setBusy(false);
    }
  };

  /** 跳過自拍：隨機套用四角之一的肖像當「我」 */
  const handleSkipPortrait = async () => {
    setError('');
    setBusy(true);
    try {
      setStatus('隨機抽角色中…');
      let ports = portraitsRef.current;
      if (!portraitsComplete(ports)) {
        ports = await warmCastPortraits(ports);
      }
      const pool = CHARACTERS.filter((c) => Boolean(ports[c.id]));
      if (!pool.length) {
        throw new Error(
          '角色圖還沒備好。設好 VITE_GEMINI_API_KEY 再跳過，或改傳自拍'
        );
      }
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const url = ports[pick.id];
      const nextProfile = {
        ...playerProfile,
        displayName: pick.nameZh,
        rawPhotoUrl: null,
        portraitUrl: url,
        iconUrl: url,
        avatarSource: 'cast',
        borrowedCastId: pick.id,
        createdAt: playerProfile.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const nextPortraits = { ...ports, [PLAYER_ID]: url };
      setPlayerProfile(nextProfile);
      setPortraits(nextPortraits);
      let nextSetId = quizSetId;
      if (!nextSetId || !PSYCH_SET_BY_ID[nextSetId]) {
        nextSetId = pickPsychQuizSetId();
        setQuizSetId(nextSetId);
      }
      setFlowStep(2);
      setStatus('');
      clearUpload();
      await persist({
        playerProfile: { ...nextProfile, quizSetId: nextSetId },
        portraits: nextPortraits,
        flowStep: 2,
        quizSetId: nextSetId,
        quizAnswers: {},
      });
      setQuizAnswers({});
      showToast(`已隨機領一位 NPC · ${pick.nameZh}`);
    } catch (err) {
      setError(err.message || '跳過失敗，再試一次');
      setStatus('');
    } finally {
      setBusy(false);
    }
  };

  const rebuildTags = async (answers, profile, setId = quizSetId) => {
    setBusy(true);
    setStatus('整理個性標籤中…');
    try {
      const nextTags = await buildPersonalityTags({
        portraitUrl: profile.portraitUrl,
        displayName: profile.displayName,
        quizAnswers: answers,
        quizSetId: setId,
      });
      setTags(nextTags);
      const nextProfile = {
        ...profile,
        tags: nextTags,
        quizAnswers: answers,
        quizSetId: setId,
        updatedAt: new Date().toISOString(),
      };
      setPlayerProfile(nextProfile);
      await persist({
        playerProfile: nextProfile,
        quizAnswers: answers,
        quizSetId: setId,
      });
      return nextTags;
    } catch (err) {
      setError(err.message || '標籤產生失敗，再試一次');
      throw err;
    } finally {
      setBusy(false);
      setStatus('');
    }
  };

  const handleQuizAnswer = async (qId, optId) => {
    const next = { ...quizAnswers, [qId]: optId };
    setQuizAnswers(next);
    await persist({ quizAnswers: next });
    const done = ['q1', 'q2', 'q3', 'q4', 'q5'].every((k) => next[k]);
    if (done) {
      try {
        await rebuildTags(next, playerProfile);
      } catch {
        /* error already set */
      }
    }
  };

  const handleNameChange = (name) => {
    const next = {
      ...playerProfile,
      displayName: name,
      updatedAt: new Date().toISOString(),
    };
    setPlayerProfile(next);
    persist({ playerProfile: next });
  };

  const handleContinueToDraw = () => {
    setFlowStep(3);
    persist({ flowStep: 3 });
  };

  const handleDraw = async () => {
    setError('');
    setBusy(true);
    setDrawPhase('scan');
    setSealLabel('');
    setStatus('描繪場景中…');
    try {
      let ports = portraitsRef.current;
      if (!portraitsComplete(ports)) {
        setStatus('補齊角色圖中…');
        ports = await warmCastPortraits(ports);
      }
      if (!ports[PLAYER_ID] && !playerProfile.iconUrl && !playerProfile.portraitUrl) {
        throw new Error('請先完成 2D 角色');
      }
      const card = await drawFortuneCard({
        categoryId,
        tags: tags.length ? tags : playerProfile.tags || [],
        portraits: ports,
        playerProfile,
        colorStyle,
        onStatus: (msg) => {
          if (msg && /描繪|色彩|上色|撰寫|咒術|主題|吉依|Riso|連環|霓虹|水墨|朱砂|後製|套印|發光/.test(msg)) {
            setStatus(msg);
          } else if (msg && !/小吉|大吉/.test(msg)) {
            setStatus(msg);
          } else {
            setStatus('抽籤進行中…');
          }
        },
      });
      const nextDraft = { ...card, manualPos: { x: 0.62, y: 0.16 } };
      setSealLabel(card.fortuneLabel || '吉');
      setDrawPhase('seal');
      setStatus('');
      await new Promise((r) => setTimeout(r, 1100));
      setDraftCard(nextDraft);
      setFlowStep(4);
      setDrawPhase(null); // 在跳轉前手動清除
      await persist({ flowStep: 4, draftCard: nextDraft, categoryId });
    } catch (err) {
      setError(err.message || '抽籤失敗');
      setDrawPhase(null);
    } finally {
      setBusy(false);
      setStatus('');
    }
  };

  const tryClaimFriend = async (card) => {
    try {
      const link = await fetchShareLink(pendingShareCode);
      if (!link) {
        showToast('分享連結無效或已過期');
        return;
      }
      const bubbleText =
        card.chosenIndex === 3
          ? String(card.customText || '').slice(0, DIALOGUE_MAX_CHARS)
          : card.dialogues?.[card.chosenIndex] || '';
      const claimerPayload = {
        id: card.id,
        displayName: playerProfile.displayName || '我',
        categoryId: card.categoryId,
        fortuneId: card.fortuneId,
        fortuneLabel: card.fortuneLabel,
        fortuneEmoji: card.fortuneEmoji,
        imageUrl: card.imageUrl,
        dialogues: card.dialogues,
        chosenIndex: card.chosenIndex,
        customText: card.customText,
        manualPos: card.manualPos,
        bubbleText,
        createdAt: card.createdAt,
      };
      const res = await claimShareMutual({
        shareCode: pendingShareCode,
        ownerId: link.ownerId,
        claimerId: playerId,
        claimerCardPayload: claimerPayload,
      });
      if (!res.ok) {
        showToast(res.reason || '無法互兌');
        return;
      }
      const ownerCopy = res.ownerCard
        ? {
            ...res.ownerCard,
            id: createId('copy'),
            source: 'friend_copy',
            copiedAt: new Date().toISOString(),
          }
        : null;
      if (ownerCopy) {
        const nextFriends = [ownerCopy, ...friendCopies];
        setFriendCopies(nextFriends);
        await persist({ friendCopies: nextFriends, pendingShareCode: null });
        setPendingShareCode(null);
        showToast('已拿到好友的籤卡！對方也會拿到你的');
      }
    } catch (err) {
      showToast(err.message || '互兌失敗');
    }
  };

  const finalizeCard = async (card) => {
    const nextList = [card, ...fortuneCards.filter((c) => c.id !== card.id)];
    setFortuneCards(nextList);
    setDraftCard(card);
    setFlowStep(5);
    await persist({
      fortuneCards: nextList,
      flowStep: 5,
      draftCard: card,
    });
    if (pendingShareCode) {
      await tryClaimFriend(card);
    }
  };

  const handleConfirmDialogue = async () => {
    if (!draftCard) {
      setFlowStep(3);
      persist({ flowStep: 3, draftCard: null });
      return;
    }
    const text =
      draftCard.chosenIndex === 3
        ? String(draftCard.customText || '').slice(0, DIALOGUE_MAX_CHARS)
        : draftCard.dialogues?.[draftCard.chosenIndex] || '';
    if (!text) {
      setError('請選擇或輸入對白');
      return;
    }
    await finalizeCard({ ...draftCard, finalText: text });
  };

  const handleShared = async (code) => {
    const next = fortuneCards.map((c) =>
      c.id === draftCard?.id ? { ...c, shareCode: code } : c
    );
    setFortuneCards(next);
    await persist({ fortuneCards: next });
  };

  const handleAgain = () => {
    setDraftCard(null);
    setCategoryId(null);
    setFlowStep(3);
    persist({ flowStep: 3, draftCard: null, categoryId: null });
  };

  const handleColorStyleChange = useCallback(
    async (nextRaw) => {
      const next = normalizeColorStyle(nextRaw);
      if (next === colorStyle) return;
      setColorStyle(next);
      persist({ colorStyle: next });

      const ink = draftCard?.inkImageUrl;
      if (ink && (flowStep === 4 || flowStep === 5)) {
        setBusy(true);
        setStatus(colorStyleStatus(next));
        showToast(`切換：${colorStyleLabel(next)}…`);
        try {
          const imageUrl = await recolorFortuneInk(ink, next);
          const nextDraft = { ...draftCard, imageUrl, colorStyle: next };
          setDraftCard(nextDraft);
          const nextList = fortuneCards.map((c) =>
            c.id === nextDraft.id ? { ...c, imageUrl, colorStyle: next } : c
          );
          if (fortuneCards.some((c) => c.id === nextDraft.id)) {
            setFortuneCards(nextList);
            await persist({ draftCard: nextDraft, fortuneCards: nextList, colorStyle: next });
          } else {
            await persist({ draftCard: nextDraft, colorStyle: next });
          }
          showToast(`已套用 ${colorStyleLabel(next)}`);
        } catch (err) {
          setError(err.message || '風格切換失敗');
          showToast('風格切換失敗，下次抽籤仍會套用');
        } finally {
          setBusy(false);
          setStatus('');
        }
        return;
      }

      showToast(`已選 ${colorStyleLabel(next)} · 下次抽籤生效`);
    },
    [colorStyle, draftCard, flowStep, fortuneCards, persist, showToast]
  );

  /** 點「籤語」回首頁：有角色→抽籤；否則→上傳 */
  const handleHome = () => {
    if (busy) return;
    setError('');
    setSheet(null);
    clearUpload();
    const home = playerProfile?.portraitUrl ? 3 : 1;
    setFlowStep(home);
    persist({ flowStep: home });
    if (flowStep !== home) {
      showToast(home === 3 ? '回到首頁 · 今日抽籤' : '回到首頁');
    }
  };

  const canGoToStep = (n) => {
    if (busy || n < 1 || n > 5) return false;
    if (n === 1) return true;
    if (n === 2) return Boolean(playerProfile?.portraitUrl);
    if (n === 3) return Boolean(playerProfile?.portraitUrl) && (tags?.length || 0) >= 3;
    if (n === 4) return Boolean(draftCard);
    if (n === 5) {
      return (
        Boolean(draftCard) &&
        (flowStep === 5 || fortuneCards.some((c) => c.id === draftCard.id))
      );
    }
    return false;
  };

  const handleGoStep = (n) => {
    if (!canGoToStep(n) || n === flowStep) return;
    setError('');
    setSheet(null);
    setFlowStep(n);
    persist({ flowStep: n });
  };

  const patchDraft = (updater) => {
    setDraftCard((prev) => {
      if (!prev) return prev;
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      persist({ draftCard: next });
      return next;
    });
  };

  if (booting) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 px-6">
        <p className="font-display text-xl">{BRAND_MARK}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] justify-center md:py-6">
      <div className="relative flex h-[100dvh] w-full max-w-md flex-col overflow-hidden border-[var(--ink)] bg-[var(--paper)] md:h-[min(860px,100dvh)] md:border-2 md:shadow-lift">
        <header className="flex shrink-0 items-center justify-between gap-1 border-b-2 border-[var(--ink)] px-2 py-3 sm:gap-2 sm:px-4">
          <button
            type="button"
            className="min-w-0 cursor-pointer text-left transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={busy}
            onClick={handleHome}
            title="回首頁"
            aria-label="籤語，回首頁"
          >
            <p className="font-display text-lg font-bold leading-none tracking-tighter text-[var(--accent)] sm:text-2xl sm:tracking-tight">
              {BRAND_MARK}
            </p>
          </button>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <nav className="flex items-center gap-0.5" aria-label="流程步驟">
              {[1, 2, 3, 4, 5].map((n) => {
                const on = flowStep === n;
                const open = canGoToStep(n);
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={!open || busy}
                    onClick={() => handleGoStep(n)}
                    title={open ? `前往 Step ${n}` : `Step ${n} 尚未解鎖`}
                    className={`flex h-7 w-7 items-center justify-center border-2 border-[var(--ink)] text-[11px] font-black transition sm:h-8 sm:w-8 sm:text-[12px] ${
                      on
                        ? 'bg-[var(--accent)] text-white shadow-card'
                        : open
                          ? 'bg-white hover:-translate-y-0.5 hover:shadow-card'
                          : 'cursor-not-allowed bg-[var(--strip-bg)] text-[var(--ink)]/30'
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </nav>
            <div className="mx-0.5 h-6 w-[1px] bg-[var(--ink)]/20 sm:mx-1" />
            <ColorStyleSelect
              value={colorStyle}
              disabled={busy}
              onChange={handleColorStyleChange}
            />
          </div>
        </header>

        {pendingShareCode && flowStep < 5 ? (
          <div className="mx-5 mt-3 shrink-0 border-2 border-[var(--ink)] bg-[color-mix(in_srgb,var(--accent)_16%,white)] px-3 py-2 text-[12px] font-medium">
            好友邀請進行中 — 完成抽籤後可互拿卡片
          </div>
        ) : null}

        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {flowStep === 1 ? (
            <StepUpload
              busy={busy}
              status={status}
              error={error}
              checkStatus={checkStatus}
              previewUrl={previewUrl}
              faceOk={faceOk}
              onSelectFile={handleSelectFile}
              onConfirm={handleConfirmPortrait}
              onClear={clearUpload}
              onSkip={handleSkipPortrait}
            />
          ) : null}
          {flowStep === 2 ? (
            <StepPersonality
              profile={playerProfile}
              quizAnswers={quizAnswers}
              quizSetId={quizSetId}
              tags={tags}
              busy={busy}
              status={status}
              onAnswer={handleQuizAnswer}
              onNameChange={handleNameChange}
              onContinue={handleContinueToDraw}
            />
          ) : null}
          {flowStep === 3 ? (
            <StepDraw
              busy={busy}
              status={status}
              error={error}
              selectedCategory={categoryId}
              onSelect={setCategoryId}
              onDraw={handleDraw}
              drawPhase={drawPhase}
              sealLabel={sealLabel}
            />
          ) : null}
          {flowStep === 4 ? (
            draftCard ? (
              <StepDialogue
                card={draftCard}
                onChangeDialogue={(i) => patchDraft((c) => ({ ...c, chosenIndex: i }))}
                onCustom={(t) =>
                  patchDraft((c) => ({ ...c, customText: t.slice(0, DIALOGUE_MAX_CHARS) }))
                }
                onDragPos={(pos) => patchDraft((c) => ({ ...c, manualPos: pos }))}
                onConfirm={handleConfirmDialogue}
              />
            ) : (
              <section className="flex flex-1 flex-col items-center justify-center gap-3 px-5">
                <p className="text-sm">草稿遺失，請重新抽籤</p>
                <button type="button" className="btn-primary" onClick={handleAgain}>
                  回抽籤
                </button>
              </section>
            )
          ) : null}
          {flowStep === 5 ? (
            draftCard ? (
              <StepShare
                card={draftCard}
                profile={playerProfile}
                playerId={playerId}
                onShared={handleShared}
                onAgain={handleAgain}
                toast={showToast}
              />
            ) : (
              <section className="flex flex-1 flex-col items-center justify-center gap-3 px-5">
                <p className="text-sm">找不到這張籤，請重新抽</p>
                <button type="button" className="btn-primary" onClick={handleAgain}>
                  回抽籤
                </button>
              </section>
            )
          ) : null}

          {sheet === 'gallery' ? (
            <GallerySheet cards={allGallery} onClose={() => setSheet(null)} />
          ) : null}
          {sheet === 'profile' ? (
            <ProfileSheet
              profile={playerProfile}
              tags={tags}
              onClose={() => setSheet(null)}
              onNameChange={handleNameChange}
            />
          ) : null}
          {sheet === 'history' ? (
            <HistorySheet cards={fortuneCards} onClose={() => setSheet(null)} />
          ) : null}
        </main>

        <FloatingDock
          active={sheet}
          onOpen={(id) => setSheet(id)}
          onClose={() => setSheet(null)}
          avatarUrl={playerProfile?.iconUrl || portraits?.[PLAYER_ID] || ''}
        />

        {toast ? (
          <div className="pointer-events-none absolute left-1/2 top-16 z-50 max-w-[90%] -translate-x-1/2 border-2 border-[var(--ink)] bg-[var(--ink)] px-4 py-2 text-center text-sm text-[var(--paper)] shadow-[4px_4px_0_0_#c45c26]">
            {toast}
          </div>
        ) : null}
      </div>
    </div>
  );
}
