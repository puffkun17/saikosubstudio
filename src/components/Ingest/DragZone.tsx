'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useStudioStore, type Subfile } from '@/store/useStudioStore';
import { decodeBuffer, detectLanguageByContent, checkIsBilingual } from '@/utils/subtitleCore';
import JSZip from 'jszip';
import { UploadCloud, Folder, FileText, CheckCircle2, Archive, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
  angle: number;
  speed: number;
}

type ParseStatus = 'reading' | 'analyzing' | 'success' | 'warning' | 'skipped';

interface ParsingFileState {
  name: string;
  size: number;
  status: ParseStatus;
  note?: string;
}

type PreflightKind = 'subtitle' | 'zip' | 'archive-unsupported' | 'unsupported';

interface PreflightItem {
  file: File;
  name: string;
  extension: string;
  kind: PreflightKind;
  label: string;
  accepted: boolean;
  note: string;
}

interface TrackSummary {
  name: string;
  format: 'ASS' | 'SRT';
  lang: string;
  isBilingual: boolean;
  isCommentary: boolean;
  source: 'file' | 'zip';
}

const getExtension = (name: string) => {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : '';
};

const isSubtitleExtension = (ext: string) => ext === 'srt' || ext === 'ass';

const createPreflightItem = (file: File): PreflightItem => {
  const extension = getExtension(file.name);
  if (isSubtitleExtension(extension)) {
    return {
      file,
      name: file.name,
      extension,
      kind: 'subtitle',
      label: extension.toUpperCase(),
      accepted: true,
      note: extension === 'ass' ? '可读取 ASS 样式与字幕文本' : '可读取 SRT 时间轴与文本',
    };
  }
  if (extension === 'zip') {
    return {
      file,
      name: file.name,
      extension,
      kind: 'zip',
      label: 'ZIP',
      accepted: true,
      note: '将预扫描压缩包内的 ASS/SRT 字幕',
    };
  }
  if (extension === '7z' || extension === 'rar') {
    return {
      file,
      name: file.name,
      extension,
      kind: 'archive-unsupported',
      label: extension.toUpperCase(),
      accepted: false,
      note: '浏览器端暂不解压，请先解压或转成 ZIP',
    };
  }
  return {
    file,
    name: file.name,
    extension: extension || 'unknown',
    kind: 'unsupported',
    label: extension ? extension.toUpperCase() : '未知',
    accepted: false,
    note: '仅支持 ASS / SRT / ZIP',
  };
};

const describeTrack = (file: Subfile) => {
  if (file.isCommentary || file.lang === 'commentary') return '解说/导轨';
  if (file.isBilingual || file.lang === 'bilingual') return '已有双语';
  if (file.lang === 'zh-CN') return '简体中文单语';
  if (file.lang === 'zh-TW') return '繁体中文单语';
  if (file.lang === 'en') return '英文单语';
  return '未知语种';
};

const ParticleCanvas: React.FC<{ mode: 'idle' | 'hover' | 'dragging' | 'parsing' }> = ({ mode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = canvas.offsetHeight;

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    
    window.addEventListener('resize', handleResize);

    // Initialize particles
    const particleCount = mode === 'parsing' ? 60 : 35;
    const particles: Particle[] = [];
    
    const createParticle = (isInitial = false): Particle => {
      const pSize = Math.random() * 2.2 + 0.8;
      let px = Math.random() * width;
      let py = Math.random() * height;
      
      if (!isInitial && (mode === 'hover' || mode === 'dragging' || mode === 'parsing')) {
        // Spawn at outer border of canvas
        const side = Math.floor(Math.random() * 4);
        if (side === 0) { px = 0; py = Math.random() * height; } // left
        else if (side === 1) { px = width; py = Math.random() * height; } // right
        else if (side === 2) { px = Math.random() * width; py = 0; } // top
        else { px = Math.random() * width; py = height; } // bottom
      }
      
      let color = 'rgba(255, 255, 255, ';
      if (mode === 'hover' || mode === 'parsing') {
        color = 'rgba(168, 85, 247, '; // Neon Purple
      } else if (mode === 'dragging') {
        color = 'rgba(16, 185, 129, '; // Neon Emerald
      }

      return {
        x: px,
        y: py,
        vx: (Math.random() - 0.5) * (mode === 'parsing' ? 1.5 : 0.6),
        vy: (Math.random() - 0.5) * (mode === 'parsing' ? 1.5 : 0.6),
        size: pSize,
        alpha: Math.random() * 0.4 + 0.15,
        color,
        angle: Math.random() * Math.PI * 2,
        speed: Math.random() * 1.2 + 0.8,
      };
    };

    for (let i = 0; i < particleCount; i++) {
      particles.push(createParticle(true));
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (mode === 'idle') {
          // Slow random drift
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;
        } else if (mode === 'hover' || mode === 'dragging') {
          // Gravitational pull to center
          const dx = cx - p.x;
          const dy = cy - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 25) {
            particles[i] = createParticle(false);
            continue;
          }

          const force = 0.03 + (mode === 'dragging' ? 0.03 : 0.015);
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;

          p.vx *= 0.94;
          p.vy *= 0.94;

          p.x += p.vx;
          p.y += p.vy;
        } else if (mode === 'parsing') {
          // Spiral inwards
          const dx = p.x - cx;
          const dy = p.y - cy;
          let dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 15) {
            particles[i] = createParticle(false);
            continue;
          }

          let angle = Math.atan2(dy, dx);
          dist -= p.speed * 1.8;
          angle += 0.06;

          p.x = cx + Math.cos(angle) * dist;
          p.y = cy + Math.sin(angle) * dist;
          
          p.alpha = Math.min(0.7, dist / (width / 2.5));
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color + p.alpha + ')';
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [mode]);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 w-full h-full pointer-events-none z-0" 
    />
  );
};

export const DragZone: React.FC = () => {
  const { isDragging, setIsDragging, processFiles, addLog, searchTmdb } = useStudioStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  // Parsing states
  const [isParsing, setIsParsing] = useState(false);
  const [parsingFiles, setParsingFiles] = useState<ParsingFileState[]>([]);
  const [isZoneActive, setIsZoneActive] = useState(false);
  const [scanningLogs, setScanningLogs] = useState<string[]>([]); // for extended cool scanning log with scrolling info prompts
  const [currentHoloInfo, setCurrentHoloInfo] = useState<string>(""); // for unified Chinese info projected on the central animation
  const [preflightItems, setPreflightItems] = useState<PreflightItem[]>([]);
  const [trackSummaries, setTrackSummaries] = useState<TrackSummary[]>([]);

  const appendScanLog = (msg: string) => {
    setScanningLogs(prev => {
      const next = [...prev, msg];
      return next.length > 7 ? next.slice(-7) : next; // keep recent for scrolling effect
    });
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

  const processZipFile = async (zipFile: File, detectedFiles: Subfile[], summaries: TrackSummary[]) => {
    try {
      const zip = await JSZip.loadAsync(zipFile);
      const promises: Promise<void>[] = [];
      let ignoredCount = 0;

      zip.forEach((relativePath, zipEntry) => {
        const ext = getExtension(zipEntry.name);
        if (!zipEntry.dir && isSubtitleExtension(ext)) {
          const promise = zipEntry.async('arraybuffer').then((buffer) => {
            const decoded = decodeBuffer(buffer);
            const isBilingual = checkIsBilingual(decoded.text);
            const lang = isBilingual ? 'bilingual' : detectLanguageByContent(decoded.text);
            const subfile: Subfile = {
              id: `zip_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,
              name: zipEntry.name.split('/').pop() || zipEntry.name,
              text: decoded.text,
              lang,
              isBilingual,
              isCommentary: /(commentary|comment|director|解说|导轨)/i.test(zipEntry.name),
              size: decoded.text.length
            };
            detectedFiles.push(subfile);
            summaries.push({
              name: subfile.name,
              format: ext === 'ass' ? 'ASS' : 'SRT',
              lang: describeTrack(subfile),
              isBilingual,
              isCommentary: subfile.isCommentary,
              source: 'zip',
            });
          });
          promises.push(promise);
        } else if (!zipEntry.dir) {
          ignoredCount += 1;
        }
      });

      await Promise.all(promises);
      if (promises.length === 0) {
        addLog(`ZIP 内未发现 ASS/SRT 字幕: ${zipFile.name}`, 'error');
      } else if (ignoredCount > 0) {
        addLog(`ZIP 已读取 ${promises.length} 条字幕，忽略 ${ignoredCount} 个非字幕文件`, 'info');
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      addLog(`解压 ZIP ${zipFile.name} 失败: ${message}`, "error");
    }
  };

  const handleFilesProcess = async (filesList: File[]) => {
    const preflight = filesList.map(createPreflightItem);
    setPreflightItems(preflight);
    setTrackSummaries([]);

    const validItems = preflight.filter(item => item.accepted);
    const rejectedItems = preflight.filter(item => !item.accepted);

    if (rejectedItems.length > 0) {
      const archiveCount = rejectedItems.filter(item => item.kind === 'archive-unsupported').length;
      const unsupportedCount = rejectedItems.length - archiveCount;
      if (archiveCount > 0) {
        addLog(`检测到 ${archiveCount} 个 RAR/7Z 压缩包：浏览器端暂不支持直接解压`, 'error');
      }
      if (unsupportedCount > 0) {
        addLog(`已忽略 ${unsupportedCount} 个不支持格式文件`, 'error');
      }
    }

    if (validItems.length === 0) {
      setScanningLogs([]);
      setCurrentHoloInfo('请上传 ASS / SRT / ZIP 字幕文件');
      return;
    }

    // Show visual ingest scanning phase
    setIsParsing(true);
    setParsingFiles(preflight.map(item => ({
      name: item.name,
      size: item.file.size,
      status: item.accepted ? 'reading' : 'skipped',
      note: item.note,
    })));
    setScanningLogs([]);

    const detectedFiles: Subfile[] = [];
    const summaries: TrackSummary[] = [];

    // Extended scanning phases to give backend API time and create cool UX with scrolling info
    appendScanLog(`PRECHECK COMPLETE: ${validItems.length} accepted / ${rejectedItems.length} skipped`);
    await sleep(450);

    appendScanLog('DETECTING FILE STRUCTURE...');
    await sleep(550);

    for (const item of validItems) {
      const file = item.file;
      if (item.kind === 'zip') {
        appendScanLog(`UNPACKING ZIP: ${file.name}`);
        await processZipFile(file, detectedFiles, summaries);
      } else {
        try {
          const text = await readAndDecodeFile(file);
          const isBilingual = checkIsBilingual(text);
          const lang = isBilingual ? 'bilingual' : detectLanguageByContent(text);
          const ext = getExtension(file.name);
          const subfile: Subfile = {
            id: `file_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,
            name: file.name,
            text,
            lang,
            isBilingual,
            isCommentary: /(commentary|comment|director|解说|导轨)/i.test(file.name),
            size: text.length
          };
          detectedFiles.push(subfile);
          summaries.push({
            name: file.name,
            format: ext === 'ass' ? 'ASS' : 'SRT',
            lang: describeTrack(subfile),
            isBilingual,
            isCommentary: subfile.isCommentary,
            source: 'file',
          });
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e);
          addLog(`读取文件 ${file.name} 失败: ${message}`, "error");
        }
      }
    }

    setTrackSummaries(summaries);

    if (detectedFiles.length > 0) {
      appendScanLog('ANALYZING SUBTITLE TRACKS...');
      setParsingFiles(preflight.map(item => ({
        name: item.name,
        size: item.file.size,
        status: item.accepted ? 'analyzing' : 'skipped',
        note: item.note,
      })));
      await sleep(650);

      const bilingualCount = summaries.filter(item => item.isBilingual).length;
      const assCount = summaries.filter(item => item.format === 'ASS').length;
      const srtCount = summaries.filter(item => item.format === 'SRT').length;
      appendScanLog(`TRACK SUMMARY: ${assCount} ASS / ${srtCount} SRT / ${bilingualCount} bilingual`);

      appendScanLog('QUERYING CLOUD METADATA (TMDB)...');
      let displayTitle = '影视数据';
      if (validItems[0]) {
        const guess = validItems[0].name.replace(/\.[^.]+$/, '').replace(/[._-]+/g, ' ').trim();
        if (guess.length > 2) {
          displayTitle = guess.length > 28 ? guess.slice(0, 26) + '…' : guess;
          await searchTmdb(guess).catch(() => {});
        }
      }
      setCurrentHoloInfo(`正在获取 ${displayTitle} 详细信息...`);
      await sleep(650);

      appendScanLog('SYNCING DUAL-TRACK DATA...');
      await sleep(550);

      appendScanLog('RENDERING CINEMATIC PREVIEW...');
      setParsingFiles(preflight.map(item => ({
        name: item.name,
        size: item.file.size,
        status: item.accepted ? 'success' : 'skipped',
        note: item.note,
      })));
      await sleep(450);

      appendScanLog('FINALIZING INGEST...');
      setCurrentHoloInfo(`✓ 成功绑定影视数据: ${displayTitle}`);
      await sleep(300);

      processFiles(detectedFiles);
      await sleep(90);
      try {
        const s = useStudioStore.getState();
        if (s.tmdbSuggestions && s.tmdbSuggestions.length > 0 && s.selectedTaskId) {
          await s.selectTmdbSuggestion(s.tmdbSuggestions[0]).catch(() => {});
        }
      } catch {}

      setIsParsing(false);
      setScanningLogs([]);
    } else {
      setIsParsing(false);
      setScanningLogs([]);
      addLog("未在选中的文件或文件夹中检测到任何有效字幕！", "error");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    
    const filesArray: File[] = [];
    if (e.dataTransfer.items) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) filesArray.push(file);
        }
      }
    } else {
      const filesList = e.dataTransfer.files;
      for (let i = 0; i < filesList.length; i++) {
        filesArray.push(filesList[i]);
      }
    }
    
    if (filesArray.length > 0) {
      await handleFilesProcess(filesArray);
    }
  };

  if (isParsing) {
    return (
      <div className="w-full max-w-5xl mx-auto relative flex flex-col items-center justify-center min-h-[520px]">
        {/* Unified holographic interface background for consistent visual feel */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#a855f7_0%,transparent_70%)] opacity-[0.03] pointer-events-none -z-10" />
        <div className="absolute inset-0 bg-gradient-to-b from-violet-950/[0.015] to-transparent pointer-events-none -z-10" />

        <ParticleCanvas mode="parsing" />

        {/* Unified advanced holographic projector (结合扫描动画和信息提示的统一全息界面):
            参考高端设计如科幻全息投影 (Blade Runner, modern cyberpunk UIs) 和电影放映机。
            使用分层独立动画、volumetric 光效、几何精确、数据流元素，提供 sophisticated 感受。
            信息提示 (中文操作 + 英文扫描 + 日志) 整合为 holographic overlays 和 console, 位置围绕核心视觉, 形成 cohesive "投影系统"。
            无硬边界, 用 subtle film elements 和 glow 提供感知。
        */}
        <div className="relative z-10 w-80 h-80 flex items-center justify-center mb-4">
          {/* Outer holo field - volumetric glow for depth */}
          <div className="absolute inset-0 bg-[radial-gradient(circle,#a855f7_10%,transparent_70%)] opacity-20 blur-2xl" />

          {/* Layer 1: Energy ring - slow rotate for foundation */}
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 border-2 border-violet-500/30 rounded-full"
          />

          {/* Layer 2: Data orbit ring - faster, dashed for scan feel */}
          <motion.div 
            animate={{ rotate: -360 }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            className="absolute inset-4 border border-dashed border-violet-400/50 rounded-full"
          />

          {/* Layer 3: Geometric precision accent - square for advanced contrast (Bauhaus + holo) */}
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute inset-8 border border-violet-500/20 rounded-lg"
          />

          {/* Core projector lens with advanced icon */}
          <div className="relative z-10 w-48 h-48 rounded-full bg-gradient-to-br from-violet-400/20 via-transparent to-emerald-400/10 flex items-center justify-center shadow-[0_0_80px_rgba(168,85,247,0.4)] border border-violet-500/30">
            {/* Premium icon - advanced holographic film lens (not simple cloud):
                结合 film projector + subtitle waveform + data lens, 使用 gradients 和 layers for depth.
                参考高端设计: 精确几何 + 光效 + 数据可视化。
            */}
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="text-violet-400">
              <defs>
                <linearGradient id="holoGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="#a855f7" stop-opacity="0.1" />
                  <stop offset="100%" stop-color="#a855f7" stop-opacity="0.4" />
                </linearGradient>
              </defs>
              {/* Outer holo ring */}
              <circle cx="40" cy="40" r="36" fill="none" stroke="#a855f7" stroke-width="1.5" opacity="0.4" />
              {/* Film base (projector feel) */}
              <rect x="12" y="28" width="56" height="24" rx="3" fill="none" stroke="#a855f7" stroke-width="2" />
              {/* Subtitle tracks (waveform lines) */}
              <path d="M16 24 Q24 20 32 24 Q40 28 48 24 Q56 20 64 24" stroke="#10b981" stroke-width="1.5" fill="none" />
              <path d="M16 56 Q24 60 32 56 Q40 52 48 56 Q56 60 64 56" stroke="#10b981" stroke-width="1.5" fill="none" />
              {/* Central data lens with focus */}
              <circle cx="40" cy="40" r="12" fill="url(#holoGrad)" stroke="#a855f7" stroke-width="1" />
              <circle cx="40" cy="40" r="5" fill="#a855f7" fill-opacity="0.3" />
              {/* Light rays from "projector" */}
              <line x1="40" y1="10" x2="30" y2="28" stroke="#a855f7" stroke-width="1" opacity="0.5" />
              <line x1="40" y1="10" x2="50" y2="28" stroke="#a855f7" stroke-width="1" opacity="0.5" />
            </svg>
          </div>

          {/* Advanced scan beam - volumetric with better integration */}
          <motion.div 
            animate={{ y: [-30, 30, -30], opacity: [0.4, 0.9, 0.4] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_20px_rgba(16,185,129,0.7)] pointer-events-none"
          />

          {/* Unified Chinese info projected on the holo core for combined animation + prompt (解决分开的 top info 和 central 动画) */}
          {currentHoloInfo && (
            <motion.div 
              className="absolute top-[32%] left-1/2 -translate-x-1/2 text-center text-[10px] font-mono text-emerald-400 tracking-[0.5px] drop-shadow-[0_0_6px_rgba(16,185,129,0.5)] z-20 max-w-[180px] leading-tight"
              initial={{ opacity: 0, scale: 0.85, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
            >
              {currentHoloInfo}
            </motion.div>
          )}
        </div>

        {/* Unified info display - combined animation + Chinese prompts in one holographic interface for consistent visual/UX */}
        <div className="relative z-20 w-full max-w-lg text-center -mt-2">
          {/* Title as holo projection - integrated with the core visual */}
          <div className="mb-3">
            <h3 className="text-xl md:text-2xl font-bold text-white tracking-[3px] font-mono uppercase flex items-center justify-center gap-2 drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]">
              HOLOGRAPHIC SCANNING
              <span className="flex gap-1 ml-1">
                <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0 }} className="w-1.5 h-1.5 bg-violet-400 rounded-full" />
                <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.25 }} className="w-1.5 h-1.5 bg-violet-400 rounded-full" />
                <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.5 }} className="w-1.5 h-1.5 bg-violet-400 rounded-full" />
              </span>
            </h3>
            <p className="text-xs text-neutral-400 mt-1 font-mono tracking-[1.5px] uppercase">
              indexing subtitle sync structures
            </p>
          </div>

          {/* File status as integrated holo readout */}
          <div className="flex flex-col gap-1.5 max-h-[90px] overflow-y-auto mb-3 text-xs font-mono">
            <AnimatePresence>
              {parsingFiles.map((pf, idx) => (
                <motion.div 
                  key={idx} 
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="flex justify-between items-center px-3 py-1 bg-white/[0.015] border border-white/[0.03] rounded text-white/80"
                >
                  <span className="truncate pr-2">{pf.name}</span>
	                  <span className="font-bold tracking-wider text-[10px] text-white/60">
	                    {pf.status === 'reading' && 'READING'}
	                    {pf.status === 'analyzing' && 'ANALYZING'}
	                    {pf.status === 'success' && 'READY'}
	                    {pf.status === 'warning' && 'CHECK'}
	                    {pf.status === 'skipped' && 'SKIPPED'}
	                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Unified live scan log - now part of the central holographic experience */}
          <div className="w-full">
            <div className="text-[9px] font-mono tracking-[1.5px] text-emerald-400/60 mb-1 text-left pl-1">LIVE SCAN LOG</div>
            <div className="h-28 overflow-y-auto border border-white/10 bg-black/60 rounded-xl p-2.5 text-xs font-mono text-emerald-400/90 flex flex-col gap-y-px shadow-inner">
              <AnimatePresence>
                {scanningLogs.map((log, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="leading-tight truncate"
                  >
                    &gt; {log}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="w-full flex flex-col items-center group/outer py-6"
      onMouseEnter={() => setIsZoneActive(true)}
      onMouseLeave={() => setIsZoneActive(false)}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Borderless cinematic screen area（无边界但可感知的字幕放映区域）:
          Large open "projection frame" without hard circular border.
          Left/right film-strip perforations give clear perception of the drop zone.
          Very subtle inner lighting and top highlight make the screen feel "lit" and special
          without boxing the content. Perfect for subtitle/film theme.
      */}
      {/* Left film perforation strip（左侧胶片齿孔） - perceptible reel edge */}
      <div className="absolute left-0 top-0 bottom-0 w-5 z-30 pointer-events-none flex flex-col justify-around py-3">
        {Array.from({ length: 11 }).map((_, i) => (
          <div key={i} className="mx-auto w-2.5 h-[5px] bg-black/80 rounded-[1px]" />
        ))}
      </div>

      {/* Right film perforation strip */}
      <div className="absolute right-0 top-0 bottom-0 w-5 z-30 pointer-events-none flex flex-col justify-around py-3">
        {Array.from({ length: 11 }).map((_, i) => (
          <div key={i} className="mx-auto w-2.5 h-[5px] bg-black/80 rounded-[1px]" />
        ))}
      </div>

      {/* Main borderless screen - the perceptible drop target */}
      <motion.div 
        onClick={() => fileInputRef.current?.click()}
        animate={isDragging 
          ? { scale: 0.985, boxShadow: 'inset 0 0 90px rgba(0,0,0,0.95)' } 
          : isZoneActive
            ? { scale: 1.008, boxShadow: 'inset 0 0 70px rgba(0,0,0,0.85), 0 0 60px rgba(168,85,247,0.08)' }
            : { scale: 1, boxShadow: 'inset 0 0 80px rgba(0,0,0,0.9)' }
        }
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        className="relative w-full max-w-[920px] h-[310px] mx-auto bg-[#020203] flex flex-col items-center justify-center cursor-pointer overflow-hidden select-none z-10"
      >
        <ParticleCanvas mode={isDragging ? 'dragging' : (isZoneActive ? 'hover' : 'idle')} />

        {/* Very subtle screen highlight for user perception without hard border */}
        <div className="absolute inset-x-8 top-5 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
        <div className="absolute inset-x-8 bottom-5 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />

        {/* 
          Custom cinematic Ingest Lens icon (no generic AI cloud)
          - aperture（光圈）: 多叶片结构，模拟真实相机/投影机镜头，增加电影感。
          - dual-track waveform（双轨波形）: 两条波浪线代表双语字幕（中英轨），这是本工具的核心身份。
          这个 SVG 比 <UploadCloud> 更有领域特征（domain-specific），避免 AI 模板感。
        */}
        {isDragging ? (
          <div className="flex flex-col items-center gap-2 z-20">
            <motion.div
              animate={{ y: [-2, 2, -2] }}
              transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
            >
              <svg width="52" height="52" viewBox="0 0 52 52" fill="none" className="drop-shadow-[0_0_14px_rgba(16,185,129,0.7)]">
                {/* Clean outer ring */}
                <circle cx="26" cy="26" r="23" stroke="#10b981" strokeWidth="2" strokeOpacity="0.7" />
                {/* Inner bold film base */}
                <rect x="12" y="22" width="28" height="8" rx="1" stroke="#10b981" strokeWidth="1.5" strokeOpacity="0.9" fill="none" />
                {/* Subtitle lines (two clean tracks) */}
                <line x1="14" y1="19" x2="38" y2="19" stroke="#34d399" strokeWidth="1.2" strokeOpacity="0.85" />
                <line x1="14" y1="33" x2="38" y2="33" stroke="#34d399" strokeWidth="1.2" strokeOpacity="0.85" />
                {/* Small center marker for "lens" focus */}
                <circle cx="26" cy="26" r="3" fill="#10b981" fillOpacity="0.4" />
              </svg>
            </motion.div>
            <span className="text-xs font-mono tracking-[0.2em] text-emerald-400 font-semibold">松手投射</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 z-20 text-center">
            <div className="relative">
              <svg width="64" height="64" viewBox="0 0 56 56" fill="none" 
                className={`transition-all duration-300 ${isZoneActive ? 'text-violet-400 drop-shadow-[0_0_18px_rgba(168,85,247,0.65)]' : 'text-neutral-400/70'}`}>
                {/* Clean outer ring */}
                <circle cx="28" cy="28" r="25" stroke="currentColor" strokeWidth="1.8" strokeOpacity="0.6" />
                {/* Bold film base (horizontal rectangle for reel feel) */}
                <rect x="10" y="22" width="36" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" strokeOpacity="0.85" fill="none" />
                {/* Two clean subtitle track lines */}
                <line x1="12" y1="18" x2="44" y2="18" stroke="currentColor" strokeWidth="1.4" strokeOpacity="0.9" />
                <line x1="12" y1="38" x2="44" y2="38" stroke="currentColor" strokeWidth="1.4" strokeOpacity="0.9" />
                {/* Subtle center focus dot */}
                <circle cx="28" cy="28" r="4" fill="currentColor" fillOpacity="0.25" />
              </svg>
            </div>

            <div>
              <div className="text-lg font-mono font-semibold tracking-[2px] text-white/95">字幕画框</div>
              <div className="text-xs text-neutral-400 tracking-wide mt-1">拖入文件投射到画框</div>
            </div>

	            <div className="flex gap-3 text-xs font-mono tracking-[1px] text-neutral-400 mt-2">
	              <span>SRT</span><span className="text-white/20">·</span><span>ASS</span><span className="text-white/20">·</span><span>ZIP</span>
	            </div>
	          </div>
	        )}
	      </motion.div>

	      <div className="mt-5 w-full max-w-[920px] grid grid-cols-1 md:grid-cols-3 gap-3 px-4 z-20">
	        <div className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.012] px-4 py-3">
	          <FileText className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
	          <div className="min-w-0">
	            <div className="text-xs font-bold text-white/80">字幕文件</div>
	            <div className="text-[11px] text-neutral-500 leading-relaxed mt-0.5">自动判断 ASS / SRT、单语、已有双语、解说导轨。</div>
	          </div>
	        </div>
	        <div className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.012] px-4 py-3">
	          <Archive className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
	          <div className="min-w-0">
	            <div className="text-xs font-bold text-white/80">ZIP 预扫描</div>
	            <div className="text-[11px] text-neutral-500 leading-relaxed mt-0.5">读取压缩包内的 ASS/SRT，忽略图片、文本和其他资源。</div>
	          </div>
	        </div>
	        <div className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.012] px-4 py-3">
	          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
	          <div className="min-w-0">
	            <div className="text-xs font-bold text-white/80">RAR / 7Z</div>
	            <div className="text-[11px] text-neutral-500 leading-relaxed mt-0.5">浏览器端不直接解压，请先解压或转成 ZIP。</div>
	          </div>
	        </div>
	      </div>

	      {(preflightItems.length > 0 || trackSummaries.length > 0) && (
	        <div className="mt-4 w-full max-w-[920px] px-4 z-20">
	          <div className="rounded-2xl border border-white/[0.055] bg-black/30 overflow-hidden">
	            {preflightItems.length > 0 && (
	              <div className="p-3 border-b border-white/[0.045]">
	                <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/35 mb-2">上传预检</div>
	                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
	                  {preflightItems.slice(0, 6).map((item) => (
	                    <div key={`${item.name}-${item.file.size}`} className="flex items-center gap-2 text-xs min-w-0">
	                      <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${item.accepted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
	                        {item.label}
	                      </span>
	                      <span className="truncate text-white/70">{item.name}</span>
	                      <span className="text-white/30 truncate hidden sm:inline">{item.note}</span>
	                    </div>
	                  ))}
	                </div>
	              </div>
	            )}
	            {trackSummaries.length > 0 && (
	              <div className="p-3">
	                <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/35 mb-2">轨道识别</div>
	                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
	                  {trackSummaries.slice(0, 6).map((item) => (
	                    <div key={`${item.name}-${item.source}`} className="flex items-center gap-2 text-xs min-w-0">
	                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
	                      <span className="px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300 font-mono text-[10px]">{item.format}</span>
	                      <span className="text-white/70 truncate">{item.lang}</span>
	                      <span className="text-white/30 truncate">{item.name}</span>
	                    </div>
	                  ))}
	                </div>
	              </div>
	            )}
	          </div>
	        </div>
	      )}

	      {/* Refined action buttons — stronger cinematic glass, better hierarchy and breathing */}
	      <div className="flex flex-col sm:flex-row gap-4 justify-center mt-9 w-full sm:w-auto px-4 z-20">
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="group w-full sm:w-auto px-9 py-3.5 rounded-2xl text-sm font-mono uppercase tracking-[0.12em] font-semibold cursor-pointer transition-all duration-200 
            bg-white/[0.022] hover:bg-violet-500/5 border border-white/[0.055] hover:border-violet-500/30 
            text-white/90 hover:text-white shadow-[0_2px_8px_rgba(0,0,0,0.35)] hover:shadow-[0_0_18px_rgba(168,85,247,0.12)] active:scale-[0.985]"
	        >
	          <UploadCloud className="inline-block w-4 h-4 mr-2 align-[-2px] text-violet-400" />
	          浏览文件 / ZIP
	        </button>
        
        <button 
          onClick={() => folderInputRef.current?.click()}
          className="group w-full sm:w-auto px-9 py-3.5 rounded-2xl text-sm font-mono uppercase tracking-[0.12em] font-semibold cursor-pointer transition-all duration-200 
            bg-white/[0.01] hover:bg-white/[0.035] border border-white/[0.04] hover:border-white/15 
            text-neutral-400 hover:text-neutral-100 shadow-[0_2px_8px_rgba(0,0,0,0.35)] hover:shadow-[0_0_14px_rgba(255,255,255,0.06)] active:scale-[0.985]"
	        >
	          <Folder className="inline-block w-4 h-4 mr-2 align-[-2px] text-neutral-300" />
	          扫描文件夹
	        </button>
      </div>

      <input 
        ref={fileInputRef} 
	        type="file" 
	        multiple 
	        accept=".srt,.ass,.zip,.rar,.7z" 
        className="hidden" 
        onChange={(e) => handleFilesProcess(Array.from(e.target.files || []))} 
      />
	      <input 
	        ref={folderInputRef} 
	        type="file" 
	        {...({ webkitdirectory: 'true', directory: 'true' } as React.InputHTMLAttributes<HTMLInputElement>)}
	        className="hidden" 
	        onChange={(e) => handleFilesProcess(Array.from(e.target.files || []))} 
	      />
    </div>
  );
};
