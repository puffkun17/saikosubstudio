'use client';

import React, { useState } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import { DragZone } from '@/components/Ingest/DragZone';
import { TaskList } from '@/components/Ingest/TaskList';
import { TmdbPanel } from '@/components/Ingest/TmdbPanel';
import { Database, Trash2, Calendar, Clock, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const IngestStep: React.FC = () => {
  const { 
    tasks, 
    libraryList, 
    loadFromLibrary, 
    deleteFromLibrary
  } = useStudioStore();

  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  return (
    <div className="flex-1 w-full h-full flex flex-col p-3 md:p-4 lg:p-5 2xl:p-6 lg:overflow-hidden overflow-y-auto relative bg-[#050507] z-0">
      {/* Cinematic ambient lights */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-violet-600/[0.03] rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-600/[0.015] rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Tech grid system */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:5rem_5rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)] pointer-events-none -z-10" />
      
      {/* Hairline structural layout guides */}
      <div className="absolute left-[5%] right-[5%] top-[14%] h-px bg-gradient-to-r from-transparent via-white/[0.03] to-transparent pointer-events-none -z-10" />
      <div className="absolute left-[5%] right-[5%] bottom-[12%] h-px bg-gradient-to-r from-transparent via-white/[0.03] to-transparent pointer-events-none -z-10" />

      {/* Micro-technical markings */}
      <div className="absolute top-4 left-6 text-[0.5625rem] font-mono text-neutral-600 tracking-[0.25em] select-none pointer-events-none uppercase">
        SYS_LOC.0x39F // BASEMENT_INIT
      </div>
      <div className="absolute top-4 right-6 text-[0.5625rem] font-mono text-neutral-600 tracking-[0.25em] select-none pointer-events-none uppercase">
        REF.NODE_CNST // EST_2026
      </div>

      {/* Animated drifting sparks */}
      <motion.div
        animate={{
          x: [0, -35, 20, 0],
          y: [0, 45, -15, 0],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "linear"
        }}
        className="absolute top-[30%] right-[15%] w-1.5 h-1.5 rounded-full bg-violet-500/20 blur-[1px] pointer-events-none -z-10"
      />
      <motion.div
        animate={{
          x: [0, 40, -30, 0],
          y: [0, -50, 25, 0],
        }}
        transition={{
          duration: 28,
          repeat: Infinity,
          ease: "linear"
        }}
        className="absolute bottom-[20%] left-[25%] w-2 h-2 rounded-full bg-violet-500/10 blur-[1.5px] pointer-events-none -z-10"
      />

      {/* System Ticker / Monospace Eyebrow - 保留 Git 改进的术语 */}
      <div className="flex items-center gap-2 mb-2 select-none z-20 flex-shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-ping" />
        <span className="text-[0.625rem] font-mono uppercase tracking-[0.3em] text-violet-400/70">
          阅片环境初始化 // 片源与字幕对齐绑定
        </span>
      </div>

      {/* Step Header - 保留 Git 的 v2.0.1 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 md:mb-5 z-20 flex-shrink-0">
        <div className="flex flex-col gap-2 text-left">
          <h1 className="text-h4 font-extrabold tracking-tighter text-white flex items-center flex-wrap [text-shadow:0_0_15px_rgba(255,255,255,0.15)] font-sans">
            substudio.
            <span className="text-[0.5625rem] text-violet-400 bg-violet-500/10 border border-violet-500/20 px-3 py-1 rounded-full ml-4 font-mono font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(168,85,247,0.15)]">
              v2.0.1
            </span>
          </h1>
          <p className="text-xs md:text-sm text-neutral-400 font-mono uppercase tracking-wider text-neutral-400/80">
            professional dual-track subtitle ingestion & styling engine
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 md:gap-4">
          <button 
            className="px-5 py-2.5 glass-btn-ar rounded-full text-xs font-mono uppercase tracking-[0.1em] text-neutral-400 hover:text-white flex items-center gap-2 cursor-pointer border border-white/5 hover:border-violet-500/30 hover:shadow-[0_0_15px_rgba(168,85,247,0.1)] transition-all duration-300 group"
            onClick={() => setIsLibraryOpen(true)}
          >
            <Clock className="w-3.5 h-3.5 text-violet-400 group-hover:rotate-12 transition-transform" />
            历史存档字幕
            {libraryList.length > 0 && (
              <span className="bg-violet-500/15 text-violet-400 px-2 py-0.5 rounded-full text-xs ml-1 font-bold">{libraryList.length}</span>
            )}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {tasks.length === 0 ? (
          <motion.div 
            key="empty-state"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, filter: "blur(4px)" }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
            className="flex-1 flex flex-col gap-12 max-w-5xl mx-auto w-full items-center justify-center py-10 md:py-16"
          >
            <DragZone />
          </motion.div>
        ) : (
          /* Task List when files are loaded - Split Grid Layout */
          <motion.div 
            key="task-list-container"
            initial={{ opacity: 0, scale: 0.98, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
            className="flex-1 desktop-panel-fit-hidden grid grid-cols-1 lg:grid-cols-3 gap-4 z-10 max-w-[1600px] mx-auto w-full relative"
          >
            {/* TMDB Panel */}
            <div className="lg:col-span-1 desktop-panel-fit-hidden min-w-0 p-1 bg-white/[0.01] border border-white/[0.04] rounded-[28px] shadow-2xl hover:border-violet-500/15 transition-colors duration-500">
              <TmdbPanel />
            </div>
            {/* TaskList */}
            <div className="lg:col-span-2 flex flex-col desktop-panel-fit-visible min-w-0 relative p-1 bg-white/[0.01] border border-white/[0.04] rounded-[28px] shadow-2xl hover:border-violet-500/15 transition-colors duration-500">
              <TaskList />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Library Modal */}
      <AnimatePresence>
        {isLibraryOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[2000] flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setIsLibraryOpen(false); }}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="glass-panel-ar rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col gap-0 max-h-[85vh] overflow-hidden"
            >
              <div className="flex justify-between items-center px-6 py-5 border-b border-white/5 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-violet-400" />
                  <h4 className="text-base font-bold text-white tracking-wide">历史存档字幕</h4>
                </div>
                <button
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition cursor-pointer"
                  onClick={() => setIsLibraryOpen(false)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                {libraryList.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {libraryList.map((item) => {
                      const isBilingual = item.subs.some(s => s.text.includes('\n'));
                      return (
                        <motion.div 
                          key={item.id}
                          whileHover={{ y: -2 }}
                          className="relative overflow-hidden p-6 bg-white/[0.015] hover:bg-white/[0.045] border border-white/5 hover:border-white/10 rounded-2xl cursor-pointer flex gap-5 transition-all duration-300 items-center justify-between group shadow-lg"
                          onClick={() => {
                            loadFromLibrary(item);
                            setIsLibraryOpen(false);
                          }}
                        >
                          {item.backdrop && (
                            <div 
                              className="absolute inset-0 bg-cover bg-center opacity-[0.05] group-hover:opacity-[0.1] transition-opacity -z-10 filter blur-[8px] scale-110"
                              style={{ backgroundImage: `url(${item.backdrop})` }}
                            />
                          )}

                          <div className="min-w-0 flex-1 pl-2 border-l-2 border-transparent group-hover:border-violet-400 transition-colors duration-300">
                            <h4 className="text-base font-bold text-white/90 group-hover:text-white truncate transition-colors pl-3">
                              {item.name}
                            </h4>
                            <div className="flex items-center gap-3 mt-2 text-xs text-neutral-450 font-mono pl-3">
                              <span className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-white/40" />
                                {item.date}
                              </span>
                              <span className="w-1 h-1 rounded-full bg-white/20" />
                              <span className="text-white/60 font-sans font-medium">
                                {isBilingual ? '双语轨' : '单轨'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 z-10">
                            <span className="text-white/50 font-mono text-xs">
                              {item.subs.length} 行
                            </span>
                            <button 
                              className="text-white/25 hover:text-rose-400 p-2 rounded-xl hover:bg-white/5 transition cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); deleteFromLibrary(item.id); }}
                              title="删除存档"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-white/30">
                    <Database className="w-12 h-12 mb-4 opacity-50" />
                    <p className="font-medium text-sm">暂无存档的字幕项目</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
