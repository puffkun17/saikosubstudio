import React from 'react';

/** 顶栏品牌标：内联 SVG，避免 /favicon.svg 的 CDN / 浏览器死缓存。 */
export const BrandMark: React.FC<{ className?: string; title?: string }> = ({
  className = 'h-10 w-10',
  title = 'SaikoSubStudio',
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
    fill="none"
    role="img"
    aria-hidden={title ? undefined : true}
    className={className}
  >
    {title ? <title>{title}</title> : null}
    {/* 墨色底 — 纸面账本：墨底 + 纸色字幕轨 + 酒红强调 */}
    <rect width="512" height="512" rx="88" fill="#1c1a17" />
    {/* Primary subtitle track (简中优先) */}
    <rect x="96" y="148" width="320" height="50" rx="8" fill="#faf7f0" />
    {/* Secondary subtitle track (English) */}
    <rect x="96" y="212" width="248" height="38" rx="6" fill="#faf7f0" />
    {/* Accent / studio foundation bar */}
    <rect x="152" y="278" width="208" height="20" rx="10" fill="#d06276" />
  </svg>
);
