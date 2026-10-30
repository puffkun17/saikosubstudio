'use client';

import React, { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Check, FileType, Image as ImageIcon, Save, Trash2 } from 'lucide-react';
import { useStudioStore } from '@/store/useStudioStore';
import { extractStylesFromAss, type StyleSettings } from '@/utils/subtitleCore';
import { estimateStyleFromImageFile } from '@/utils/styleFromImage';
import { isEntryTuned, isFixedPreset, listStyleEntries, type StyleEntry, type StyleTemplateRecord } from '@/utils/styleLibrary';
import type { ExportPresetId } from '@/utils/exportPresets';
import { HDR_LEVELS_PROVISIONAL } from '@/utils/hdrPresets';
import { InfoHint } from '@/components/ui/InfoHint';

/** Which list entry is in effect, and whether the sliders moved away from it. */
export function useSelectedStyleEntry(
  templates: StyleTemplateRecord[], sourceStyle: Partial<StyleSettings> | null, activeId: string,
  base: StyleSettings, presetId: ExportPresetId, overrides: Partial<StyleSettings>,
): { entry: StyleEntry | null; tuned: boolean } {
  return useMemo(() => {
    const entries = listStyleEntries(templates, sourceStyle);
    let entry = entries.find((e) => e.id === activeId) ?? null;
    if (!entry || isFixedPreset(entry.presetId) !== isFixedPreset(presetId) || (isFixedPreset(presetId) && entry.presetId !== presetId)) {
      entry = isFixedPreset(presetId) ? entries.find((e) => e.id === presetId) ?? null : entry && !isFixedPreset(entry.presetId) ? entry : null;
    }
    return { entry, tuned: entry ? isEntryTuned(entry, base, presetId, overrides) : true };
  }, [templates, sourceStyle, activeId, base, presetId, overrides]);
}

/** 「样式」：一个列表 + 从文件获取 + 显示亮度。滑块微调在 StyleSidebar 里，叠加在选中项之上。 */
export const StyleLibrary: React.FC = () => {
  const s = useStudioStore(useShallow((state) => ({
    customStyle: state.customStyle,
    exportPresetId: state.exportPresetId,
    styleOverrides: state.styleOverrides,
    activePreset: state.activePreset,
    customTemplates: state.customTemplates,
    foundAssStyle: state.foundAssStyle,
    applyStyleEntry: state.applyStyleEntry,
    saveCustomTemplate: state.saveCustomTemplate,
    deleteCustomTemplate: state.deleteCustomTemplate,
    hdrEnabled: state.hdrEnabled,
    hdrLevel: state.hdrLevel,
    setHdr: state.setHdr,
  })));
  const entries = useMemo(() => listStyleEntries(s.customTemplates, s.foundAssStyle), [s.customTemplates, s.foundAssStyle]);
  const { entry: selected, tuned } = useSelectedStyleEntry(s.customTemplates, s.foundAssStyle, s.activePreset, s.customStyle, s.exportPresetId, s.styleOverrides);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const importFile = async (file: File) => {
    const isAss = /\.(ass|ssa)$/i.test(file.name);
    try {
      const mined = isAss ? extractStylesFromAss(await file.text()) : await estimateStyleFromImageFile(file);
      if (!mined) {
        setNote(isAss ? '这个文件里没有可用的 [V4+ Styles]。' : '没在截图下部找到字幕，换一张字幕清楚的截图。');
        return;
      }
      const patch = Object.fromEntries(Object.entries(mined).filter(([, v]) => v !== undefined)) as Partial<StyleSettings>;
      const base = file.name.replace(/\.[^.]+$/, '').slice(0, 24);
      s.saveCustomTemplate(isAss ? base : `截图 · ${base}`, { styles: patch, source: isAss ? 'ass' : 'image' });
      setNote(isAss
        ? `已加入列表并选中：字号 ${patch.zhFontSize ?? '—'}/${patch.enFontSize ?? '—'}，下边距 ${patch.marginV ?? '—'}。`
        : `已加入列表并选中（估计）：文字 ${patch.zhColor}、描边 ${patch.zhOutline}、字号约 ${patch.zhFontSize}、下边距约 ${patch.marginV}。请对照预览微调。`);
    } catch {
      setNote('读取失败，样式没有改动。');
    }
  };

  const save = () => {
    const n = name.trim();
    if (!n) return;
    s.saveCustomTemplate(n);
    setSaving(false);
    setName('');
  };


  return (
    <div className="flex flex-col gap-[var(--ds-gap-section)]" data-testid="style-library">
      <section className="flex flex-col gap-[var(--ds-gap-group)]" aria-label="样式">
        <div className="flex min-h-8 items-center justify-between gap-[var(--ds-gap-group)]">
          <h4 className="ds-label">样式</h4>
          <button
            type="button"
            className="ui-action ui-action--quiet min-h-8 px-[var(--ds-ctl-px-sm)] text-xs"
            onClick={() => { setName(`我的样式 ${s.customTemplates.filter((t) => (t.source ?? 'saved') === 'saved').length + 1}`); setSaving((v) => !v); }}
            data-testid="style-save"
          >
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            {tuned ? '另存微调' : '另存'}
          </button>
        </div>
        {saving && (
          <div className="flex gap-[var(--ds-gap-item)]">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setSaving(false); }}
              className="h-[var(--ds-ctl-h)] min-w-0 flex-1 rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-[var(--ds-ctl-px)] text-sm text-[var(--v4-text)] outline-none focus:border-[var(--v4-accent)]"
              aria-label="样式名称"
            />
            <button type="button" className="ui-action" onClick={save}>保存</button>
          </div>
        )}
        <div className="ds-style-list" role="radiogroup" aria-label="样式列表">
          {entries.map((e) => {
            const on = selected?.id === e.id;
            const removable = e.source !== 'fixed' && e.source !== 'source';
            return (
              <div key={e.id} className={`ds-style-row ${on ? 'ds-style-row--on' : ''}`}>
                <button type="button" role="radio" aria-checked={on} className="ds-style-row__main v4-focus-ring" onClick={() => s.applyStyleEntry(e.id)} data-style-entry={e.id}>
                  <span className="ds-style-row__swatch" aria-hidden="true" style={swatch(e, s.customStyle)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold leading-5">{e.name}{on && tuned ? <span className="ds-meta ml-1.5 font-normal">· 已微调</span> : null}</span>
                    {e.hint ? <span className="block truncate ds-meta !leading-4">{e.hint}</span> : null}
                  </span>
                  {on ? <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> : <span className="w-4 shrink-0" aria-hidden="true" />}
                </button>
                {removable && (
                  <button type="button" className="ds-style-row__del v4-focus-ring" aria-label={`删除样式「${e.name}」`} onClick={() => s.deleteCustomTemplate(e.id)}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-col gap-[var(--ds-gap-item)]">
          <div className="flex min-h-5 items-center justify-between gap-[var(--ds-gap-group)]">
            <span className="text-sm font-medium text-[var(--v4-text-muted)]">从文件获取</span>
            <InfoHint label="从文件获取说明" side="left">
              在本机读取，不上传。结果作为一项加入上面的列表。.ass/.ssa 读取 [V4+ Styles] 的字体、字号、颜色、描边色、边距；截图只能估计文字颜色、描边和位置。
            </InfoHint>
          </div>
          <div className="grid grid-cols-2 gap-[var(--ds-gap-item)]">
            <label className="ui-action ui-action--secondary justify-center cursor-pointer" data-testid="import-style-ass">
              <FileType className="h-4 w-4" aria-hidden="true" />
              ASS 文件
              <input type="file" accept=".ass,.ssa" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importFile(f); }} />
            </label>
            <label className="ui-action ui-action--secondary justify-center cursor-pointer" data-testid="import-style-image">
              <ImageIcon className="h-4 w-4" aria-hidden="true" />
              截图
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importFile(f); }} />
            </label>
          </div>
          {note && <p className="ds-meta" role="status" data-testid="import-style-note">{note}</p>}
        </div>
      </section>

      {/* 「另附 HDR 版」的总开关在导出面板；这里同名只读显示，预览跟随它压暗。 */}
      <section className="flex flex-col gap-[var(--ds-gap-group)]" aria-label="另附 HDR 版">
        <div className="flex min-h-8 items-center justify-between gap-[var(--ds-gap-group)]">
          <h4 className="ds-label">另附 HDR 版</h4>
          <InfoHint label="另附 HDR 版说明" side="left">
            HDR 屏幕上白字会刺眼。在导出面板勾选「另附 HDR 版」并选择档位后，预览按该档位压暗填充色，导出时另附一份 HDR 版。
          </InfoHint>
        </div>
        <button
          type="button"
          className="ds-select flex items-center justify-between gap-2"
          onClick={() => window.dispatchEvent(new CustomEvent('saiko:open-dock', { detail: 'export' }))}
          data-testid="style-hdr-link"
          title="在导出面板中更改"
        >
          <span className="truncate">{s.hdrEnabled ? `开 · ${HDR_LEVELS_PROVISIONAL[s.hdrLevel].label}（预览已按此显示）` : '关'}</span>
          <span className="ds-meta shrink-0">在导出中更改</span>
        </button>
      </section>
    </div>
  );
};

/** Small colour chip: the entry's fill on its outline colour. */
function swatch(e: StyleEntry, base: StyleSettings): React.CSSProperties {
  const fixed: Record<string, [string, string]> = { 'libass-ass': ['#FFFFFF', '#000000'], 'navy-outline': ['#FFFFFF', '#141B55'] };
  const [fill, line] = fixed[e.presetId] ?? [e.patch.zhColor ?? base.zhColor ?? '#FFFFFF', e.patch.zhOutline ?? base.zhOutline ?? '#000000'];
  return { background: fill, boxShadow: `inset 0 0 0 3px ${line}` };
}
