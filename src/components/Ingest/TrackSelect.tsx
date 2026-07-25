'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { FileFormatIcon, LanguageMark } from '@/components/ui/FileFormatIcon';

interface Option {
  id: string;
  name: string;
  count?: number;
  lang?: string;
  languagePair?: { primary: string; secondary: string };
}

interface TrackSelectProps {
  value: string;
  options: Option[];
  onChange: (id: string) => void;
  placeholder?: string;
  countLabel?: number | null;
}

const truncateMiddle = (text: string, maxLength: number = 80) => {
  if (!text || text.length <= maxLength) return text;
  const charsToShow = maxLength - 3;
  const frontChars = Math.ceil(charsToShow * 0.55);
  const backChars = Math.floor(charsToShow * 0.45);
  return text.substring(0, frontChars) + '…' + text.substring(text.length - backChars);
};

const FileNameText: React.FC<{ name: string; className?: string }> = ({ name, className = '' }) => {
  const shouldScroll = name.length > 42;
  return (
    <span className={`hover-marquee ${className}`} title={name}>
      <span className={shouldScroll ? 'hover-marquee-content' : 'truncate'}>
        {name}
      </span>
    </span>
  );
};

/** 与导入列表「轨单元」同规格：md 图标 + 语种标 + 文件名 */
export const TrackSelect: React.FC<TrackSelectProps> = ({
  value,
  options,
  onChange,
  placeholder = '-- 未绑定 --',
  countLabel
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listId = React.useId();

  const selectedOption = options.find(o => o.id === value) || null;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <div className="relative min-w-0 flex-1" ref={ref}>
      <button
        type="button"
        className={`v4-focus-ring flex w-full cursor-pointer items-center gap-2.5 rounded-md border px-2.5 py-2 text-left text-[14px] outline-none transition-colors
          ${open
            ? 'border-[var(--v4-accent)] bg-[var(--v4-accent-soft)] text-[var(--v4-text)]'
            : 'border-[var(--v4-line)] bg-[var(--v4-panel)] text-[var(--v4-text-muted)] hover:border-[var(--v4-line-strong)]'}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={listId}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
          {selectedOption ? (
            <>
              <FileFormatIcon name={selectedOption.name} size="md" />
              <LanguageMark lang={selectedOption.lang} languagePair={selectedOption.languagePair} />
              <FileNameText name={selectedOption.name} className="min-w-0 flex-1 text-[14px] font-medium text-[var(--v4-text)]" />
            </>
          ) : (
            <span className="pl-1 text-[var(--v4-text-muted)]">{placeholder}</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2 border-l border-[var(--v4-line)] pl-2.5">
          {countLabel != null && (
            <span className="ui-meta font-mono text-[11px] tabular-nums">
              {countLabel}行
            </span>
          )}
          <ChevronDown
            className={`h-5 w-5 shrink-0 transition-transform duration-200 ${
              open ? 'rotate-180 text-[var(--v4-accent-strong)]' : 'text-[var(--v4-text-muted)]'
            }`}
            strokeWidth={2}
            aria-hidden="true"
          />
          <span className="sr-only">{selectedOption ? '更换字幕' : '选择字幕'}</span>
        </span>
      </button>

      {open && (
        <div
          id={listId}
          className="dropdown-pop absolute left-0 right-0 top-full z-[200] mt-1.5 max-h-64 overflow-y-auto overflow-x-hidden rounded-md border border-[var(--v4-line-strong)] bg-[var(--v4-panel-raised)] shadow-[0_12px_36px_rgba(26,61,55,0.14)] scrollbar-thin"
        >
          <button
            type="button"
            className={`flex w-full cursor-pointer items-center gap-2.5 px-2.5 py-2 text-left text-[14px] transition-colors hover:bg-[var(--v4-accent-soft)]
              ${!value ? 'bg-[var(--v4-panel-muted)] font-semibold text-[var(--v4-text)]' : 'text-[var(--v4-text-muted)]'}`}
            onClick={() => { onChange(''); setOpen(false); }}
          >
            {!value ? <Check className="h-4 w-4 shrink-0 text-[var(--v4-accent-strong)]" /> : <span className="w-3.5 shrink-0" />}
            <span>未选择</span>
          </button>

          {options.map(opt => {
            const isSelected = value === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                className={`flex w-full cursor-pointer items-center gap-2.5 border-t border-[var(--v4-line)] px-2.5 py-2 text-left transition-colors hover:bg-[var(--v4-accent-soft)]
                  ${isSelected ? 'bg-[var(--v4-accent-soft)] font-semibold text-[var(--v4-text)]' : 'text-[var(--v4-text-muted)]'}`}
                onClick={() => { onChange(opt.id); setOpen(false); }}
                title={opt.name}
              >
                {isSelected
                  ? <Check className="h-4 w-4 shrink-0 text-[var(--v4-accent-strong)]" />
                  : <span className="w-3.5 shrink-0" />
                }
                <FileFormatIcon name={opt.name} size="md" />
                <LanguageMark lang={opt.lang} languagePair={opt.languagePair} />
                <FileNameText name={truncateMiddle(opt.name, 120)} className="min-w-0 flex-1 font-mono text-[14px] font-medium text-[var(--v4-text)]" />
                {opt.count != null && (
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--v4-text-faint)]">{opt.count}行</span>
                )}
              </button>
            );
          })}

          {options.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-[var(--v4-text-faint)]">
              暂无已上传的字幕文件
            </div>
          )}
        </div>
      )}
    </div>
  );
};
