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
    <div className="relative flex-1 min-w-0" ref={ref}>
      <button
        type="button"
        className={`v4-focus-ring w-full flex items-center gap-2 rounded-xl border py-3 px-3.5 text-base outline-none transition-all duration-200 cursor-pointer text-left bg-[var(--v4-panel-muted)] shadow-[inset_0_1px_2px_rgba(26,61,55,0.06)]
          ${open ? 'border-[var(--v4-accent)] text-[var(--v4-text)]' : 'border-[var(--v4-line)] hover:border-[var(--v4-line-strong)] text-[var(--v4-text-muted)]'}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={listId}
      >
        <span className="flex-1 min-w-0 overflow-hidden">
          {selectedOption ? (
            <span className="flex min-w-0 items-center gap-2">
              <FileFormatIcon name={selectedOption.name} size="sm" />
              <LanguageMark lang={selectedOption.lang} languagePair={selectedOption.languagePair} />
              <FileNameText name={selectedOption.name} className="flex-1 font-medium text-[var(--v4-text)]" />
            </span>
          ) : (
            <span className="text-[var(--v4-text-faint)]">{placeholder}</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2 border-l border-[var(--v4-line)] pl-2.5">
          {countLabel != null && (
            <span className="text-[var(--v4-text-muted)] text-xs font-mono font-semibold bg-[var(--v4-panel)] px-2 py-1 rounded-md border border-[var(--v4-line)]">{countLabel}行</span>
          )}
          <span className={`text-xs font-medium transition-colors ${open ? 'text-[var(--v4-text)]' : 'text-[var(--v4-text-faint)]'}`}>
            {selectedOption ? '更换' : '选择'}
          </span>
          <ChevronDown className={`h-4 w-4 text-[var(--v4-text-faint)] transition-transform duration-200 ${open ? 'rotate-180 text-[var(--v4-accent-strong)]' : ''}`} />
        </span>
      </button>

      {open && (
        <div id={listId} className="absolute top-full left-0 right-0 mt-1.5 z-[200] bg-[var(--v4-panel-raised)] border border-[var(--v4-line-strong)] rounded-xl overflow-hidden shadow-[0_12px_36px_rgba(26,61,55,0.14)] max-h-64 overflow-y-auto scrollbar-thin">
          <button
            className={`w-full flex items-center gap-2 px-3.5 py-3 text-base hover:bg-[var(--v4-accent-soft)] transition text-left cursor-pointer
              ${!value ? 'text-[var(--v4-text)] bg-[var(--v4-panel-muted)] font-semibold' : 'text-[var(--v4-text-muted)]'}`}
            onClick={() => { onChange(''); setOpen(false); }}
          >
            {!value && <Check className="w-3 h-3 text-[var(--v4-accent-strong)] flex-shrink-0" />}
            <span className={`text-base ${!value ? 'pl-0' : 'pl-[18px]'} text-[var(--v4-text-muted)]`}>未选择</span>
          </button>

          {options.map(opt => {
            const isSelected = value === opt.id;
            return (
              <button
                key={opt.id}
                className={`w-full flex items-center gap-2 px-3.5 py-3 text-base hover:bg-[var(--v4-accent-soft)] transition text-left border-t border-[var(--v4-line)] cursor-pointer
                  ${isSelected ? 'bg-[var(--v4-accent-soft)] text-[var(--v4-text)] font-semibold' : 'text-[var(--v4-text-muted)]'}`}
                onClick={() => { onChange(opt.id); setOpen(false); }}
                title={opt.name}
              >
                {isSelected
                  ? <Check className="h-3 w-3 shrink-0 text-[var(--v4-accent-strong)]" />
                  : <span className="w-3 shrink-0" />
                }
                <FileFormatIcon name={opt.name} size="sm" />
                <LanguageMark lang={opt.lang} languagePair={opt.languagePair} />
                <FileNameText name={truncateMiddle(opt.name, 120)} className="flex-1 font-mono text-base text-[var(--v4-text)]" />
                {opt.count != null && (
                  <span className="text-[var(--v4-text-faint)] text-xs flex-shrink-0 font-mono tabular-nums">{opt.count}行</span>
                )}
              </button>
            );
          })}

          {options.length === 0 && (
            <div className="px-3 py-4 text-xs text-[var(--v4-text-faint)] text-center">
              暂无已上传的字幕文件
            </div>
          )}
        </div>
      )}
    </div>
  );
};
