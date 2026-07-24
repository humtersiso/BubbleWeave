/**
 * ═══════════════════════════════════════════════════════════
 * BubbleWeave 人物誌規格（Character Bible）
 * ═══════════════════════════════════════════════════════════
 *
 * 一致性 Prompt 公式 =
 *   [身高比例] + [臉型與骨相] + [髮型細節] + [身材結構] + [剪影服裝]
 *
 * 每位角色必須有：
 * appearance / faceAppearance / hairSignature / outfitSignature / identityHardLock
 * glassesSignature（有戴眼鏡者）/ portraitFailCheck（肖像失敗條件）
 */

export const CHARACTER_BIBLE = [
  {
    id: 'cindy',
    name: 'Cindy',
    nameZh: 'Cindy',
    ageRange: '25',
    vibe: '日本 OL 上班族',
    comedyRole: 'tsukkomi',
    comedyRoleZh: '核心吐槽',
    voiceLogic:
      '理性強迫症／高冷。用開會與職場黑話吐槽一切；永遠冷靜，用最專業、最具邏輯的語氣拆穿別人的荒謬。',
    sampleLines: ['這不是生化武器，這只是臭豆腐。', '你的離職申請被這雙腿駁回了。'],
    body: '約 50 公斤，纖細優雅',
    outfit: 'OL 黑色套裝（西裝外套／窄裙或西裝褲）',
    hairSignature:
      'flowing pin-straight jet-black hair PAST SHOULDERS to mid-back (never bob, never curly, never chin-length, never messy)',
    outfitSignature:
      'formal BLACK OL suit silhouette: black blazer + collared blouse + black pencil skirt OR black slacks + heels (never sportswear, never tee, never hoodie)',
    glassesSignature:
      'BARE FACE — ZERO eyewear: no glasses, no spectacles, no frames, no sunglasses (Cindy never wears glasses)',
    portraitFailCheck:
      'ANY glasses/spectacles on face, hair shorter than shoulders, curly hair, casual clothes, looking like Elise',
    identityHardLock:
      'CINDY LOCK (FATAL IF WRONG): Japanese woman, light East Asian skin, slim. ' +
      'GLASSES = NONE — bare eyes only. If Cindy has glasses the image is WRONG (do not confuse with Elise/David). ' +
      'HAIR = long pin-straight jet-black past shoulders. OUTFIT = black OL blazer suit. ' +
      'Never sportswear. Never messy short hair. Never round/square glasses. Never chubby body.',
    appearance:
      'ALWAYS the EXACT SAME person Cindy: Japanese woman age 25, light East Asian skin tone. ' +
      '[HEIGHT & SCALE]: Height 164cm, slender graceful posture. ' +
      '[FACE]: Delicate V-line oval face shape (瓜子臉), smooth refined jawline, subtle elegant East Asian facial features. ' +
      'CRITICAL: NO glasses, NO spectacles, NO eyewear of any kind — bare face only. ' +
      '[HAIR]: Flowing, pin-straight jet-black hair falling past her shoulders. ' +
      '[BODY]: Slim elegant build (~50kg), light slender frame. ' +
      '[OUTFIT]: ALWAYS wearing a formal BLACK OL SUIT (tailored black suit blazer, crisp collared blouse, black pencil skirt or slacks, formal heels). ' +
      'Keep this exact delicate oval face WITHOUT glasses, flowing straight black hair, and black OL suit in every panel. ' +
      'DO NOT change outfit. DO NOT change hairstyle. DO NOT add glasses.',
    faceAppearance:
      'SAME person Cindy: Japanese woman age 25, light East Asian skin, delicate V-line oval face, ' +
      'BARE EYES with NO glasses and NO spectacles (never draw frames on her face), ' +
      'flowing pin-straight jet-black hair past shoulders fully visible (long, not bob), calm polite professional expression looking at camera',
    color: '#db2777',
  },
  {
    id: 'bob',
    name: 'Bob',
    nameZh: 'Bob',
    ageRange: '40',
    vibe: '混混氣質、大隻佬',
    comedyRole: 'boke',
    comedyRoleZh: '反差裝傻',
    voiceLogic:
      '外表 120kg 硬漢，內心極度少女／怕痛／脆弱。強烈外貌反差：巨漢卻因極小災難（腳抽筋、被燙到）內心崩潰。',
    sampleLines: ['這不是啤酒肚，這是防撞氣墊！', '救命...這章魚燒比我還硬！'],
    body: '約 120 公斤，強壯且有巨大啤酒肚',
    bodySignature:
      'very large ~120kg build with a HUGE round bulging beer belly sticking out under the shirt (must read clearly in silhouette; never flat stomach, never athletic abs)',
    outfit: '骷髏頭黑色 T 恤、牛仔褲',
    hairSignature: 'completely BALD scalp (zero hair) + full thick dark beard and mustache',
    outfitSignature:
      'BLACK short-sleeve T-shirt with LARGE WHITE SKULL chest print + blue jeans + dark boots (never blank tee, never suit, never plaid)',
    glassesSignature: 'NO glasses — bare face',
    portraitFailCheck:
      'pale/white/Caucasian/light-gray face, face same tone as white background, hair on scalp, no beard, glasses, looking like David',
    identityHardLock:
      'BOB RACE/SKIN LOCK (FATAL IF WRONG): Bob is a Black / African-American man. ' +
      'Face, neck, ears, scalp skin MUST be dark brown / deep Black. ' +
      'In black-and-white ink portrait: fill the WHOLE face with MEDIUM-DARK TO DARK GRAY tone (clearly darker than the white #FFFFFF background). ' +
      'If the face looks white, pale, Caucasian, or paper-blank, the image is FAILED. ' +
      'HAIR = bald + full dark beard/mustache. No glasses. ' +
      'BODY (scene cards): huge round BEER BELLY under T-shirt — flat stomach = WRONG.',
    appearance:
      'ALWAYS the EXACT SAME person Bob: middle-aged Black man age 40 (NOT white, NOT Caucasian, NOT Asian). ' +
      'Skin tone: dark brown / deep Black — MUST stay dark (dark gray ink fill in B&W, face darker than paper). ' +
      '[HEIGHT & SCALE]: Tall intimidating stature 182cm. ' +
      '[FACE & HEAD]: Completely BALD head (clean shaved, zero hair), broad forehead, wide nose, full dark beard and mustache, clearly Black facial features, NO glasses. ' +
      '[BODY]: Very large heavy build (~120kg) with a PROMINENT, ROUND, BULGING BEER BELLY sticking far out under his shirt — the belly is a signature silhouette (never flat, never slim, never athletic). Dark skin on arms and neck. ' +
      '[OUTFIT]: ALWAYS BLACK short-sleeve T-shirt with LARGE WHITE SKULL graphic on chest (shirt stretched over the beer belly), blue denim jeans, dark boots. ' +
      'Keep Black identity, dark skin shading, bald head, full beard, skull tee, HUGE beer belly every panel. ' +
      'DO NOT lighten skin. DO NOT draw white bald man. DO NOT change outfit. DO NOT add scalp hair. DO NOT remove the beer belly.',
    faceAppearance:
      'SAME person Bob: middle-aged Black / African-American man age 40. ' +
      'SKIN: dark brown / deep Black — in B&W fill the entire face with medium-dark/dark gray ink so it is OBVIOUSLY darker than the white background (NEVER pale, NEVER Caucasian, NEVER blank white face). ' +
      'completely BALD head, prominent full dark beard and mustache, broad forehead, wide nose, NO glasses, ' +
      'clearly Black facial features, tough intimidating expression looking at camera',
    color: '#292524',
  },
  {
    id: 'david',
    name: 'David',
    nameZh: 'David',
    ageRange: '55-60',
    vibe: '老派退休中老年人',
    comedyRole: 'boke',
    comedyRoleZh: '時代落差裝傻',
    voiceLogic:
      '極度認真地做荒謬事。古板長輩長篇大論：用最嚴肅沉穩的語氣嘗試年輕人事物，並給出完全錯誤的解釋。',
    sampleLines: ['現在年輕人的捷運...開得真快啊。', '宇宙剛剛用這張刮刮樂提醒我該回家了。'],
    body: '約 65 公斤，體型適中略顯老態',
    outfit: '格子襯衫、西裝褲、黑粗框眼鏡',
    hairSignature:
      'neatly side-combed short pure WHITE / silver hair (never dark hair, never bald, never long, never shaved)',
    outfitSignature:
      'long-sleeve PLAID/checkered shirt with clear grid pattern + high-waisted dress slacks + leather belt + dress shoes (never skull tee, never sportswear)',
    glassesSignature:
      'thick BLACK SQUARE-rimmed glasses ALWAYS on face (never round frames, never no glasses)',
    portraitFailCheck: 'dark hair, bald, missing glasses, round glasses, beard, looking like Bob',
    identityHardLock:
      'DAVID LOCK (FATAL IF WRONG): light-skinned older man 55-60. ' +
      'HAIR = short side-combed WHITE hair. GLASSES = thick BLACK SQUARE frames always on. FACE = clean-shaven (no beard). ' +
      'OUTFIT = plaid long-sleeve shirt + dress slacks. Never sportswear. Never bald. Never round glasses.',
    appearance:
      'ALWAYS the EXACT SAME person David: retired older man age 55 to 60, light skin tone. ' +
      '[HEIGHT & SCALE]: Height 167cm, mature slightly aged posture. ' +
      '[FACE]: Distinct SQUARE jawline, broad angular face, clean-shaven (NO beard, NO mustache), forehead wrinkles, ' +
      'ALWAYS wearing thick black SQUARE-rimmed glasses. ' +
      '[HAIR]: Neatly side-combed short pure WHITE hair. ' +
      '[BODY]: Average moderate build (~65kg), healthy aged body. ' +
      '[OUTFIT]: ALWAYS old-fashioned long-sleeve PLAID SHIRT (distinct grid), tucked into high-waisted formal dress slacks, leather belt, dress shoes. ' +
      'Keep square clean-shaven face, white hair, black square glasses, plaid shirt every panel. ' +
      'DO NOT change outfit. DO NOT remove glasses. DO NOT change hair color. DO NOT grow beard.',
    faceAppearance:
      'SAME person David: older man age 55 to 60, light skin, sharp square jawline, completely clean-shaven (no beard), ' +
      'neatly side-combed short WHITE hair fully visible, thick black SQUARE-rimmed glasses clearly on face, ' +
      'calm serious traditional expression looking at camera',
    color: '#52525b',
  },
  {
    id: 'elise',
    name: 'Elise',
    nameZh: 'Elise',
    ageRange: '30-35',
    vibe: '宅女、不修邊幅',
    comedyRole: 'boke',
    comedyRoleZh: '極致裝傻',
    voiceLogic:
      '理直氣壯地軟爛。把所有失敗怪給宇宙或天氣；永遠選能量最低、最擺爛的解法，把災難講得理所當然。',
    sampleLines: ['別叫我。白 T 還沒洗。', '眼鏡霧了？那就不看世界了。'],
    body: '約 65～70 公斤，微微胖／略豐潤',
    bodySignature:
      'slightly plump soft build (~65-70kg) — lightly chubby only, NOT obese, NOT heavy 90kg+, NOT slim model',
    outfit: '寬大至膝蓋的白 T 恤、夾腳拖鞋、圓框眼鏡',
    hairSignature:
      'messy untidy unkempt black hair, chin-to-shoulder length only (never sleek, never past mid-back, never neat long OL hair)',
    outfitSignature:
      'OVERSIZED baggy WHITE T-shirt hanging to the KNEES + shorts underneath + rubber flip-flops (never OL suit, never fitted clothes, never sportswear)',
    glassesSignature:
      'thick ROUND-framed glasses ALWAYS on face (never square frames, never no glasses)',
    portraitFailCheck:
      'Black / dark / African skin, dark-gray filled face, obese / very heavy body, sleek long hair, square glasses, model-slim face, OL suit, looking like Cindy or Bob',
    identityHardLock:
      'ELISE LOCK (FATAL IF WRONG): East Asian / light-skinned homebody woman — NEVER Black, NEVER dark skin, NEVER dark-gray face fill (that is Bob only). ' +
      'SKIN = pale-to-light East Asian skin on face/arms (same lightness family as Cindy, not Bob). ' +
      'BODY = slightly plump / lightly chubby only (~65-70kg) — soft soft belly hint under oversized tee, NOT obese, NOT heavy, NOT 90kg+, NOT Bob-level bulk. ' +
      'HAIR = messy chin-to-shoulder black hair. GLASSES = thick ROUND frames always on. ' +
      'OUTFIT = knee-length oversized white tee + flip-flops. Soft lightly round cheeks (subtle, not heavy double chin). ' +
      'Never neat long hair. Never square glasses. Never OL suit. Never model-slim. Never obese. Never Bob-dark skin.',
    appearance:
      'ALWAYS the EXACT SAME person Elise: East Asian homebody woman age 30 to 35, PALE-TO-LIGHT East Asian skin tone (NOT Black, NOT dark skin, NOT African). ' +
      '[HEIGHT & SCALE]: Height 162cm. ' +
      '[FACE]: Soft lightly round face, gently full cheeks (微微圓潤), subtle soft chin — NOT a heavy double chin, ALWAYS thick ROUND-framed glasses. Light skin only. ' +
      '[HAIR]: Messy untidy unkempt black hair (chin-to-shoulder length, unstyled). ' +
      '[BODY]: Slightly plump soft build (~65-70kg) — lightly chubby / 微微胖 only; soft midsection under baggy tee; NOT obese, NOT heavy 90kg+, NOT athletic slim. ' +
      '[OUTFIT]: ALWAYS OVERSIZED BAGGY WHITE T-SHIRT hanging to the knees, casual shorts underneath, rubber flip-flops. ' +
      'Keep light East Asian skin, lightly soft round face, thick round glasses, messy black hair, knee-length white tee, flip-flops every panel. ' +
      'DO NOT change outfit. DO NOT change hairstyle. DO NOT remove glasses. DO NOT make her model-slim OR obese/heavy. ' +
      'DO NOT give Elise dark/Black skin or Bob-style gray-filled face.',
    faceAppearance:
      'SAME person Elise: East Asian woman age 30 to 35, pale-to-light East Asian skin (NOT Black, NOT dark), soft lightly round cheeks (微微胖 face — NOT heavy/obese), ' +
      'messy unkempt black hair chin-to-shoulder fully visible, thick ROUND-framed glasses clearly on face, ' +
      'lazy tired-but-kind expression looking at camera',
    color: '#7c3aed',
  },
];

export const PARTY_SIZE_OPTIONS = [
  { id: 1, label: '1人', labelEn: 'solo' },
  { id: 2, label: '2人', labelEn: 'duo' },
  { id: 3, label: '3人', labelEn: 'trio' },
  { id: 4, label: '4人', labelEn: 'quad' },
];

export const PARTY_SIZE_DISTRIBUTION = [
  { size: 1, weight: 55 },
  { size: 2, weight: 30 },
  { size: 3, weight: 10 },
  { size: 4, weight: 5 },
];
