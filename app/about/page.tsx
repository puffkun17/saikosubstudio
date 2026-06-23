import { FileLock2, ShieldCheck } from 'lucide-react';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="border-t border-white/[0.08] py-7 first:border-t-0 first:pt-0">
    <h2 className="text-base font-semibold text-white md:text-lg">{title}</h2>
    <div className="mt-3 space-y-3 text-sm leading-7 text-white/62">{children}</div>
  </section>
);

export default function AboutPage() {
  return (
    <main className="flex-1 overflow-y-auto bg-[#050507] px-5 py-8 md:px-10 md:py-12">
      <div className="mx-auto w-full max-w-3xl pb-10 pt-3">
        <div className="mt-3 flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#b9ddd8]/20 bg-[#b9ddd8]/10 text-[#b9ddd8]">
            <ShieldCheck className="h-5 w-5 stroke-[2.25]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-[#b9ddd8]">SAIKOSUBSTUDIO / POLICY</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">关于、隐私与版权</h1>
            <p className="mt-1 text-sm font-medium tracking-[0.04em] text-white/46">About, Privacy &amp; Copyright</p>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60 md:text-base">处理尽量留在你的设备上；片源资料检索保持最小必要范围。</p>
            <p className="mt-1 text-sm leading-6 text-white/38">Your files stay local whenever possible, and media lookup uses only the information it needs.</p>
          </div>
        </div>

        <div className="mt-10 rounded-2xl border border-white/[0.08] bg-white/[0.018] px-6 py-7 md:px-8">
          <Section title="本地文件处理 / Local files">
            <p>字幕、ZIP 字幕包与作为参照的本地媒体文件均由浏览器在当前设备读取和处理。SaikoSubStudio 不会将这些文件上传到本站服务器，也不会保存其中的字幕正文。</p>
            <p className="flex items-start gap-2 text-white/50"><FileLock2 className="mt-1 h-4 w-4 shrink-0 text-[#b9ddd8]" />导入限制仅用于避免异常文件过度占用你的浏览器内存，不会改变原始文件。</p>
          </Section>

          <Section title="影视资料与 TMDB / Metadata">
            <p>当你检索片名时，应用会将必要的检索词、媒体类型、年份或媒体 ID 发送至本站的 TMDB 代理，用于获取片名、海报、剧照和基础资料。请勿在片名输入框中填写个人信息。</p>
            <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
          </Section>

          <Section title="服务日志与分析 / Service logs">
            <p>部署平台可能处理维持服务稳定所需的基础请求信息，例如请求时间、错误状态和安全限流事件。本站不以字幕内容、文件名或本地路径作为产品分析数据。</p>
          </Section>

          <Section title="版权与使用责任 / Copyright">
            <p>请仅导入、编辑和导出你有权使用的字幕与媒体文件。SaikoSubStudio 是本地字幕整理工具，不提供字幕资源的托管、索引或分发服务；导出内容的使用、传播及版权责任由使用者自行确认。</p>
          </Section>
        </div>
      </div>
    </main>
  );
}
