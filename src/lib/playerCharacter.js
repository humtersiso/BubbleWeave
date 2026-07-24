/**
 * 玩家第 5 角（id: me）— 與四角並存，可同框／進對白。
 * 不寫入 CHARACTER_BIBLE 靜態表，避免啟動倉庫 schema 強制覆蓋「我」。
 */

export const PLAYER_ID = 'me';

export const defaultPlayerProfile = () => ({
  displayName: '我',
  bio: '',
  rawPhotoUrl: null,
  portraitUrl: null,
  iconUrl: null,
  badgeStyleId: 'ink',
  createdAt: null,
  updatedAt: null,
});

/**
 * @param {ReturnType<typeof defaultPlayerProfile>} [profile]
 */
export const buildPlayerCharacter = (profile = {}) => {
  const nameZh = String(profile.displayName || '我').trim() || '我';
  const name = nameZh === '我' ? 'Me' : nameZh;
  return {
    id: PLAYER_ID,
    name,
    nameZh,
    ageRange: 'player',
    vibe: '玩家本人（平台 2D 化身）',
    comedyRole: 'boke',
    comedyRoleZh: '現場反應',
    voiceLogic:
      '以第一人稱日常吐槽或自嘲；口吻貼近真人短句，不搶四角招牌人設，常當場面催化劑。',
    sampleLines: ['這也算台灣日常？', '我怎麼又中招了。'],
    body: '依上傳照片轉繪後的體型',
    outfit: '依 canonical 肖像鎖定的服裝剪影',
    hairSignature: 'match the player canonical portrait hair exactly',
    outfitSignature: 'match the player canonical portrait outfit silhouette',
    glassesSignature: 'match the player canonical portrait eyewear (or bare face)',
    portraitFailCheck: 'wrong person, photorealistic photo, colored image, extra people',
    identityHardLock:
      `PLAYER "${nameZh}" LOCK (FATAL IF WRONG): This is the USER's avatar. ` +
      'FACE must match the attached player canonical portrait exactly (same person). ' +
      'Keep Ghibli black-and-white ink style. Never photorealistic. Never swap with Cindy/Bob/David/Elise.',
    appearance:
      `ALWAYS the EXACT SAME person "${nameZh}" as the player canonical portrait reference. ` +
      'Ghibli ink keyframe, black-and-white only. Do not invent a different face.',
    faceAppearance:
      `SAME person "${nameZh}" as player portrait: face, hair, glasses/no-glasses must match reference; looking at camera`,
    color: '#0d9488',
    isPlayer: true,
  };
};

export const hasPlayerPortrait = (profile, portraits = {}) =>
  Boolean(profile?.portraitUrl || profile?.iconUrl || portraits?.[PLAYER_ID]);

/**
 * 從全身／全景轉繪圖裁出上方頭部方塊（後備；主流程改用臉偵測＋白底 icon）
 * @deprecated 請用 playerPortraitProcess.cropDetectedFaceRegion + generatePlayerFaceIconOnWhite
 */
export const cropPlayerFaceIcon = (portraitDataUrl) =>
  new Promise((resolve, reject) => {
    if (!portraitDataUrl) {
      reject(new Error('無轉繪圖'));
      return;
    }
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) throw new Error('圖片尺寸無效');
        const side = Math.min(w, Math.round(h * 0.52));
        const sx = Math.max(0, Math.round((w - side) / 2));
        const sy = Math.max(0, Math.round(h * 0.04));
        const out = 512;
        const canvas = document.createElement('canvas');
        canvas.width = out;
        canvas.height = out;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, out, out);
        ctx.drawImage(img, sx, Math.min(sy, h - side), side, side, 0, 0, out, out);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('轉繪圖載入失敗'));
    img.src = portraitDataUrl;
  });

/**
 * @param {string} id
 * @param {object} [profile]
 * @param {Record<string, object>} [coreById] CHARACTERS_BY_ID
 */
export const resolveCharacter = (id, profile, coreById = {}) => {
  if (id === PLAYER_ID) return buildPlayerCharacter(profile);
  return coreById[id] || null;
};
