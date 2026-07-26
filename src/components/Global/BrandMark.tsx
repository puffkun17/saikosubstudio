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
    {/* Warm forest container — 家庭观影 / 阅片环境 */}
    <rect width="512" height="512" rx="88" fill="#1a3d37" />
    {/* Primary subtitle track (简中优先) */}
    <rect x="96" y="148" width="320" height="50" rx="8" fill="#f5f1ea" />
    {/* Secondary subtitle track (English) */}
    <rect x="96" y="212" width="248" height="38" rx="6" fill="#f5f1ea" />
    {/* Accent / studio foundation bar */}
    <rect x="152" y="278" width="208" height="20" rx="10" fill="#ef8d5f" />
  </svg>
);
