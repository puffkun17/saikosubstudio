# SaikoSubStudio 文案审阅稿

> 用途：逐条改措辞改完后把「拟改」填上，或直接在对应源码改；本文件不自动同步代码  
> 生成日期：2026-07-26  
> 约定：检查标记三类全称固定为 **结构差异**（方块）／**画面文字**（圆形）／**声音描述**（三角形），禁止缩写为「结构／画面／声音」

---

## 0. 标记图例（已落地）

| Key | 形状 | 现行全称 | 拟改 |
|---|---|---|---|
| `mark.structure` | 方块 ■ | 结构差异 | |
| `mark.screen` | 圆形 ● | 画面文字 | |
| `mark.sound` | 三角形 ▲ | 声音描述 | |

源码：`src/components/Workbench/inspectionMarks.tsx`

---

## 1. InfoHint（全部 10 处）

格式：`label` ＝提示按钮无障碍名；`body` ＝弹出正文

### 1.1 导入 · TaskList

| Key                             | 现行                                      | 拟改  |
| ------------------------------- | --------------------------------------- | --- |
| `tasklist.sequence.hint.label`  | 字幕序列说明                                  |     |
| `tasklist.sequence.hint.body`   | 选择要处理的字幕文件双语单文件会自动识别；分开的中文与第二语言轨将按时间轴合并 |     |
| `tasklist.primary.hint.label`   | 主字幕说明                                   |     |
| `tasklist.primary.hint.body`    | 主字幕优先使用中文或双语内容                          |     |
| `tasklist.secondary.hint.label` | 第二语言说明                                  |     |
| `tasklist.secondary.hint.body`  | 英语或其他语言轨，将与主字幕按时间轴合并                    |     |
| `tasklist.narration.hint.label` | 旁白与导评说明                                 |     |
| `tasklist.narration.hint.body`  | （术语旁白全文）+「 导评通常不是正片对白」                  |     |
| `tasklist.align.hint.label`     | 对齐方式说明                                  |     |
| `tasklist.align.hint.body`      | 仅在主字幕与第二语言分轨时生效双语单文件无需选择                |     |
| `tasklist.export.hint.label`    | 导出选项说明                                  |     |
| `tasklist.export.hint.body`     | 默认留空，可手输；也可用下方捷径从片源或原始文件名填充格式在导出时再选     |     |

### 1.2 工作台 · WorkbenchStep

| Key | 现行 | 拟改 |
|---|---|---|
| `workbench.density.hint.label` | 字幕密度说明 | |
| `workbench.density.hint.body` | 每分钟字幕行数声音描述、歌词和画面文字也会影响该指标 | |

### 1.3 分布图 · SourceMatchPanel

| Key                            | 现行                                                                | 拟改                                  |
| ------------------------------ | ----------------------------------------------------------------- | ----------------------------------- |
| `sourcematch.chart.hint.label` | 字幕分布图说明                                                           |                                     |
| `sourcematch.chart.hint.body`  | 上方曲线表示字幕疏密；下方三层标记分别是：方块＝结构差异，圆形＝画面文字，三角形＝声音描述靠近的同色标记会合并且标数量，点击可定位 | 上方曲线表示字幕疏密；<br>下方三层标记表示字幕分类，点击可定位位置 |

### 1.4 样式 · StyleSidebar

| Key                           | 现行                                                       | 拟改                                         |
| ----------------------------- | -------------------------------------------------------- | ------------------------------------------ |
| `style.size.hint.label`       | 尺寸单位说明                                                   |                                            |
| `style.size.hint.body`        | 数值为字幕参考单位（以 288 高的参考画布计），导出时会按「输出」页的画面规格自动换算，预览所见即最终比例   | 字幕参考数值单位（以 288 高度画幅为基准），导出时规格自动换算为预览最终比例呈现 |
| `style.aux.hint.label`        | 辅助字幕说明                                                   |                                            |
| `style.aux.hint.body`         | 指声音描述、画面文字、歌词或非对白表达完整保留最安全；智能精简会隐藏明确低价值环境音；清洁对白更适合普通观影导出 | 将声音描述、画面文字、歌词或非对白表达完整保留；智能精简模式会隐藏明确低价值环境音等 |
| `style.resolution.hint.label` | 画面规格说明                                                   |                                            |
| `style.resolution.hint.body`  | 用作 ASS 字幕样式的参考画布尺寸，影响字号、边距和描边换算；不会改变视频文件本身的分辨率           | 声明ASS 字幕样式的参考画布尺寸，影响字号、边距和描边等样式呈现          |

---

## 2. 术语字典 `subtitleTerminology.ts`

| Key                     | 中文名   | 说明（现行）                             | 拟改中文名  | 拟改说明                           |
| ----------------------- | ----- | ---------------------------------- | ------ | ------------------------------ |
| `term.dialogue`         | 对白    | 角色说出的台词，是字幕的主体内容                   |        |                                |
| `term.forced_narrative` | 强制字幕  | 用于翻译非主要语言对白、重要外语片段或必须理解的画面文字，通常应保留 |        |                                |
| `term.screen_text`      | 画面文字  | 片名、地点、招牌、短信、文件、屏幕内容等画面中出现的文字       |        |                                |
| `term.sound_caption`    | 声音描述  | 风声、门响、音乐、笑声等非对白声音提示，常见于 SDH/CC 字幕  |        |                                |
| `term.speaker_label`    | 说话人标识 | 标注说话人身份或声音来源，例如“广播：”“旁白：”“警察：”     | 台词来源角色 | 标注说话人身份或声音来源，例如“电台：”“旁白：”“观众：” |
| `term.narration`        | 旁白    | 画外音、内心独白、旁白解说等非现场对白                |        |                                |
| `term.lyrics`           | 歌词    | 歌曲、哼唱、音乐段落中的歌词内容                   |        |                                |
| `term.commentary`       | 导评    | 导演、演员或制作人员的评论音轨字幕                  |        |                                |
| `term.credit`           | 制作信息  | 字幕组、翻译、校对、压制等制作署名信息                |        |                                |
| `term.metadata_note`    | 技术备注  | 编码、版本、来源、合并说明等非影片内容信息              |        |                                |

---

## 3. 工作台 · 字幕检查

| Key                          | 现行                                  | 拟改                     |
| ---------------------------- | ----------------------------------- | ---------------------- |
| `workbench.title`            | 字幕工作台                               | 字幕调校                   |
| `workbench.chip.unnamed`     | 未命名字幕                               |                        |
| `workbench.chip.unmatched`   | 未匹配                                 |                        |
| `workbench.action.style`     | 字幕样式（title: 调整字幕样式）                 |                        |
| `workbench.next`             | 打开预览                                |                        |
| `workbench.next.disabled`    | 还没有可预览的字幕时间轴，请先完成合轴                 | 还没有可预览的字幕时间轴，请先完成合轴或分配 |
| `workbench.inspect.title`    | 字幕检查                                | 字幕信息概览                 |
| `workbench.inspect.none`     | 无结构差异                               |                        |
| `workbench.inspect.pending`  | {n} 处结构差异待复核                        | {n} 处结构差异请复核           |
| `workbench.stats.text`       | 文本量                                 |                        |
| `workbench.stats.span`       | 跨度                                  |                        |
| `workbench.stats.density`    | 密度                                  |                        |
| `workbench.filter.all`       | 全部                                  |                        |
| `workbench.filter.structure` | 结构差异                                |                        |
| `workbench.filter.screen`    | 画面文字                                |                        |
| `workbench.filter.sound`     | 声音描述                                |                        |
| `workbench.detail.open`      | 点击查看详细内容                            | 查看详细内容                 |
| `workbench.detail.close`     | 收起详细内容                              | 返回概览                   |
| `workbench.back.title`       | 返回导入页？                              | 是否重新导入                 |
| `workbench.back.body`        | 已导入的文件与轨道选择会保留再次进入工作台时，将按当前选择重新生成预览 |                        |
| `workbench.back.stay`        | 继续编辑                                |                        |
| `workbench.back.go`          | 返回导入                                |                        |

---

## 4. 分布图 / 片源匹配

| Key                          | 现行                                                | 拟改                                     |
| ---------------------------- | ------------------------------------------------- | -------------------------------------- |
| `sourcematch.title.profile`  | 字幕时间分布                                            |                                        |
| `sourcematch.title.match`    | 片源覆盖分布                                            |                                        |
| `sourcematch.cta.add`        | 加入片源                                              | 视频文件对比                                 |
| `sourcematch.cta.replace`    | 更换片源                                              | 更换视频文件                                 |
| `sourcematch.privacy`        | 本地读取元数据，不上传                                       | 仅用于查询元数据信息，不关联任何用户                     |
| `sourcematch.error.duration` | 无法读取该片源时长，请尝试常见 MP4 / MKV / MOV 文件                | 无法读取该文件，请尝试常见 MP4 / MKV / MOV 等支持的视频文件 |
| `sourcematch.grade.matched`  | 跨度接近                                              |                                        |
| `sourcematch.grade.fixable`  | 建议抽查                                              |                                        |
| `sourcematch.grade.complex`  | 跨度有差异                                             |                                        |
| `sourcematch.grade.poor`     | 差异较大                                              |                                        |
| `sm.dist.spacious`           | 分布舒展                                              |                                        |
| `sm.dist.focused`            | 分布集中                                              |                                        |
| `sm.dist.sparse`             | 分布稀疏                                              |                                        |
| `sm.find.overlap`            | 存在并行字幕｜检测到 {n} 处时间重叠，可能来自画面文字、声音描述或多角色排版，不直接判定为错误 |                                        |
| `sm.find.overlap_ok`         | 时间轴结构正常｜未发现明显字幕时间重叠                               |                                        |
| `sm.find.long_gap`           | 存在长空窗｜片中出现较长无字幕区间，可能是无对白段，也可能是版本差异或字幕缺段           |                                        |
| `sm.find.late_start`         | 字幕起点偏后｜字幕开始时间明显晚于片源起点，可能存在片头贴片或字幕缺少开场段            |                                        |
| `sm.find.early_end`          | 字幕覆盖不足｜字幕结束时间明显早于片源结尾，若片尾仍有对白，建议更换字幕或进入人工校准       |                                        |
| `sm.find.tail_risk`          | 片尾覆盖偏短｜字幕比片源更早结束，可能只是片尾无对白，也可能存在版本差异              |                                        |
| `sm.find.over_end`           | 字幕长于片源｜字幕时间轴超过片源时长，可能是不同版本字幕                      |                                        |
| `sm.find.no_video`           | 可加入片源参照｜当前只展示字幕自身结构；选择本地视频后，可进一步检查时间覆盖范围          |                                        |
| `sm.title.profile`           | 字幕概览已准备｜已读取字幕文本与时间轴这里先看文本规模、时间跨度和对白分布，不对片源匹配度下结论  |                                        |
| `sm.title.poor`              | 时长覆盖差异明显｜字幕时间范围与片源时长差异较大，建议先试听关键位置，必要时更换字幕        |                                        |
| `sm.title.complex`           | 时长覆盖存在风险｜字幕时间范围与片源时长存在差异，只能提示版本风险，不能据此判断声音是否合轴    |                                        |
| `sm.title.fixable`           | 时长覆盖可继续检查｜字幕时间范围未见明显越界；仍需通过实际播放确认整体偏移或中途漂移        |                                        |
| `sm.title.ok`                | 时长覆盖未见明显异常｜字幕起止范围与片源总时长基本协调；这不等同于声音对齐结论           |                                        |
| `sm.title.fallback`          | 字幕结构可继续检查｜当前仅根据字幕时间轴给出结构概览                        |                                        |

---

## 5. 结构差异详情 / 序列徽章

| Key                        | 现行                                         | 拟改                                         |
| -------------------------- | ------------------------------------------ | ------------------------------------------ |
| `align.panel.empty`        | 没有需要列出的非直接配对或存疑内容                          | 没有需要列出的非直接配对或存疑内容                          |
| `align.panel.header`       | 完整列出结构差异、画面文字与声音描述（{n}）                    | 完整列出结构差异、画面文字与声音描述（{n}）                    |
| `align.badge.screen`       | 画面文字                                       | 画面文字                                       |
| `align.badge.sound`        | 声音描述                                       | 声音描述                                       |
| `align.action.locate`      | 定位                                         | 定位                                         |
| `align.cols`               | 时间 / 内容 / 判定 / 操作                          | 时间 / 内容 / 判定 / 操作                          |
| `align.single.boundary`    | 片头/片尾单轨 · …｜可能是版本附加内容、片头片尾信息或未配对台词对白，未自动删除 | 片头/片尾单轨 · …｜可能是版本附加内容、片头片尾信息或未配对台词对白，未自动删除 |
| `align.single.mid`         | 单侧字轨 · …｜连续 {n} 行未配对，未自动改写                 | 单侧字轨 · …｜连续 {n} 行未配对，未自动改写                 |
| `align.shifted`            | 整体平移配对 ·…｜已按检测偏移 … 完成配对 …                  | 整体平移配对 ·…｜已按检测偏移 … 完成配对 …                  |
| `align.expanded`           | 已展开的对话组｜压缩的角色间对白已按另一轨的连续时间轴拆为两句            | 已展开的对话组｜压缩的角色间对白已按另一轨的连续时间轴拆为两句            |
| `seq.badge.dialogue_group` | 对话组                                        | 对话组                                        |
| `seq.badge.screen`         | 画面文字                                       | 画面文字                                       |
| `seq.badge.sound`          | 声音描述                                       | 声音描述                                       |
| `seq.badge.aux`            | 辅助信息                                       | 辅助信息                                       |
| `seq.empty`                | 当前没有可预览的字幕                                 | 当前没有可预览的字幕                                 |
| `seq.header`               | 时间轴                                        | 时间轴                                        |
| `seq.cols`                 | 行号 / 时间轴 / 字幕内容                            | 行号 / 时间轴 / 字幕内容                            |

---

## 6. 样式侧栏（主文案）

| Key                   | 现行                                   | 拟改  |
| --------------------- | ------------------------------------ | --- |
| `style.title`         | 样式参数                                 |     |
| `style.subtitle`      | 调整字幕在预览与导出中的呈现                       |     |
| `style.guides`        | 辅助线                                  |     |
| `style.tab.template`  | 模板                                   |     |
| `style.tab.type`      | 文字                                   |     |
| `style.tab.output`    | 输出                                   |     |
| `style.section.size`  | 文字尺寸                                 |     |
| `style.section.font`  | 字体                                   |     |
| `style.section.color` | 颜色                                   |     |
| `style.scale`         | 整体缩放｜调整字幕整体大小比例                      |     |
| `style.zh_size`       | 中文字幕                                 |     |
| `style.en_size`       | 第二语言字幕                               |     |
| `style.margin`        | 底部距离                                 |     |
| `style.aux.strategy`  | 辅助字幕策略                               |     |
| `style.aux.keep`      | 完整｜全保留                               |     |
| `style.aux.smart`     | 智能｜隐去环境音                             |     |
| `style.aux.clean`     | 清洁｜对白优先                              |     |
| `style.resolution`    | 画面规格｜标清 SD / 全高清 HD 1080p / 超高清 UHD 4K |     |
| `style.lyrics`        | 歌词｜斜体歌词｜位置：顶部/底部                     |     |

---

## 7. 放映厅 ControlDeck / 播放条

| Key | 现行（多为 title/aria） | 拟改 |
|---|---|---|
| `deck.aspect.4_3` | 画幅 4:3 · 标准画幅 | |
| `deck.aspect.16_9` | 画幅 16:9 · 宽屏 | |
| `deck.aspect.239` | 画幅 2.39:1 · 宽银幕 | |
| `deck.aspect.imax` | 画幅 IMAX · 沉浸画幅 | |
| `deck.bg.default` | 默认背景 | |
| `deck.bg.poster` | 影片剧照（{n} 张）／匹配影片后可用剧照 | |
| `deck.bg.shuffle` | 换一张剧照 | |
| `deck.preset.netflix` | Netflix · 轻阴影 | |
| `deck.preset.classic` | 大银幕 · 黄白配 | |
| `deck.preset.anime` | 动漫 · 深描边 | |
| `theater.title` | 字幕预览 | |
| `theater.lights` | 关灯观影（L）／开灯（L / Esc） | |
| `timeline.play` | 播放字幕轴｜播放（便于查看渐入渐出） | |
| `timeline.pause` | 暂停预览｜暂停 | |
| `timeline.tip` | 行 {n} · {p}% | |

---

## 8. 导入空态 / TaskList / 导出

| Key                         | 现行                                     | 拟改  |
| --------------------------- | -------------------------------------- | --- |
| `ingest.hero.title`         | 完全本地运行的轻字幕处理工具                         |     |
| `ingest.hero.sub`           | 时间戳对齐合并 · 字幕样式修改 · 模拟播放预览 · 所见即所得      |     |
| `ingest.card.title`         | 欢迎提交字幕／松开即可加入                          |     |
| `ingest.card.sub`           | 拖入文件、文件夹或字幕包，全程本地环境处理                  |     |
| `ingest.card.cta.file`      | 选择字幕                                   |     |
| `ingest.card.cta.folder`    | 文件夹                                    |     |
| `ingest.card.hint`          | 支持 SRT / ASS 字幕，以及 ZIP / RAR / 7Z 压缩格式 |     |
| `ingest.feature.local`      | 本地处理｜文件不上传，隐私可控                        |     |
| `ingest.feature.tracks`     | 多轨整理｜差异提示，核对微调                         |     |
| `ingest.feature.style`      | 样式定制｜字形色效，随心调整                         |     |
| `ingest.feature.theater`    | 效果预览｜实际呈现，所见所得                         |     |
| `tasklist.section.sequence` | 字幕序列                                   |     |
| `tasklist.row.primary`      | 主字幕｜选择中文或双语字幕                          |     |
| `tasklist.row.secondary`    | 第二语言｜选择英语或其他语言（可选）                     |     |
| `tasklist.row.commentary`   | 旁白导评｜可选                                |     |
| `tasklist.align.smart`      | 智能｜按时间轴就近配对…                           |     |
| `tasklist.align.industrial` | 精校｜更严格的对齐搜索…                           |     |
| `tasklist.export.section`   | 导出选项                                   |     |
| `export.cta`                | 导出字幕                                   |     |
| `export.menu.title`         | 选择格式                                   |     |
| `export.menu.sub`           | 下载到本地，如视频文件所在目录等                       |     |
| `export.ass`                | 高级字幕｜配置颜色与样式；丰富字幕表达需求                  |     |
| `export.srt`                | 纯文本字幕｜轻便兼容；朴素简洁                        |     |

---

## 使用方式

1. 在「拟改」列写你的新措辞（可只填要改的行）  
2. 回我：按 Key 批量替换，或贴回整表  
3. 标记三类名称若要改，请同时改 §0 与所有引用行，避免再出现缩写
