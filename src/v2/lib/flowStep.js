/**
 * v2 步驟復原（重整後避免停在空白 Step4／5）
 * @param {{ flowStep?: number, fortuneCards?: object[] }} cached
 * @param {{ portraitUrl?: string, tags?: string[] } | null} profile
 * @param {object | null} draft
 */
export const resolveFlowStep = (cached = {}, profile = null, draft = null) => {
  let step = Number(cached.flowStep) || 1;
  const hasPortrait = Boolean(profile?.portraitUrl);
  const hasTags = (profile?.tags || []).length >= 3;

  if ((step === 4 || step === 5) && !draft) {
    if (Array.isArray(cached.fortuneCards) && cached.fortuneCards[0]) {
      return { step: 5, draft: cached.fortuneCards[0] };
    }
    step = hasTags ? 3 : hasPortrait ? 2 : 1;
  }

  if (!hasPortrait) return { step: 1, draft: draft || null };
  if (step < 2) step = 2;
  if (hasTags && step < 3 && step !== 4 && step !== 5) step = 3;
  return { step, draft: draft || null };
};
