import React from 'react';

/**
 * 籤卡舞台：維持 3:4 直式比例，確保 Step 4/5 視覺一致
 */
export default function FortuneCardStage({
  imageUrl,
  children,
  className = '',
  stageRef,
}) {
  return (
    <div
      className={`relative mx-auto aspect-[3/4] w-full max-w-[calc(100vh*0.5)] shrink-0 ${className}`}
    >
      <div
        ref={stageRef}
        className="absolute inset-0 overflow-visible border-2 border-[var(--ink)] bg-[var(--paper)] shadow-card"
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 bg-[var(--strip-bg)]" />
        )}
        {children}
      </div>
    </div>
  );
}
