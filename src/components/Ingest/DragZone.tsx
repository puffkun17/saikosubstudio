'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useStudioStore, type Subfile } from '@/store/useStudioStore';
import { decodeBuffer, detectLanguageByContent, checkIsBilingual } from '@/utils/subtitleCore';
import JSZip from 'jszip';
import { UploadCloud, Folder, FileText, CheckCircle2, Archive, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

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

type IngestPhase = 'idle' | 'reading' | 'parsing' | 'binding' | 'metadata' | 'ready' | 'needs_review' | 'error';

const PHASE_STEPS: Array<{ id: IngestPhase; label: string }> = [
  { id: 'reading', label: '接收文件' },
  { id: 'parsing', label: '识别轨道' },
  { id: 'binding', label: '整理时间轴' },
  { id: 'metadata', label: '匹配片源' },
  { id: 'ready', label: '准备完成' },
];

const PHASE_COPY: Record<IngestPhase, string> = {
  idle: '拖入字幕包，建立字幕工作台',
  reading: '正在接收字幕包',
  parsing: '正在识别字幕轨',
  binding: '正在整理时间轴',
  metadata: '正在匹配片源信息',
  ready: '字幕工作台已准备完成',
  needs_review: '需要手动确认片源',
  error: '部分内容需要处理',
};

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
      note: extension === 'ass' ? '样式字幕轨' : '标准字幕轨',
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
      note: '字幕包',
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
      note: '请先解包后导入',
    };
  }
  return {
    file,
    name: file.name,
    extension: extension || 'unknown',
    kind: 'unsupported',
    label: extension ? extension.toUpperCase() : '未知',
    accepted: false,
    note: '已忽略非字幕资源',
  };
};

const describeTrack = (file: Subfile) => {
  if (file.isCommentary || file.lang === 'commentary') return '导评轨';
  if (file.isBilingual || file.lang === 'bilingual') return '双语轨';
  if (file.lang === 'zh-CN' || file.lang === 'zh-TW') return '主字幕轨';
  if (file.lang === 'en') return '副字幕轨';
  return '待确认轨';
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
  const [ingestPhase, setIngestPhase] = useState<IngestPhase>('idle');
  const [ingestMessage, setIngestMessage] = useState(PHASE_COPY.idle);
  const [resultChips, setResultChips] = useState<string[]>([]);
  const [preflightItems, setPreflightItems] = useState<PreflightItem[]>([]);
  const [trackSummaries, setTrackSummaries] = useState<TrackSummary[]>([]);

  const setPhase = (phase: IngestPhase, message = PHASE_COPY[phase]) => {
    setIngestPhase(phase);
    setIngestMessage(message);
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
        addLog(`字幕包内未检测到可用字幕：${zipFile.name}`, 'error');
      }
      return ignoredCount;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      addLog(`字幕包读取失败：${message}`, "error");
      return 0;
    }
  };

  const handleFilesProcess = async (filesList: File[]) => {
    const preflight = filesList.map(createPreflightItem);
    setPreflightItems(preflight);
    setTrackSummaries([]);
    setResultChips([]);

    const validItems = preflight.filter(item => item.accepted);
    const rejectedItems = preflight.filter(item => !item.accepted);

    if (rejectedItems.length > 0) {
      const archiveCount = rejectedItems.filter(item => item.kind === 'archive-unsupported').length;
      const unsupportedCount = rejectedItems.length - archiveCount;
      if (archiveCount > 0) {
        addLog(`有 ${archiveCount} 个压缩格式需先解包后导入`, 'error');
      }
      if (unsupportedCount > 0) {
        addLog(`已忽略 ${unsupportedCount} 个非字幕资源`, 'info');
      }
    }

    if (validItems.length === 0) {
      setPhase('error', '未检测到可用字幕');
      return;
    }

    // Show visual ingest scanning phase
    setIsParsing(true);
    setPhase('reading');
    setParsingFiles(preflight.map(item => ({
      name: item.name,
      size: item.file.size,
      status: item.accepted ? 'reading' : 'skipped',
      note: item.note,
    })));

    const detectedFiles: Subfile[] = [];
    const summaries: TrackSummary[] = [];
    let ignoredInZipCount = 0;

    setResultChips([`${filesList.length} 个文件`, `${validItems.length} 个可导入`]);
    await sleep(520);

    setPhase('parsing');
    await sleep(520);
    for (const item of validItems) {
      const file = item.file;
      if (item.kind === 'zip') {
        ignoredInZipCount += await processZipFile(file, detectedFiles, summaries);
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
          addLog(`字幕文件读取失败：${message}`, "error");
        }
      }
    }

    setTrackSummaries(summaries);

    if (detectedFiles.length > 0) {
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
      const sourceZipCount = preflight.filter(item => item.kind === 'zip').length;
      const chips = [
        `${detectedFiles.length} 条字幕轨`,
        assCount > 0 ? `${assCount} 条样式字幕轨` : '',
        srtCount > 0 ? `${srtCount} 条标准字幕轨` : '',
        bilingualCount > 0 ? `${bilingualCount} 条双语轨` : '',
        sourceZipCount > 0 ? `${sourceZipCount} 个字幕包` : '',
        ignoredInZipCount > 0 ? `已忽略 ${ignoredInZipCount} 个非字幕资源` : '',
      ].filter(Boolean);
      setResultChips(chips);

      setPhase('binding');
      await sleep(620);

      setPhase('metadata');
      let displayTitle = '影视数据';
      if (validItems[0]) {
        const guess = validItems[0].name.replace(/\.[^.]+$/, '').replace(/[._-]+/g, ' ').trim();
        if (guess.length > 2) {
          displayTitle = guess.length > 42 ? guess.slice(0, 40) + '…' : guess;
          setIngestMessage('正在匹配片源信息');
          await searchTmdb(guess, { silent: true }).catch(() => {});
        }
      }
      await sleep(820);

      setPhase('ready');
      setParsingFiles(preflight.map(item => ({
        name: item.name,
        size: item.file.size,
        status: item.accepted ? 'success' : 'skipped',
        note: item.note,
      })));
      setIngestMessage(displayTitle === '影视数据' ? '字幕工作台已准备完成' : `已关联片源：${displayTitle}`);
      setResultChips(prev => [...prev.slice(0, 5), displayTitle === '影视数据' ? '片源待确认' : '片源已关联']);
      await sleep(850);

      processFiles(detectedFiles);
      await sleep(90);
      try {
        const s = useStudioStore.getState();
        if (s.tmdbSuggestions && s.tmdbSuggestions.length > 0 && s.selectedTaskId) {
          await s.selectTmdbSuggestion(s.tmdbSuggestions[0], { silent: true }).catch(() => {});
        }
      } catch {}

      setIsParsing(false);
      addLog("已建立字幕工作台", "success");
    } else {
      setIsParsing(false);
      setPhase('error');
      addLog("未检测到可用字幕", "error");
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
    const activeStepIndex = Math.max(0, PHASE_STEPS.findIndex(step => step.id === ingestPhase));
    return (
      <div className="w-full max-w-5xl mx-auto relative flex flex-col items-center justify-center min-h-[520px] px-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#c5a46e_0%,transparent_72%)] opacity-[0.032] pointer-events-none -z-10" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#c5a46e]/[0.012] to-transparent pointer-events-none -z-10" />
        <ParticleCanvas mode="parsing" />

        <div className="relative z-10 w-full max-w-[860px] rounded-[28px] border border-white/[0.065] bg-black/35 backdrop-blur-xl overflow-hidden shadow-[0_28px_80px_rgba(0,0,0,0.45)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(197,164,110,0.1),transparent_58%)] pointer-events-none" />
          <div className="relative h-[300px] flex flex-col items-center justify-center overflow-hidden">
            <div className="absolute inset-x-10 top-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="absolute inset-x-10 bottom-8 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            <motion.div
              animate={{ y: ['-120%', '120%'], opacity: [0, 0.8, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute left-10 right-10 h-px bg-gradient-to-r from-transparent via-[#d8c39a] to-transparent shadow-[0_0_20px_rgba(197,164,110,0.38)]"
            />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
              className="absolute w-56 h-56 rounded-full border border-[#c5a46e]/16"
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
              className="absolute w-44 h-44 rounded-full border border-dashed border-white/12"
            />

            <div className="relative z-10 flex flex-col items-center text-center px-8">
              <div className="w-20 h-20 rounded-full border border-[#c5a46e]/25 bg-[#c5a46e]/[0.04] flex items-center justify-center shadow-[0_0_42px_rgba(197,164,110,0.14)] mb-6">
                <Sparkles className="w-8 h-8 text-[#d8c39a]" />
              </div>
              <motion.h3
                key={ingestMessage}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-lg md:text-xl font-bold text-white tracking-[0.08em]"
              >
                {ingestMessage}
              </motion.h3>
              <p className="mt-2 text-xs text-neutral-300">
                正在建立字幕工作台
              </p>
            </div>
          </div>

          <div className="relative border-t border-white/[0.06] px-5 py-4">
            <div className="grid grid-cols-5 gap-2">
              {PHASE_STEPS.map((step, index) => {
                const active = step.id === ingestPhase;
                const complete = activeStepIndex >= index || ingestPhase === 'ready';
                return (
                  <div key={step.id} className="flex flex-col gap-2 min-w-0">
                    <div className={`h-1 rounded-full transition-all duration-500 ${complete ? 'bg-[#c5a46e]/70 shadow-[0_0_10px_rgba(197,164,110,0.2)]' : 'bg-white/[0.08]'}`} />
                    <span className={`text-xs truncate text-center font-semibold ${active ? 'text-white' : complete ? 'text-[#d8c39a]/80' : 'text-white/45'}`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {(resultChips.length > 0 ? resultChips : parsingFiles.slice(0, 4).map(file => file.note || file.name)).map((chip, index) => (
                <motion.span
                  key={`${chip}-${index}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs text-neutral-200"
                >
                  {chip}
                </motion.span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="w-full flex flex-col items-center group/outer py-2 md:py-4"
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
            ? { scale: 1.006, boxShadow: 'inset 0 0 38px rgba(0,0,0,0.48), 0 0 54px rgba(197,164,110,0.11)' }
            : { scale: 1, boxShadow: 'inset 0 0 42px rgba(0,0,0,0.55), 0 18px 60px rgba(0,0,0,0.24)' }
        }
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        className="relative w-full max-w-[920px] h-[280px] mx-auto bg-white/[0.035] border border-white/[0.09] flex flex-col items-center justify-center cursor-pointer overflow-hidden select-none z-10 backdrop-blur-sm"
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
              <svg width="52" height="52" viewBox="0 0 52 52" fill="none" className="drop-shadow-[0_0_12px_rgba(197,164,110,0.45)]">
                {/* Clean outer ring */}
                <circle cx="26" cy="26" r="23" stroke="#c5a46e" strokeWidth="2" strokeOpacity="0.7" />
                {/* Inner bold film base */}
                <rect x="12" y="22" width="28" height="8" rx="1" stroke="#c5a46e" strokeWidth="1.5" strokeOpacity="0.9" fill="none" />
                {/* Subtitle lines (two clean tracks) */}
                <line x1="14" y1="19" x2="38" y2="19" stroke="#d8c39a" strokeWidth="1.2" strokeOpacity="0.85" />
                <line x1="14" y1="33" x2="38" y2="33" stroke="#d8c39a" strokeWidth="1.2" strokeOpacity="0.85" />
                {/* Small center marker for "lens" focus */}
                <circle cx="26" cy="26" r="3" fill="#c5a46e" fillOpacity="0.4" />
              </svg>
            </motion.div>
            <span className="text-sm tracking-wide text-[#d8c39a] font-semibold">松手导入</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 z-20 text-center">
            <div className="relative">
              <svg width="64" height="64" viewBox="0 0 56 56" fill="none" 
                className={`transition-all duration-300 ${isZoneActive ? 'text-[#d8c39a] drop-shadow-[0_0_14px_rgba(197,164,110,0.35)]' : 'text-neutral-200/90'}`}>
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
              <div className="text-xl font-semibold tracking-wide text-white">建立字幕工作台</div>
              <div className="text-sm text-neutral-200/85 tracking-wide mt-1">拖入字幕包，系统将整理字幕与影片信息</div>
            </div>

	            <div className="flex gap-3 text-sm font-mono tracking-wide text-neutral-200/80 mt-2">
	              <span>SRT</span><span className="text-white/20">·</span><span>ASS</span><span className="text-white/20">·</span><span>ZIP</span>
	            </div>
	          </div>
	        )}
	      </motion.div>

	      <div className="mt-4 w-full max-w-[920px] grid grid-cols-1 md:grid-cols-3 gap-3 px-4 z-20">
	        <div className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.012] px-4 py-3">
	          <FileText className="w-4 h-4 text-[#d8c39a] mt-0.5 shrink-0" />
	          <div className="min-w-0">
	            <div className="text-sm font-bold text-white/90">字幕轨</div>
	            <div className="text-xs text-neutral-300 leading-relaxed mt-0.5">识别标准轨、样式轨、双语轨与导评轨。</div>
	          </div>
	        </div>
	        <div className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.012] px-4 py-3">
	          <Archive className="w-4 h-4 text-[#d8c39a]/80 mt-0.5 shrink-0" />
	          <div className="min-w-0">
	            <div className="text-sm font-bold text-white/90">字幕包</div>
	            <div className="text-xs text-neutral-300 leading-relaxed mt-0.5">支持 ZIP 打包导入，并自动忽略非字幕资源。</div>
	          </div>
	        </div>
	        <div className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.012] px-4 py-3">
	          <Sparkles className="w-4 h-4 text-[#c5a46e] mt-0.5 shrink-0" />
	          <div className="min-w-0">
	            <div className="text-sm font-bold text-white/90">片源信息</div>
	            <div className="text-xs text-neutral-300 leading-relaxed mt-0.5">导入后自动补全影视资料与预览画面。</div>
	          </div>
	        </div>
	      </div>

	      {(preflightItems.length > 0 || trackSummaries.length > 0) && (
	        <div className="mt-4 w-full max-w-[920px] px-4 z-20">
	          <div className="rounded-2xl border border-white/[0.055] bg-black/30 overflow-hidden">
	            {preflightItems.length > 0 && (
	              <div className="p-3 border-b border-white/[0.045]">
	                <div className="text-xs font-semibold text-white/60 mb-2">导入概览</div>
	                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
	                  {preflightItems.slice(0, 6).map((item) => (
	                    <div key={`${item.name}-${item.file.size}`} className="flex items-center gap-2 text-xs min-w-0">
	                      <span className={`px-1.5 py-0.5 rounded font-semibold ${item.accepted ? 'bg-[#c5a46e]/10 text-[#d8c39a]' : 'bg-amber-500/10 text-amber-300'}`}>
	                        {item.label}
	                      </span>
	                      <span className="truncate text-white/70">{item.name}</span>
	                      <span className="text-white/50 truncate hidden sm:inline">{item.note}</span>
	                    </div>
	                  ))}
	                </div>
	              </div>
	            )}
	            {trackSummaries.length > 0 && (
	              <div className="p-3">
	                <div className="text-xs font-semibold text-white/60 mb-2">轨道识别</div>
	                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
	                  {trackSummaries.slice(0, 6).map((item) => (
	                    <div key={`${item.name}-${item.source}`} className="flex items-center gap-2 text-xs min-w-0">
	                      <CheckCircle2 className="w-3.5 h-3.5 text-[#d8c39a] shrink-0" />
	                      <span className="px-1.5 py-0.5 rounded bg-[#c5a46e]/10 text-[#d8c39a] font-semibold">{item.format}</span>
	                      <span className="text-white/70 truncate">{item.lang}</span>
	                      <span className="text-white/55 truncate">{item.name}</span>
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
          className="group w-full sm:w-auto px-9 py-3.5 rounded-2xl text-sm tracking-wide font-semibold cursor-pointer transition-all duration-200 
            bg-white/[0.022] hover:bg-[#c5a46e]/5 border border-white/[0.055] hover:border-[#c5a46e]/30 
            text-white/90 hover:text-white shadow-[0_2px_8px_rgba(0,0,0,0.35)] hover:shadow-[0_0_18px_rgba(197,164,110,0.08)] active:scale-[0.985]"
	        >
	          <UploadCloud className="inline-block w-4 h-4 mr-2 align-[-2px] text-[#d8c39a]" />
	          浏览文件 / ZIP
	        </button>
        
        <button 
          onClick={() => folderInputRef.current?.click()}
          className="group w-full sm:w-auto px-9 py-3.5 rounded-2xl text-sm tracking-wide font-semibold cursor-pointer transition-all duration-200 
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
