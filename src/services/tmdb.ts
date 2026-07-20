/**
 * TMDB 请求统一入口。
 *
 * cf-pages-hosted 分支走服务端代理（/api/tmdb/*，密钥在服务端）；
 * 未来 main 开源分支只需替换这一个函数，即可切换为
 * 「用户自备 API Key 直连 api.themoviedb.org」模式，调用方不感知。
 */
export const tmdbFetch = (path: string): Promise<Response> => {
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  return fetch(`/api/tmdb/${normalized}`);
};
