import Link from 'next/link';
import { FileLock2, MessageSquareText, ShieldCheck } from 'lucide-react';

const Section = ({
  title,
  en,
  children,
}: {
  title: string;
  en?: string;
  children: React.ReactNode;
}) => (
  <section className="border-t border-[var(--v4-line)] py-7 first:border-t-0 first:pt-0">
    <h2 className="text-lg font-semibold tracking-tight text-[var(--v4-text)]">{title}</h2>
    {en ? (
      <p className="mt-1 text-sm font-medium leading-6 text-[var(--v4-text-faint)]">{en}</p>
    ) : null}
    <div className="mt-3 space-y-3 text-[15px] font-medium leading-7 text-[var(--v4-text-muted)]">{children}</div>
  </section>
);

export default function AboutPage() {
  return (
    <main className="flex-1 overflow-y-auto bg-[var(--v4-canvas)] px-5 py-8 md:px-10 md:py-12">
      <div className="mx-auto w-full max-w-3xl pb-10 pt-3">
        <div className="mt-3 flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--v4-accent)]/25 bg-[var(--v4-accent-soft)] text-[var(--v4-accent-strong)]">
            <ShieldCheck className="h-5 w-5 stroke-[2.25]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-[var(--v4-accent-strong)]">SAIKOSUBSTUDIO / POLICY</p>
            <h1 className="font-display mt-2 text-3xl tracking-tight text-[var(--v4-text)] md:text-[2rem]">隐私与版权说明</h1>
            <p className="mt-1 text-sm font-medium tracking-[0.04em] text-[var(--v4-text-faint)]">Privacy &amp; Copyright Notice</p>
            <p className="mt-4 max-w-2xl text-[15px] font-medium leading-7 text-[var(--v4-text-muted)] md:text-base">
              文件处理在当前设备本地完成，不会上传到本站；片源资料检索与反馈提交遵循最小必要原则。
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--v4-text-faint)]">
              Local processing by default. Optional title lookup and feedback send only the minimum fields required.
            </p>
          </div>
        </div>

        <div className="v4-panel mt-10 rounded-lg px-6 py-7 md:px-8">
          <Section title="本地文件处理 / Local files" en="Subtitles and reference media stay in the browser; preferences may be stored on-device only.">
            <p>
              字幕、ZIP、7Z、RAR 字幕包与作为参照的本地媒体文件，均由浏览器在当前设备读取和处理，不会上传或保存到本站服务器。
            </p>
            <p>
              使用本工具期间的偏好选择、状态以及其他可记忆内容（例如「历史存档」），保存在当前设备的本地存储或缓存中，可随时删除；清除浏览器站点数据将移除这些记录。本工具不提供账号注册或登录；更换设备或清除站点数据后，本地记录不会自动同步。
            </p>
            <p className="flex items-start gap-2 text-[var(--v4-text-faint)]">
              <FileLock2 className="mt-1 h-4 w-4 shrink-0 text-[var(--v4-accent-strong)]" aria-hidden="true" />
              导入限制用于防止异常文件不合理占用浏览器性能与内存，不会修改磁盘上的原始文件。
            </p>
          </Section>

          <Section title="影视资料与 TMDB / Metadata" en="Title search sends only necessary query fields via our TMDB proxy.">
            <p>
              片名检索需要将检索词、媒体类型、年份或媒体 ID 等信息，通过本站的 TMDB 专用接口从官方途径获取片名、海报、剧照等元数据。请避免在输入中填写关联个人信息或可识别内容。
            </p>
            <p>本产品使用 TMDB API，但未获 TMDB 认可或认证。</p>
            <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
            <div className="flex items-center gap-3 pt-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/tmdb_logo_blue_square.svg"
                alt="The Movie Database (TMDB)"
                className="h-8 w-auto object-contain"
              />
              <p className="text-xs leading-5 text-[var(--v4-text-faint)]">
                影片资料与部分图像来自 TMDB；展示其标识不代表获得背书。
              </p>
            </div>
          </Section>

          <Section title="反馈提交 / Feedback" en="Only the text you choose to send is delivered to the developer.">
            <p>
              「提交反馈」页面仅提交你手动填写并确认的反馈类型与正文。开发者不会因此获得你的文件内容、属性信息、本地路径或浏览器诊断信息等个人标识信息。
            </p>
            <p>
              <Link
                href="/feedback"
                className="inline-flex items-center gap-1.5 font-semibold text-[var(--v4-accent-strong)] underline-offset-4 hover:underline"
              >
                <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                前往反馈页
              </Link>
            </p>
          </Section>

          <Section title="服务日志与分析 / Service logs" en="Hosting may keep basic request and security signals; not your subtitle files.">
            <p>
              本站的运行托管服务提供商可能记录维持站点可用所需的基础请求信息，例如时间、安全事件与基础访问统计等。用户的文件内容、属性名称或本地目录路径不会被上传或记入产品分析。
            </p>
          </Section>

          <Section title="版权与使用责任 / Copyright" en="You remain responsible for rights to materials you import and export.">
            <p>
              用户应知晓并确认：导入、编辑的本地字幕与媒体等文件已获合法使用授权。
            </p>
            <p>
              SaikoSubStudio（本工具）是运行在本地设备的字幕工具，不提供字幕或其他内容资源的托管、索引或分发服务；编辑和产出内容的使用、传播及相关版权责任，由使用者自行确认并承担。
            </p>
          </Section>

          <p className="border-t border-[var(--v4-line)] pt-6 text-xs font-medium text-[var(--v4-text-faint)]">
            最近更新：2026-07-26
          </p>
        </div>
      </div>
    </main>
  );
}
