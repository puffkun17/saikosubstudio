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
    <div className="flex-1 w-full h-full flex flex-col p-5 md:p-8 lg:p-10 2xl:p-12 lg:overflow-hidden overflow-y-auto relative bg-[#020203] z-0">
      <div className="flex items-center gap-2 mb-3 select-none z-20 flex-shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-[#9ca3af]/85" />
        <span className="text-sm font-medium text-[#e5e7eb]/86">
          字幕导入 · 轨道整理 · 片源匹配
        </span>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 md:mb-10 z-20 flex-shrink-0">
        <div className="flex flex-col gap-2 text-left">
          <h1 className="!text-[clamp(3.2rem,5.6vw,6.75rem)] font-semibold tracking-tight text-white flex items-center flex-wrap font-sans leading-[0.96]">
            SaikoSubStudio
            <span className="text-xs text-[#e5e7eb] bg-[#9ca3af]/10 border border-[#9ca3af]/20 px-3 py-1 rounded-lg ml-4 font-mono font-semibold shadow-[0_0_15px_rgba(156,163,175,0.08)]">
              v2.0.1
            </span>
          </h1>
          <p className="text-base text-neutral-300 max-w-2xl">
            导入字幕包，整理轨道、样式与片源信息。
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 md:gap-4">
          <button 
            className="px-5 py-3 glass-btn-ar rounded-xl text-sm text-neutral-300 hover:text-white flex items-center gap-2 cursor-pointer transition-all duration-300 group"
            onClick={() => setIsLibraryOpen(true)}
          >
            <Clock className="w-4 h-4 text-[#e5e7eb]" />
            历史存档字幕
            {libraryList.length > 0 && (
              <span className="bg-[#9ca3af]/12 text-[#e5e7eb] px-2 py-0.5 rounded-full text-xs ml-1 font-bold">{libraryList.length}</span>
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
            className="flex-1 flex flex-col gap-8 max-w-7xl mx-auto w-full items-center justify-start py-2 md:py-5"
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
            className="flex-1 desktop-panel-fit-hidden grid grid-cols-1 lg:grid-cols-3 gap-5 z-10 max-w-[1680px] mx-auto w-full relative"
          >
            {/* TMDB Panel */}
            <div className="lg:col-span-1 desktop-panel-fit-hidden min-w-0">
              <TmdbPanel />
            </div>
            {/* TaskList */}
            <div className="lg:col-span-2 flex flex-col desktop-panel-fit-visible min-w-0 relative">
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
                  <Clock className="w-5 h-5 text-[#e5e7eb]" />
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

                          <div className="min-w-0 flex-1 pl-2 border-l-2 border-transparent group-hover:border-[#9ca3af] transition-colors duration-300">
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
