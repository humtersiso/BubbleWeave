/**
 * App 發行版號（與 CARD_SCHEMA／PORTRAIT 資料版分離）
 * - stable：對應 git tag v1.0-stable、IndexedDB bubbleweave
 * - v2-dev：對應分支 feat/v2-rewrite、IndexedDB bubbleweave.v2
 */
export const APP_RELEASE = '2.0.0-dev';
export const APP_CHANNEL = 'v2-dev';
export const APP_RELEASE_LABEL = `籤語 ${APP_RELEASE} (${APP_CHANNEL})`;
