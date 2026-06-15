'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
  id: string;
  name: string;
  count?: number;
  lang?: string;
}

interface TrackSelectProps {
  value: string;
  options: Option[];
  onChange: (id: string) => void;
  placeholder?: string;
  countLabel?: number | null;
}

const getLangBadgeMini = (lang?: string) => {
  if (!lang) return null;
  const map: Record<string, { label: string; color: string }> = {
    'zh-CN': { label: '简', color: 'text-blue-400 bg-blue-500/10 border border-blue-500/40 shadow-[0_0_8px_rgba(59,130,246,0.5)] [text-shadow:0_0_4px_rgba(59,130,246,0.8)]' },
    'zh-TW': { label: '繁', color: 'text-purple-400 bg-purple-500/10 border border-purple-500/40 shadow-[0_0_8px_rgba(168,85,247,0.5)] [text-shadow:0_0_4px_rgba(168,85,247,0.8)]' },
    'zh': { label: '中', color: 'text-blue-400 bg-blue-500/10 border border-blue-500/40 shadow-[0_0_8px_rgba(59,130,246,0.5)] [text-shadow:0_0_4px_rgba(59,130,246,0.8)]' },
    'en': { label: '英', color: 'text-green-400 bg-green-500/10 border border-green-500/40 shadow-[0_0_8px_rgba(34,197,94,0.5)] [text-shadow:0_0_4px_rgba(34,197,94,0.8)]' },
    'bilingual': { label: '双', color: 'text-amber-400 bg-amber-500/10 border border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.5)] [text-shadow:0_0_4px_rgba(245,158,11,0.8)]' },
    'commentary': { label: '导', color: 'text-rose-400 bg-rose-500/10 border border-rose-500/40 shadow-[0_0_8px_rgba(244,63,94,0.5)] [text-shadow:0_0_4px_rgba(244,63,94,0.8)]' },
  };
  const entry = map[lang];
  if (!entry) return null;
  return (
    <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${entry.color}`}>
      {entry.label}
    </span>
  );
};

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
    <span className={`min-w-0 overflow-hidden whitespace-nowrap ${className}`} title={name}>
      <span className={shouldScroll ? 'inline-block subtitle-marquee' : 'truncate'}>
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

  const selectedOption = options.find(o => o.id === value) || null;

  // Close on outside click
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

  // Close on Escape
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
      {/* Recessed Port Socket Trigger button */}
      <button
        type="button"
        className={`w-full flex items-center gap-2 rounded-lg py-2.5 px-3 text-sm outline-none transition-all duration-200 cursor-pointer text-left bg-[#020204] shadow-[inset_0_2px_4px_rgba(0,0,0,0.85)]
          ${open ? 'border-accent-gold/45 text-white' : 'border-white/[0.07] hover:border-white/[0.14] text-white/85'}`}
        onClick={() => setOpen(!open)}
      >
        <span className="flex-1 min-w-0 truncate">
          {selectedOption ? (
            <span className="flex items-center gap-1.5 min-w-0">
              {getLangBadgeMini(selectedOption.lang)}
              <FileNameText name={selectedOption.name} className="text-neutral-300 font-medium flex-1" />
            </span>
          ) : (
            <span className="text-white/38">{placeholder}</span>
          )}
        </span>
        {countLabel != null && (
          <span className="text-accent-gold text-xs font-mono flex-shrink-0 font-bold bg-[#0a0a0d] px-1.5 py-0.5 rounded border border-white/[0.06]">{countLabel}行</span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-white/35 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180 text-accent-gold' : ''}`} />
      </button>

      {/* Outset Layered Dropdown Board */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-[200] bg-[#0c0d10] border border-neutral-900 rounded-xl overflow-hidden shadow-[0_12px_36px_rgba(0,0,0,0.85),_inset_0_1px_0_rgba(255,255,255,0.05)] max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-white/[0.08]">
          {/* Unbound option */}
          <button
            className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-white/[0.03] transition text-left cursor-pointer active:bg-white/[0.01]
              ${!value ? 'text-white/85 bg-white/[0.01] font-semibold' : 'text-white/55'}`}
            onClick={() => { onChange(''); setOpen(false); }}
          >
            {!value && <Check className="w-3 h-3 text-accent-gold flex-shrink-0" />}
            <span className={`text-sm ${!value ? 'pl-0' : 'pl-[18px]'} text-neutral-300`}>未选择</span>
          </button>

          {/* File options */}
          {options.map(opt => {
            const isSelected = value === opt.id;
            return (
              <button
                key={opt.id}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-white/[0.03] transition text-left border-t border-black/30 cursor-pointer active:bg-white/[0.01]
                  ${isSelected ? 'bg-accent-gold/[0.02] text-white font-semibold' : 'text-white/70'}`}
                onClick={() => { onChange(opt.id); setOpen(false); }}
                title={opt.name}
              >
                {isSelected
                  ? <Check className="w-3 h-3 text-accent-gold flex-shrink-0" />
                  : <span className="w-3 flex-shrink-0" />
                }
                {getLangBadgeMini(opt.lang)}
                <FileNameText name={truncateMiddle(opt.name, 120)} className="flex-1 font-mono text-sm text-neutral-100" />
                {opt.count != null && (
                  <span className="text-white/55 text-xs flex-shrink-0 font-mono tabular-nums">{opt.count}行</span>
                )}
              </button>
            );
          })}

          {options.length === 0 && (
            <div className="px-3 py-4 text-xs text-white/45 text-center">
              暂无已上传的字幕文件
            </div>
          )}
        </div>
      )}
    </div>
  );
};
