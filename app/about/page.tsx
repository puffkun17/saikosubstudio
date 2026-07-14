import { FileLock2, ShieldCheck } from 'lucide-react';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="border-t border-white/[0.08] py-7 first:border-t-0 first:pt-0">
    <h2 className="text-base font-semibold text-white md:text-lg">{title}</h2>
    <div className="mt-3 space-y-3 text-sm leading-7 text-white/62">{children}</div>
  </section>
);

export default function AboutPage() {
  return (
    <main className="flex-1 overflow-y-auto bg-[var(--v4-canvas)] px-5 py-8 md:px-10 md:py-12">
      <div className="mx-auto w-full max-w-3xl pb-10 pt-3">
        <div className="mt-3 flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#9aaad3]/20 bg-[#9aaad3]/10 text-[#9aaad3]">
            <ShieldCheck className="h-5 w-5 stroke-[2.25]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-[#9aaad3]">SAIKOSUBSTUDIO / POLICY</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">隐私与版权说明</h1>
            <p className="mt-1 text-sm font-medium tracking-[0.04em] text-white/46">Privacy &amp; Copyright Notice</p>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60 md:text-base">文件处理尽量在当前设备本地完成；片源资料检索遵循最小必要原则。</p>
            <p className="mt-1 text-sm leading-6 text-white/38">Files are processed locally whenever possible. Media lookup follows data minimization principles.</p>
          </div>
        </div>

        <div className="mt-10 rounded-2xl border border-white/[0.08] bg-white/[0.018] px-6 py-7 md:px-8">
          <Section title="本地文件处理 / Local files">
            <p>字幕、ZIP、7Z、RAR 字幕包与作为参照的本地媒体文件均由浏览器在当前设备读取和处理，不会上传到本站服务器。主动使用“历史存档”时，处理结果和样式会保存在当前浏览器的本地存储中，可随时删除；清除浏览器数据也会移除这些记录。</p>
            <p className="flex items-start gap-2 text-white/50"><FileLock2 className="mt-1 h-4 w-4 shrink-0 text-[#9aaad3]" />导入限制用于降低异常文件对浏览器内存的过度占用，不会改变原始文件。</p>
          </Section>

          <Section title="影视资料与 TMDB / Metadata">
            <p>进行片名检索时，应用会将必要的检索词、媒体类型、年份或媒体 ID 发送至本站的 TMDB 代理，用于获取片名、海报、剧照和基础资料。片名输入框不应填写个人信息。</p>
            <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
          </Section>

          <Section title="服务日志与分析 / Service logs">
            <p>部署平台可能处理维持服务稳定所需的基础请求信息，例如请求时间、错误状态和安全限流事件。本站不主动将字幕内容、文件名或本地路径发送为产品分析数据。</p>
          </Section>

          <Section title="版权与使用责任 / Copyright">
            <p>仅应导入、编辑和导出已获合法授权使用的字幕与媒体文件。SaikoSubStudio 是本地字幕整理工具，不提供字幕资源的托管、索引或分发服务；导出内容的使用、传播及相关版权责任由使用者自行确认并承担。</p>
          </Section>
        </div>
      </div>
    </main>
  );
}
