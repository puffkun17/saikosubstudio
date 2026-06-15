'use client';

import React, { useRef, useState } from 'react';
import { useStudioStore, TaskPair, Subfile } from '@/store/useStudioStore';
import { Play, Plus, RotateCcw, X } from 'lucide-react';
import { parseSrt, decodeBuffer, detectLanguageByContent, checkIsBilingual, StyleSettings } from '@/utils/subtitleCore';
import { motion } from 'framer-motion';
import { TrackSelect } from '@/components/Ingest/TrackSelect';

export const TaskList: React.FC = () => {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingCancelUpload, setPendingCancelUpload] = useState(false);
  const [isFilenameFocused, setIsFilenameFocused] = useState(false);
  const { 
    tasks, 
    selectedTaskId, 
    selectTask, 
    bindTrack, 
    // removeFileFromTask, 
    deleteTask, 
    cancelCurrentUpload,
    uploadedFiles,
    customFilename,
    filenameSource,
    setCustomFilename,
    isProcessing,
    runSubtitleMerge,
    showAssHint,
    setShowAssHint,
    foundAssStyle,
    setCustomStyle,
    setActivePreset,
    addLog,
    alignmentMode,
    setAlignmentMode
  } = useStudioStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const readAndDecodeFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const decoded = decodeBuffer(reader.result as ArrayBuffer);
          resolve(decoded.text);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFilesProcess = async (filesList: File[]) => {
    if (filesList.length === 0) return;
    const detectedFiles: Subfile[] = [];
    const { processFiles, addLog } = useStudioStore.getState();

    for (const file of filesList) {
      const nameLower = file.name.toLowerCase();
      if (nameLower.endsWith('.srt') || nameLower.endsWith('.ass')) {
        try {
          const text = await readAndDecodeFile(file);
          const isBilingual = checkIsBilingual(text);
          const langDetect = isBilingual ? 'bilingual' : detectLanguageByContent(text);
          
          detectedFiles.push({
            id: `file_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,
            name: file.name,
            text,
            lang: langDetect,
            isBilingual,
            isCommentary: /(commentary|comment|director|解说|导轨)/i.test(file.name),
            size: text.length
          });
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          addLog(`读取文件 ${file.name} 失败: ${msg}`, "error");
        }
      }
    }

    if (detectedFiles.length > 0) {
      processFiles(detectedFiles);
    }
  };

  const getSubTitleCount = (file: Subfile | null | undefined) => {
    if (!file || !file.text) return 0;
    try {
      if (file.text.includes('[Events]') && file.text.includes('Dialogue:')) {
        return file.text.split('\n').filter((l: string) => l.trim().startsWith('Dialogue:')).length;
      }
      return parseSrt(file.text).length;
    } catch {
      return 0;
    }
  };

  const getProcessBtnText = (task: TaskPair) => {
    if (task.isBilingualSingle) {
      return '加载原生双语';
    }
    const hasZh = !!task.zh;
    const hasEn = !!task.en;
    if (hasZh && hasEn) {
      return '合并双语字幕';
    } else {
      return '导入单轨字幕';
    }
  };

  const getFilenameSourceLabel = () => {
    switch (filenameSource) {
      case 'tmdb':
        return '来自片源信息';
      case 'auto':
        return '自动提取';
      case 'manual':
        return '手动输入';
      case 'library':
        return '历史存档';
      default:
        return '等待命名';
    }
  };

  const renderMarqueeText = (text: string, className = '') => {
    const shouldScroll = text.length > 38;
    return (
      <span className={`min-w-0 overflow-hidden whitespace-nowrap ${className}`} title={text}>
        <span className={shouldScroll ? 'inline-block subtitle-marquee' : 'truncate'}>
          {text}
        </span>
      </span>
    );
  };

  // Find active task or default to first
  const activeTask = tasks.find(t => t.id === selectedTaskId) || tasks[0];

  if (!activeTask) return null;

  const zhCount = getSubTitleCount(activeTask.zh);
  const enCount = getSubTitleCount(activeTask.en);
  let diffBadge = null;
  if (activeTask.zh && activeTask.en) {
    const max = Math.max(zhCount, enCount);
    const diffRatio = max > 0 ? Math.abs(zhCount - enCount) / max : 0;
    if (diffRatio <= 0.05) {
      diffBadge = <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-semibold rounded flex-shrink-0 select-none shadow-[0_0_10px_rgba(16,185,129,0.15)]">已匹配</span>;
    } else if (diffRatio <= 0.15) {
      diffBadge = <span className="px-2 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-semibold rounded flex-shrink-0 select-none">需检查</span>;
    } else {
      diffBadge = <span className="px-2 py-0.5 bg-rose-500/10 text-rose-300 border border-rose-500/20 text-xs font-semibold rounded flex-shrink-0 select-none">待确认</span>;
    }
  }

  return (
    <div className="flex flex-col gap-3.5 glass-panel-ar p-4 md:p-5 rounded-3xl desktop-panel-fit-visible relative shadow-2xl group transition-all duration-500 hover:border-violet-500/20 hover:shadow-[0_24px_60px_rgba(0,0,0,0.55),_0_0_40px_rgba(168,85,247,0.08)] bg-gradient-to-b from-transparent via-transparent to-violet-950/[0.015]">
      
      {/* Header section */}
      <div className="flex justify-between items-center pb-2.5 border-b border-white/[0.06] flex-shrink-0 select-none gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <h3 className="text-base font-bold text-neutral-100 tracking-wide font-sans">
            字幕文件
          </h3>
          <span className="text-xs font-semibold text-[#d8c39a] bg-white/[0.03] border border-white/[0.08] px-2.5 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pendingCancelUpload ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="px-3 py-2 rounded-xl text-xs font-bold text-rose-300 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/18 transition cursor-pointer"
                onClick={() => { cancelCurrentUpload(); setPendingCancelUpload(false); }}
              >
                确认取消
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded-xl text-xs font-bold text-neutral-400 bg-white/[0.025] border border-white/[0.06] hover:text-white hover:bg-white/[0.05] transition cursor-pointer"
                onClick={() => setPendingCancelUpload(false)}
              >
                保留
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="group px-3 py-2 glass-btn-ar rounded-xl text-xs md:text-sm tracking-[0.04em] flex items-center gap-1.5 transition-all duration-200 cursor-pointer border border-white/5 hover:bg-white/[0.04]"
              onClick={() => setPendingCancelUpload(true)}
              title="取消本次导入并返回上传入口"
            >
              <RotateCcw className="w-3.5 h-3.5 text-neutral-400 group-hover:text-rose-300 transition-colors" />
              取消导入
            </button>
          )}
          <button 
            className="group px-4 py-2 glass-btn-ar rounded-xl text-xs md:text-sm tracking-[0.04em] flex items-center gap-1.5 transition-all duration-200 cursor-pointer border border-white/5 hover:bg-white/[0.04]"
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus className="w-3.5 h-3.5 text-[#d8c39a] group-hover:rotate-90 transition-transform duration-300" />
            关联文件
          </button>
        </div>
      </div>

      {/* Task tab switcher (if multiple tasks exist) */}
      {tasks.length > 1 && (
        <div className="flex gap-2 pb-2 border-b border-white/[0.04] overflow-x-auto scrollbar-none flex-shrink-0">
          {tasks.map(t => {
            const isActive = t.id === activeTask.id;
            return (
              <button
                key={t.id}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-mono transition-all truncate max-w-[180px] cursor-pointer border
                  ${isActive 
                    ? 'bg-[#c5a46e]/10 text-[#d8c39a] border-[#c5a46e]/30 shadow-[0_0_12px_rgba(197,164,110,0.12)] font-bold' 
                    : 'bg-white/[0.01] text-neutral-400 border-white/[0.04] hover:bg-white/[0.04] hover:text-neutral-200'}`}
                onClick={() => selectTask(t.id)}
              >
                {t.title}
              </button>
            );
          })}
        </div>
      )}

      {/* Main workspace layout stretching to fill card height */}
      <div className="flex-1 flex flex-col gap-3.5 overflow-y-auto pr-1 select-none scrollbar-thin scrollbar-thumb-white/[0.03] relative min-h-0 overflow-x-visible">
        
        {/* Banner/Title Card */}
        <div className="p-3 bg-white/[0.015] border border-white/[0.04] rounded-xl flex items-center justify-between gap-3 relative flex-shrink-0 shadow-lg">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <motion.span 
              animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all duration-300
                ${(activeTask.zh && activeTask.en) 
                  ? 'bg-[#d8c39a] shadow-[0_0_10px_rgba(197,164,110,0.65)]' 
                  : (activeTask.zh || activeTask.en) 
                    ? 'bg-amber-450 shadow-[0_0_10px_rgba(245,158,11,0.7)]' 
                    : 'bg-white/10'}`} 
            />
            {renderMarqueeText(activeTask.title, 'text-xs md:text-sm font-semibold text-neutral-100 pr-1 font-mono flex-1')}
            {diffBadge}
          </div>

          {/* Delete Task */}
          {pendingDeleteId === activeTask.id ? (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                className="text-xs font-bold px-2.5 py-1 rounded-lg bg-rose-600/20 text-rose-300 hover:bg-rose-600/40 border border-rose-500/15 active:translate-y-[1px] transition-colors cursor-pointer"
                onClick={(e) => { e.stopPropagation(); deleteTask(activeTask.id); setPendingDeleteId(null); }}
              >
                确认
              </button>
              <button
                className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-neutral-100 border border-white/5 active:translate-y-[1px] transition-colors cursor-pointer"
                onClick={(e) => { e.stopPropagation(); setPendingDeleteId(null); }}
              >
                取消
              </button>
            </div>
          ) : (
            <button 
              className="text-neutral-500 hover:text-rose-400 transition-colors flex-shrink-0 p-1.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/5 active:translate-y-[1px] cursor-pointer"
              onClick={(e) => { e.stopPropagation(); setPendingDeleteId(activeTask.id); }}
              title="删除任务"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Unified vertical workspace layout */}
        <div className="flex flex-col gap-3.5 flex-1 min-h-0 overflow-visible">
          
          {/* Track Bindings - Wide horizontal card */}
          <div className="p-4 bg-white/[0.01] border border-white/[0.04] rounded-xl flex flex-col gap-3 shadow-md overflow-visible relative">
            <h4 className="text-sm text-neutral-200 font-semibold block select-none">
              字幕文件匹配
            </h4>
            <div className="flex flex-col gap-2.5 bg-white/[0.005] p-3 rounded-lg border border-white/[0.03] overflow-visible relative">
              {/* Chinese binding */}
              <div className="flex flex-row items-center gap-2 overflow-visible">
                <span className="w-24 text-sm text-neutral-200 font-semibold shrink-0 text-left">
                  主字幕
                </span>
                <TrackSelect
                  value={activeTask.zh?.id || ''}
                  options={uploadedFiles.map(f => ({ id: f.id, name: f.name, count: getSubTitleCount(f), lang: f.lang }))}
                  onChange={(id) => bindTrack(activeTask.id, 'zh', id)}
                  countLabel={activeTask.zh ? getSubTitleCount(activeTask.zh) : null}
                  placeholder="选择中文或双语字幕"
                />
              </div>

              {!activeTask.isBilingualSingle ? (
                <>
                  {/* English binding */}
                  <div className="flex flex-row items-center gap-2 overflow-visible">
                    <span className="w-24 text-sm text-neutral-200 font-semibold shrink-0 text-left">
                      英文字幕
                    </span>
                    <TrackSelect
                      value={activeTask.en?.id || ''}
                      options={uploadedFiles.map(f => ({ id: f.id, name: f.name, count: getSubTitleCount(f), lang: f.lang }))}
                      onChange={(id) => bindTrack(activeTask.id, 'en', id)}
                      countLabel={activeTask.en ? getSubTitleCount(activeTask.en) : null}
                      placeholder="选择英文字幕（可选）"
                    />
                  </div>

                  {/* Commentary binding */}
                  <div className="flex flex-row items-center gap-2 overflow-visible">
                    <span className="w-24 text-sm text-neutral-200 font-semibold shrink-0 text-left">
                      旁白与导评
                    </span>
                    <TrackSelect
                      value={activeTask.commentary?.id || ''}
                      options={uploadedFiles.map(f => ({ id: f.id, name: f.name, count: getSubTitleCount(f), lang: f.lang }))}
                      onChange={(id) => bindTrack(activeTask.id, 'commentary', id)}
                      placeholder="选择旁白或导评字幕（可选）"
                    />
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center py-3 px-3 bg-violet-500/[0.02] border border-violet-500/10 rounded-lg mt-1">
                  <span className="text-xs text-[#d8c39a] font-semibold">
                    已识别为双语字幕，可直接进入预览
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Configuration & Process Dock */}
          <div className="p-4 bg-white/[0.01] border border-white/[0.04] rounded-xl flex flex-col gap-3 shadow-md overflow-visible mt-auto">
            
            {/* ASS style extraction hint */}
            {showAssHint && foundAssStyle && (
              <motion.div 
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 bg-violet-650/5 border border-violet-500/20 rounded-xl flex items-center justify-between gap-3 shadow-[0_4px_15px_rgba(0,0,0,0.3)]"
              >
                <div className="text-xs md:text-sm text-neutral-200">
                  <span className="text-[#d8c39a] font-bold">检测到字幕样式:</span>
                  {' '}中文 {foundAssStyle.zhFontSize}像素 / 英文 {foundAssStyle.enFontSize}像素
                </div>
                <div className="flex gap-1.5">
                  <button 
                    className="px-3 py-1.5 text-[#f0ddaf] text-xs font-bold rounded-lg border border-[#c5a46e]/20 bg-[#c5a46e]/10 hover:bg-[#c5a46e]/20 cursor-pointer"
                    onClick={() => {
                      setCustomStyle(foundAssStyle as StyleSettings);
                      setActivePreset('custom');
                      setShowAssHint(false);
                      addLog("已应用 ASS 文件自带的字体参数", 'success');
                    }}
                  >
                    应用
                  </button>
                  <button 
                    className="px-3 py-1.5 bg-white/5 text-neutral-400 border border-white/5 text-xs rounded-lg hover:bg-white/10 cursor-pointer"
                    onClick={() => setShowAssHint(false)}
                  >
                    忽略
                  </button>
                </div>
              </motion.div>
            )}

            <div className="flex flex-col lg:flex-row lg:items-end gap-3.5">
              
              {/* Output name */}
              <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-sm text-neutral-200 font-semibold select-none">
                    输出文件名
                  </label>
                  <span className="shrink-0 rounded-md border border-[#c5a46e]/18 bg-[#c5a46e]/8 px-2 py-0.5 text-xs font-bold text-[#d8c39a]">
                    {getFilenameSourceLabel()}
                  </span>
                </div>
                <div className="relative">
                  <input 
                    type="text" 
                    className="w-full h-10 bg-[#020204] border border-white/[0.08] focus:border-[#c5a46e]/40 focus:bg-white/[0.025] rounded-lg px-3.5 text-white text-sm outline-none transition-all placeholder:text-white/35 font-mono shadow-[inset_0_2px_4px_rgba(0,0,0,0.85)]"
                    value={customFilename}
                    onChange={e => setCustomFilename(e.target.value, 'manual')}
                    onFocus={() => setIsFilenameFocused(true)}
                    onBlur={() => setIsFilenameFocused(false)}
                    placeholder="自动命名..."
                  />
                  {customFilename.length > 42 && !isFilenameFocused && (
                    <div className="pointer-events-none absolute inset-y-px left-px right-px rounded-lg bg-[#020204] flex items-center px-3.5 text-sm font-mono text-white overflow-hidden">
                      {renderMarqueeText(customFilename, 'w-full')}
                    </div>
                  )}
                </div>
              </div>

              {/* Alignment Mode Selection */}
              {!activeTask.isBilingualSingle && (
                <div className="flex flex-col gap-1.5 w-full lg:w-60 shrink-0">
                  <label className="text-sm text-neutral-200 font-semibold select-none">
                    对齐方式
                  </label>
                  <div className="grid grid-cols-2 gap-0.5 p-0.5 rounded-lg bg-[#020204] border border-white/[0.06] relative shadow-[inset_0_2px_4px_rgba(0,0,0,0.85)] h-10 items-center">
                    <button
                      className={`relative z-10 py-1.5 rounded-md text-sm font-semibold transition-all duration-105 cursor-pointer ${alignmentMode === 'standard' ? 'text-white' : 'text-neutral-300 hover:text-neutral-100'}`}
                      onClick={() => setAlignmentMode('standard')}
                    >
                      {alignmentMode === 'standard' && (
                        <motion.div 
                          layoutId="activeEngine" 
                          className="absolute inset-0 bg-white/[0.05] border border-white/[0.08] shadow-[0_1.5px_3px_rgba(0,0,0,0.3)] rounded-md -z-10" 
                          transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        />
                      )}
                      智能
                    </button>
                    <button
                      className={`relative z-10 py-1.5 rounded-md text-sm font-semibold transition-all duration-105 cursor-pointer ${alignmentMode === 'industrial' ? 'text-[#d8c39a]' : 'text-neutral-300 hover:text-neutral-100'}`}
                      onClick={() => setAlignmentMode('industrial')}
                    >
                      {alignmentMode === 'industrial' && (
                        <motion.div 
                          layoutId="activeEngine" 
                          className="absolute inset-0 bg-violet-650/15 border border-violet-500/25 shadow-[0_1.5px_6px_rgba(168,85,247,0.15)] rounded-md -z-10" 
                          transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        />
                      )}
                      细致
                    </button>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div className="w-full lg:w-56 shrink-0">
                <button
                  className={`w-full h-10 rounded-lg font-bold text-center text-sm transition-all flex items-center justify-center gap-2 cursor-pointer
                    ${(!activeTask.zh && !activeTask.en) || isProcessing 
                      ? 'bg-white/[0.02] text-white/20 border border-white/5 cursor-not-allowed' 
                      : 'bg-violet-600/25 hover:bg-violet-600/35 text-violet-300 border border-violet-500/30 hover:border-violet-500/50 shadow-[0_4px_20px_rgba(168,85,247,0.18)] hover:scale-[1.01]'}`}
                  disabled={(!activeTask.zh && !activeTask.en) || isProcessing}
                  onClick={runSubtitleMerge}
                >
                  {isProcessing ? (
                    <span className="w-3.5 h-3.5 border-2 border-violet-400/20 border-t-violet-400 rounded-full animate-spin shrink-0" />
                  ) : (
                    <Play className={`w-3.5 h-3.5 shrink-0 ${(!activeTask.zh && !activeTask.en) ? 'text-white/20 fill-white/10' : 'text-violet-450 fill-violet-500/20'}`} />
                  )}
                  {isProcessing ? '正在对齐合并...' : getProcessBtnText(activeTask)}
                </button>
              </div>

            </div>
          </div>

        </div>

      </div>

      <input 
        ref={fileInputRef}
        type="file" 
        multiple 
        accept=".srt,.ass" 
        className="hidden" 
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          handleFilesProcess(files);
        }} 
      />
    </div>
  );
};
