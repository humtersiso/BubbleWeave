/**
 * 故事串角色規則（寬鬆版）
 *
 * - 第一張任意
 * - 中間可自由換角（不必與相鄰格共同角色）
 * - 前面出現過的角色之後可再登場（不必連貫相鄰）
 *
 * 倉庫可用「焦點格」做軟性視覺提示（變暗／微光），不阻擋選取。
 */

/** @param {{ characterIds?: string[] } | null | undefined} card */
export const getCastKey = (card) => {
  const ids = (card?.characterIds || []).filter(Boolean).slice().sort();
  return ids.length ? ids.join('+') : null;
};

/** @param {{ characterIds?: string[] } | null | undefined} card */
export const getCastLabelZh = (card) => {
  if (card?.castMembers?.length) {
    return card.castMembers.map((m) => m.nameZh).join('＋');
  }
  return card?.packNameZh || card?.recipe?.character || '未知角色';
};

/** @param {object} a @param {object} b */
export const cardsShareCharacter = (a, b) => {
  const idsB = new Set((b?.characterIds || []).filter(Boolean));
  if (!idsB.size) return false;
  return (a?.characterIds || []).some((id) => idsB.has(id));
};

/** 卡牌是否含有焦點角色之一（倉庫軟性高亮用） */
export const cardMatchesFocusCast = (card, focusCard) => {
  if (!focusCard?.characterIds?.length) return true;
  return cardsShareCharacter(card, focusCard);
};

/** 劇場中已登場的角色 id 集合 */
export const getAppearedCharacterIds = (theaterCards) => {
  const set = new Set();
  (theaterCards || []).forEach((c) => {
    (c.characterIds || []).forEach((id) => {
      if (id) set.add(id);
    });
  });
  return set;
};

/**
 * 整條故事串是否可發布（僅要求每格有角色資訊）。
 * @param {object[]} theaterCards
 */
export const theaterChainIsContinuous = (theaterCards) => {
  if (!theaterCards?.length) return true;
  return theaterCards.every((c) => c?.characterIds?.length > 0);
};

/**
 * 新卡能否加入劇場（空劇場／有角色即可；不強制相鄰共同角色）。
 * @param {object} card
 * @param {object[]} theaterCards
 */
export const cardCanAppendToTheater = (card, _theaterCards = []) =>
  Boolean(card?.characterIds?.length);

/**
 * 預覽重新排序後是否仍可接受。
 * @param {object[]} cards
 * @param {number} fromIndex
 * @param {number} toIndex
 */
export const reorderWouldStayContinuous = (cards, fromIndex, toIndex) => {
  if (fromIndex === toIndex) return true;
  const next = [...cards];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return theaterChainIsContinuous(next);
};

/** @deprecated 相鄰約束已放寬；保留相容舊呼叫 */
export const cardsAreAdjacentCompatible = (a, b) =>
  Boolean(a?.characterIds?.length && b?.characterIds?.length && cardsShareCharacter(a, b));
