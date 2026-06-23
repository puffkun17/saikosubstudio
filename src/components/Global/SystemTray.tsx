'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { FolderClock, MessageSquareText, ShieldCheck } from 'lucide-react';
import { useStudioStore } from '@/store/useStudioStore';

const STEP_LABEL: Record<number, string> = {
  1: '上传',
  2: '工作台',
  3: '放映厅',
};

const WORKFLOW_STEPS = [
  { id: 1, label: '上传' },
  { id: 2, label: '工作台' },
  { id: 3, label: '放映厅' },
];

const getDefaultScale = () => {
  if (typeof window === 'undefined') return 1.0;

  const savedScale = localStorage.getItem('nexus_site_scale');
  if (savedScale) {
    const parsed = parseFloat(savedScale);
    if (!isNaN(parsed) && parsed >= 1.0 && parsed <= 1.3) return parsed;
  }

  return 1.0;
};

// ─── Tray ─────────────────────────────────────────────────────────────────────

export const SystemTray = () => {
  const [time, setTime] = useState('');
  const [scale, setScale] = useState(getDefaultScale);
  const { workflowStep, restartSystem, tasks, processedSubs, libraryList, setLibraryOpen, setWorkflowStep } = useStudioStore();

  const hasUploadData = tasks.length > 0;
  const hasWorkbenchData = Boolean(processedSubs?.length);

  const handleStepClick = (targetStep: number) => {
    if (targetStep === workflowStep) return;

    if (targetStep === 1) {
      if (hasUploadData || hasWorkbenchData) {
        const confirmReset = window.confirm('返回上传入口会清空当前字幕任务。确认重新开始吗？');
        if (!confirmReset) return;
        restartSystem();
        return;
      }
      setWorkflowStep(1);
      return;
    }

    if (targetStep === 2) {
      if (!hasUploadData && !hasWorkbenchData) {
        window.alert('请先导入字幕文件，再进入工作台。');
        return;
      }
      setWorkflowStep(2);
      return;
    }

    if (targetStep === 3) {
      if (!hasWorkbenchData) {
        window.alert('请先完成字幕导入或合并，再进入放映厅预览。');
        return;
      }
      setWorkflowStep(3);
    }
  };

  useEffect(() => {
    localStorage.setItem('nexus_site_scale', String(scale));
    document.documentElement.style.setProperty('--site-scale', String(scale));
  }, [scale]);

  const cycleScale = () => {
    const nextScales: Record<number, number> = { 1.0: 1.1, 1.1: 1.2, 1.2: 1.3, 1.3: 1.0 };
    const next = nextScales[scale] || 1.0;
    setScale(next);
    localStorage.setItem('nexus_site_scale', String(next));
    document.documentElement.style.setProperty('--site-scale', String(next));
  };

  // L-2 fix: setInterval (1s) instead of rAF — no need to re-render 60×/s for a clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      setTime(`${hh}:${mm}:${ss}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <nav
      aria-label="System tray"
      className="fixed top-0 w-full z-50 h-[68px] flex items-center px-5 md:px-8
        bg-[#020203]/72 backdrop-blur-md border-b border-white/[0.07]
        justify-between transition-colors duration-300"
    >
      {/* ── Left: brand + nav ──────────────────────────────── */}
      <div className="flex items-center gap-4 text-[17px] tracking-tight min-w-0">
        <button
          type="button"
          onClick={() => handleStepClick(1)}
          className="flex items-center gap-2 transition-colors duration-150 shrink-0 font-semibold text-white/90 hover:text-white cursor-pointer"
          aria-label="返回上传入口"
        >
          <Image src="/favicon.svg" alt="" aria-hidden="true" width={20} height={20} className="h-5 w-5 rounded-[5px]" />
          <span>SubStudio</span>
        </button>

        <div className="hidden md:flex items-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.018] p-1">
          {WORKFLOW_STEPS.map(step => {
            const isActive = workflowStep === step.id;
            const disabled = (step.id === 2 && !hasUploadData && !hasWorkbenchData) || (step.id === 3 && !hasWorkbenchData);
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => handleStepClick(step.id)}
                  className={`px-3.5 py-2 rounded-lg text-[15px] font-medium transition-all cursor-pointer
                  ${isActive
                    ? 'bg-white/[0.10] text-white border border-white/[0.08]'
                    : disabled
                      ? 'text-white/28 cursor-not-allowed'
                      : 'text-white/58 hover:text-white hover:bg-white/[0.045]'}`}
                aria-current={isActive ? 'step' : undefined}
              >
                {step.label}
              </button>
            );
          })}
        </div>

        <span className="md:hidden text-white/45 font-medium truncate">
          {STEP_LABEL[workflowStep]}
        </span>
      </div>

      {/* ── Right: scale selector & clock ─────────────────────────────── */}
      <div className="flex items-center gap-2 shrink-0">
        {workflowStep === 1 && (
          <button
            type="button"
            onClick={() => setLibraryOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.018] px-3 text-sm font-medium text-white/62 transition-colors hover:border-[#b9ddd8]/35 hover:bg-[#b9ddd8]/[0.07] hover:text-white cursor-pointer"
            title="历史存档字幕"
          >
            <FolderClock className="h-5 w-5 stroke-[2.25] text-[#b9ddd8]" aria-hidden="true" />
            <span className="hidden lg:inline">历史存档</span>
            {libraryList.length > 0 && (
              <span className="hidden lg:inline-flex min-w-5 items-center justify-center rounded-md bg-[#b9ddd8]/12 px-1.5 py-0.5 text-xs font-semibold text-[#b9ddd8]">
                {libraryList.length}
              </span>
            )}
          </button>
        )}
        <Link
          href="/about"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.018] px-3 text-sm font-medium text-white/62 transition-colors hover:border-[#b9ddd8]/35 hover:bg-[#b9ddd8]/[0.07] hover:text-white"
          title="关于与隐私"
        >
          <ShieldCheck className="h-5 w-5 stroke-[2.25] text-[#b9ddd8]" aria-hidden="true" />
          <span className="hidden lg:inline">关于与隐私</span>
        </Link>
        <Link
          href="/feedback"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.018] px-3 text-sm font-medium text-white/62 transition-colors hover:border-[#b9ddd8]/35 hover:bg-[#b9ddd8]/[0.07] hover:text-white"
          title="提交反馈"
        >
          <MessageSquareText className="h-5 w-5 stroke-[2.25] text-[#b9ddd8]" aria-hidden="true" />
          <span className="hidden sm:inline">反馈</span>
        </Link>
        <button
          onClick={cycleScale}
          className="px-4 py-2 rounded-xl glass-btn-ar text-sm font-mono text-neutral-300 hover:text-neutral-100 cursor-pointer select-none flex items-center gap-2"
          title="调节网页整体缩放"
        >
          <span className="text-[13px] opacity-75 font-bold tracking-wide">A±</span>
          <span className="font-bold text-[#e5e7eb]" suppressHydrationWarning>{Math.round(scale * 100)}%</span>
        </button>
        <span
          className="text-sm font-mono text-white/60 tabular-nums"
          aria-label="Current time"
        >
          {time}
        </span>
      </div>
    </nav>
  );
};
