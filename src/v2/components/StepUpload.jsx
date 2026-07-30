import React, { useRef, useState } from 'react';
import { StepHeading } from './HelpTip.jsx';
import PhotoPanZoom from './PhotoPanZoom.jsx';

const UPLOAD_HINT = '上傳有你臉的照片，我們會轉成今日 2D 角色；不想拍也能跳過領一位現成角色。';

export default function StepUpload({
  busy,
  status,
  error,
  checkStatus,
  previewUrl,
  faceOk,
  onSelectFile,
  onConfirm,
  onClear,
  onSkip,
}) {
  const inputRef = useRef(null);
  const cropRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [exporting, setExporting] = useState(false);

  const takeFile = (file) => {
    if (!file || busy) return;
    onSelectFile?.(file);
  };

  const handleConfirm = async () => {
    if (busy || !faceOk || exporting) return;
    setExporting(true);
    try {
      let cropped = null;
      try {
        cropped = await cropRef.current?.exportFrame?.();
      } catch {
        cropped = null;
      }
      await onConfirm?.(cropped || undefined);
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col px-5 pb-3 pt-2">
      <div className="shrink-0">
        <StepHeading step="STEP 1" title="上傳自拍" hint={UPLOAD_HINT} helpTitle="上傳說明">
          <p>請上傳<strong>只有你一個人臉</strong>的照片；合照會分不清主角是誰。</p>
          <p>全身照比較好畫，半身也可以。選好後可用手指拖拉、放大，框出你想保留的範圍。</p>
          <p>風景、背影、沒有臉的圖無法轉繪。</p>
          <p>
            按「跳過」會隨機領一位現成角色（Cindy／Bob／David／Elise）。
          </p>
          <p>iPhone 的 HEIC 請先轉成 JPG 或 PNG。</p>
        </StepHeading>
      </div>

      {previewUrl ? (
        <div className="panel relative mt-3 flex min-h-0 w-full flex-1 basis-0 flex-col overflow-hidden">
          <PhotoPanZoom ref={cropRef} src={previewUrl} />
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            takeFile(e.dataTransfer?.files?.[0]);
          }}
          className={`panel relative mt-3 flex min-h-0 w-full flex-1 basis-0 items-center justify-center overflow-hidden transition ${
            dragOver ? 'bg-[color-mix(in_srgb,var(--accent)_14%,white)]' : 'bg-white'
          }`}
        >
          <div className="flex flex-col items-center justify-center gap-1.5 px-3">
            <span className="font-display text-xl font-bold">點我選照片</span>
            <span className="text-[11px] tracking-wide text-[var(--ink)]/50">
              JPG · PNG · WebP · 建議全身
            </span>
          </div>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        className="hidden"
        onChange={(e) => {
          takeFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      <div className="mt-3 shrink-0 space-y-2">
        {checkStatus ? (
          <p className="text-sm font-medium text-[var(--accent)]">{checkStatus}</p>
        ) : null}
        {status ? <p className="text-sm font-medium text-[var(--accent)]">{status}</p> : null}
        {error ? (
          <p className="border-2 border-[var(--ink)] bg-[color-mix(in_srgb,#dc2626_10%,white)] px-3 py-2 text-sm leading-relaxed">
            {error}
          </p>
        ) : null}
        {faceOk ? (
          <p className="text-sm font-semibold text-[var(--ink)]">
            臉偵測 OK，可調整構圖後開始轉繪
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          {previewUrl ? (
            <button
              type="button"
              className="btn-secondary min-h-[48px] w-full"
              disabled={busy || exporting}
              onClick={onClear}
            >
              換一張
            </button>
          ) : (
            <button
              type="button"
              className="btn-secondary min-h-[48px] w-full"
              disabled={busy}
              onClick={onSkip}
            >
              跳過
            </button>
          )}
          <button
            type="button"
            className="btn-primary min-h-[48px] w-full"
            disabled={busy || exporting || !faceOk}
            onClick={handleConfirm}
          >
            {busy || exporting ? '轉繪中…' : '開始轉繪'}
          </button>
        </div>
      </div>
    </section>
  );
}
