'use client';

import React, { useState, useRef } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import { Pipette, ImageIcon, ShieldAlert } from 'lucide-react';

type EyeDropperConstructor = new () => {
  open: () => Promise<{ sRGBHex: string }>;
};

export const ColorSampler: React.FC = () => {
  const { 
    customStyle, 
    setCustomStyle, 
    refScreenshot, 
    setRefScreenshot, 
    addLog,
  } = useStudioStore();

  const [overlayOpacity, setOverlayOpacity] = useState(0.5);
  const [pickColorTarget, setPickColorTarget] = useState<'zhColor' | 'zhOutline' | 'enColor'>('zhColor');
  const [eyeDropperSupported] = useState(() => typeof window !== "undefined" && "EyeDropper" in window);

  const fileInputRef = useRef<HTMLInputElement>(null);


  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Revoke previous blob if any
    if (refScreenshot && refScreenshot.startsWith('blob:')) {
      URL.revokeObjectURL(refScreenshot);
    }

    const url = URL.createObjectURL(file);
    setRefScreenshot(url);
    addLog("已载入参考截图，您可以通过浏览器自带吸色器或直接观察微调", "success");
  };

  const triggerEyeDropper = async () => {
    if (!eyeDropperSupported) {
      addLog("当前浏览器不支持原生 EyeDropper 吸色器", "error");
      return;
    }
    try {
      const EyeDropper = (window as Window & { EyeDropper?: EyeDropperConstructor }).EyeDropper;
      if (!EyeDropper) return;

      const eyeDropper = new EyeDropper();
      const result = await eyeDropper.open();
      const color = result.sRGBHex;

      const label = pickColorTarget === 'zhColor' ? '中文字色' : pickColorTarget === 'zhOutline' ? '中文描边色' : '第二语言字色';
      addLog(`[吸色] 已提取颜色: ${color} 并应用到 ${label}`, "success");
      
      setCustomStyle({
        ...customStyle,
        [pickColorTarget]: color
      });
    } catch {
      // User cancelled
    }
  };

  return (
    <div className="bg-[#0c0c10] border border-white/5 p-4 rounded-xl flex flex-col gap-4 text-left w-full">
      <div className="pb-2.5 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-white/75" />
          <span className="text-sm font-semibold text-neutral-100">截图取色</span>
        </div>
        
        {refScreenshot && (
          <button 
            className="text-xs text-rose-300 font-medium hover:text-rose-200 transition-colors"
            onClick={() => {
              if (refScreenshot.startsWith('blob:')) URL.revokeObjectURL(refScreenshot);
              setRefScreenshot(null);
            }}
          >
            移除截图
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {/* Upload Button */}
        {!refScreenshot ? (
          <div 
            className="h-28 border border-dashed border-white/10 hover:border-white/20 rounded-xl bg-white/[0.01] hover:bg-white/[0.02] transition cursor-pointer flex flex-col items-center justify-center gap-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon className="w-6 h-6 text-white/30" />
            <span className="text-sm text-neutral-400">上传剧照或截图参考</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Display small preview */}
            <div className="relative h-20 rounded-lg overflow-hidden border border-white/5 bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={refScreenshot} 
                alt="参考剧照预览（用于吸色器对比）" 
                className="w-full h-full object-cover opacity-75"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-2">
                <span className="text-xs font-medium text-white truncate max-w-full">参考剧照加载就绪</span>
              </div>
            </div>

            {/* Target Select */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-neutral-400 font-medium">吸色应用到</span>
              <div className="grid grid-cols-3 gap-1">
                {(['zhColor', 'zhOutline', 'enColor'] as const).map(target => {
                  const label = target === 'zhColor' ? '中文' : target === 'zhOutline' ? '描边' : '第二语言';
                  const active = pickColorTarget === target;
                  return (
                    <button
                      key={target}
                      type="button"
                      className={`py-1.5 text-center rounded-md text-xs font-medium border transition
                        ${active ? 'bg-white/[0.12] border-white/25 text-white' : 'bg-white/5 border-transparent text-white/60 hover:bg-white/10'}`}
                      onClick={() => setPickColorTarget(target)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Opacity slider */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs font-medium text-neutral-400">
                <span>截图背景透明度</span>
                <span className="font-mono text-white/85 tabular-nums">{Math.round(overlayOpacity * 100)}%</span>
              </div>
              <input 
                type="range" min="0.1" max="1.0" step="0.05"
                value={overlayOpacity}
                onChange={e => setOverlayOpacity(parseFloat(e.target.value))}
                className="v9-timeline-dial-slider"
              />
            </div>
            
            {/* EyeDropper button */}
            {eyeDropperSupported ? (
              <button 
                className="w-full py-2.5 bg-white hover:bg-neutral-200 text-black font-semibold rounded-lg text-sm flex items-center justify-center gap-1.5 transition-all shadow"
                onClick={triggerEyeDropper}
              >
                <Pipette className="w-3.5 h-3.5" />
                启动吸色器
              </button>
            ) : (
              <div className="p-2.5 bg-[#9f897b]/10 border border-[#c0a89a]/20 rounded-lg text-xs text-[#eadfd8]/80 flex items-start gap-2 leading-relaxed">
                <ShieldAlert className="w-4 h-4 text-[#c0a89a] flex-shrink-0" />
                <span>当前浏览器暂不支持吸色器。可以保留参考截图，通过画面叠加进行人工对比。</span>
              </div>
            )}
          </div>
        )}
      </div>

      <input 
        ref={fileInputRef} 
        type="file" 
        accept="image/*" 
        className="hidden" 
        onChange={handleScreenshotUpload} 
      />
    </div>
  );
};
