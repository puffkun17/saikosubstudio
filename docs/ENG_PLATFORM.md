# Engineering platform (hosted line) / 托管线工程平台

> Scope: merge + human assist only. No translation. / 范围：合轴 + 人工协助；不含翻译。

## Why Next is pinned at 15.5.2 / 为何钉死 Next 15.5.2

Hosted production builds with `@cloudflare/next-on-pages` (^1.13.x), which declares support **only through Next 15.5.2**.

`next@15.5.2` carries known advisories (see decision-log). **Do not** `npm audit fix --force` or blind-bump Next on `cf-pages-hosted` — that breaks the Pages adapter / deploy path.

中文：公测托管线用 `@cloudflare/next-on-pages`，官方声明仅支持到 Next 15.5.2。已知 advisory 被适配器锁死；禁止在托管线上 `npm audit fix --force` 或盲目升 Next。

## Upgrade gate: OpenNext Cloudflare / 升级闸门

`@cloudflare/next-on-pages` is **deprecated**. Cloudflare recommends **`@opennextjs/cloudflare`**:

- Docs: https://opennext.js.org/cloudflare

A full OpenNext migration is the **gate** for:

1. Moving past Next 15.5.2 (security patches)
2. Modernizing the CF Pages adapter
3. Eventually dropping the `--legacy-peer-deps` install crutch

**This change set does not migrate to OpenNext.** Document only.

中文：`next-on-pages` 已弃用；未来升 Next / 修 advisory 的前置条件是迁到 OpenNext Cloudflare。完整迁移不在当前变更范围。

## eslint-config-next pin / ESLint 对齐

`eslint-config-next` must match `next` (**15.5.2**). v16 flat-config exports are incompatible with the 15.x legacy `extends` package; `eslint.config.mjs` uses `FlatCompat` until the OpenNext + Next bump restores native flat exports.

## CI expectations / CI 要求

Workflow: `.github/workflows/ci.yml`

- Runs on `pull_request` → `cf-pages-hosted` and `push` to `cf-pages-hosted`
- Must keep **`npm run test:core`** green for any merge-algorithm change
- Also runs `tsc --noEmit` and `lint`

Deploy build verification remains in `.github/workflows/deploy.yml` (Pages artifact check).

中文：合入托管线前 CI 必须跑绿 `test:core`（合并算法回归）；另有类型检查与 lint。部署产物校验仍在 `deploy.yml`。
