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
    'zh-CN': { label: '简', color: 'text-[#dbe4e8] bg-[#7f95a0]/18 border border-[#9cafb8]/35' },
    'zh-TW': { label: '繁', color: 'text-[#dbe4e8] bg-[#7f95a0]/18 border border-[#9cafb8]/35' },
    'zh': { label: '中', color: 'text-[#dbe4e8] bg-[#7f95a0]/18 border border-[#9cafb8]/35' },
    'en': { label: '英', color: 'text-[#dfe8dd] bg-[#84977f]/18 border border-[#a8b7a3]/35' },
    'bilingual': { label: '双', color: 'text-[#e6dfe6] bg-[#998aa0]/18 border border-[#b9a7b5]/35' },
    'commentary': { label: '导', color: 'text-[#eadfd8] bg-[#9f897b]/18 border border-[#c0a89a]/35' },
  };
  const entry = map[lang];
  if (!entry) return null;
  return (
    <span className={`text-xs font-semibold px-2 py-1 rounded-md flex-shrink-0 ${entry.color}`}>
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
        className={`w-full flex items-center gap-2 rounded-xl py-3 px-3.5 text-base outline-none transition-all duration-200 cursor-pointer text-left bg-[#020204] shadow-[inset_0_2px_4px_rgba(0,0,0,0.85)]
          ${open ? 'border-white/30 text-white' : 'border-white/[0.07] hover:border-white/[0.14] text-white/85'}`}
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
          <span className="text-white/80 text-xs font-mono flex-shrink-0 font-semibold bg-[#0a0a0d] px-2 py-1 rounded-md border border-white/[0.06]">{countLabel}行</span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-white/35 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180 text-white/80' : ''}`} />
      </button>

      {/* Outset Layered Dropdown Board */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-[200] bg-[#0c0d10] border border-neutral-900 rounded-xl overflow-hidden shadow-[0_12px_36px_rgba(0,0,0,0.85),_inset_0_1px_0_rgba(255,255,255,0.05)] max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-white/[0.08]">
          {/* Unbound option */}
          <button
            className={`w-full flex items-center gap-2 px-3.5 py-3 text-base hover:bg-white/[0.03] transition text-left cursor-pointer active:bg-white/[0.01]
              ${!value ? 'text-white/85 bg-white/[0.01] font-semibold' : 'text-white/55'}`}
            onClick={() => { onChange(''); setOpen(false); }}
          >
            {!value && <Check className="w-3 h-3 text-white/80 flex-shrink-0" />}
            <span className={`text-base ${!value ? 'pl-0' : 'pl-[18px]'} text-neutral-300`}>未选择</span>
          </button>

          {/* File options */}
          {options.map(opt => {
            const isSelected = value === opt.id;
            return (
              <button
                key={opt.id}
                className={`w-full flex items-center gap-2 px-3.5 py-3 text-base hover:bg-white/[0.03] transition text-left border-t border-black/30 cursor-pointer active:bg-white/[0.01]
                  ${isSelected ? 'bg-white/[0.04] text-white font-semibold' : 'text-white/70'}`}
                onClick={() => { onChange(opt.id); setOpen(false); }}
                title={opt.name}
              >
                {isSelected
                  ? <Check className="w-3 h-3 text-white/80 flex-shrink-0" />
                  : <span className="w-3 flex-shrink-0" />
                }
                {getLangBadgeMini(opt.lang)}
                <FileNameText name={truncateMiddle(opt.name, 120)} className="flex-1 font-mono text-base text-neutral-100" />
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
