# NAS Store Action 迁移进度

## 任务目标
将 NAS 版本 `useStudioStore.ts` 中所有重要的 action 和复杂 workflow 整体迁移到 Git 版本，实现核心功能对齐。

**原则**：
- 先忠实复现 NAS 成熟版本
- 保留 Git 版本已有的合理改进
- 迁移完成后统一进行测试和修缮

## 当前整体进度
**进度**：**9/9 全部完成**

## 详细进度

| 序号 | Action | 状态 | 备注 |
|------|--------|------|------|
| 1 | `bindTrack` | 已完成 | 已从 NAS 忠实迁移 |
| 2 | `removeFileFromTask` | 已完成 | 已从 NAS 忠实迁移 |
| 3 | `deleteTask` | 已完成 | 已从 NAS 忠实迁移 |
| 4 | `selectTask` | 已完成 | 已从 NAS 忠实迁移（关键依赖） |
| 5 | `initializeLibrary` | 已完成 | 已从 NAS 忠实迁移 |
| 6 | `saveToLibrary` | 已完成 | 已从 NAS 忠实迁移 |
| 7 | `deleteFromLibrary` | 已完成 | 已从 NAS 忠实迁移 |
| 8 | `loadFromLibrary` | 已完成 | 已从 NAS 忠实迁移 |
| 9 | `processFiles` | 已完成 | 已从 NAS 忠实迁移（分段写入） |

## 备注
- 所有 9 个核心 Action 已全部从 NAS 成熟版本忠实迁移完成
- `processFiles` 包含了文件智能分组、Episode 识别、最优轨道绑定（ASS 优先 + 文件大小）等完整逻辑
- `selectTask` 包含了 ASS 样式自动挖掘 + TMDB 自动搜索等细节
- 状态联动问题的基础已大幅改善
- 后续可进行统一测试与修缮

**最后更新时间**：2026-06-14（已全部完成）