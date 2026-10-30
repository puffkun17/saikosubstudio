'use client';

import React from 'react';
import { distinguishingTailLength } from '@/core/sharedNamePrefix';

/**
 * 中间截断：前段可被省略号吃掉，尾段（区分段 + 扩展名）永远完整显示。
 * 纯 CSS（flex + truncate），不测量 DOM；整串放在 title 里。
 */
export const MiddleTruncate: React.FC<{
  text: string;
  /** 永远保留的尾部字符数；默认 = 扩展名前一段 + 扩展名，至少 10 个字符。 */
  keepTail?: number;
  title?: string;
  className?: string;
}> = ({ text, keepTail, title, className = '' }) => {
  const keep = Math.min(text.length, keepTail ?? distinguishingTailLength(text));
  const head = text.slice(0, text.length - keep);
  const tail = text.slice(text.length - keep);
  return (
    <span className={`flex min-w-0 max-w-full ${className}`} title={title ?? text} data-middle-truncate>
      {head && <span className="min-w-0 truncate">{head}</span>}
      <span className="shrink-0 whitespace-pre">{tail}</span>
    </span>
  );
};
