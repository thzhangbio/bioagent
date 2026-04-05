# PDF Text Cleanup Pyramid 重构完成规划

本文档是 `pdf-text-cleanup/pyramid/` 重构的唯一进度面板。

后续执行约定：
- 每完成一项，就直接在本文档对应条目前打勾。
- 若任务拆分发生变化，优先更新本文档，再继续改代码。
- 未在本文档登记的改动，不视为本轮重构正式范围。

## 1. 重构目标

将当前 `side-tools/pdf-text-cleanup/` 中以脚本为主的实现，逐步迁移为 `pyramid/` 中按“目录即职责节点、根代码即总控、子目录即功能拆分”组织的新架构。

目标不是一次性重写，而是：
- 保持旧工具可用
- 逐层迁移功能
- 在迁移过程中让目录结构直接表达执行结构
- 让每一层都具备清晰的职责边界、输入输出和编排关系

## 2. 架构规则

`pyramid/` 中每个文件夹都代表一个功能节点，并遵守以下规则：

- 文件夹根目录的代码文件，代表该文件夹的总控。
- 如果该文件夹没有子文件夹，说明根代码文件直接实现本层功能。
- 如果该文件夹有子文件夹，说明根代码文件负责调度这些子文件夹，以完成本层职责。
- 子文件夹是父文件夹职责的拆分，不是随意分类。
- 根代码文件应尽量只承担编排、边界控制和结果汇总，不重新堆积为“大而全”的旧式脚本。

## 3. 业务主线

当前重构主线分为三段：

- 段Ⅰ：`segment-inbox-to-out`
  负责将 MinerU 原始输入处理为最终 `out/*.kb.md`
- 段Ⅱ：`segment-out-to-knowledge`
  负责将 `out/` 成品进入主项目知识库及 ingest 流程
- 段Ⅲ：`segment-out-to-archive`
  负责在入库完成后完成 `out/` 与侧车 `inbox/` 的归档

## 4. 完成定义

当以下条件全部满足，可视为 `pyramid` 重构完成：

- 三个段级目录都拥有可运行的根总控代码文件
- 各段已按目录职责承接旧实现，不再依赖旧总控脚本承担主编排职责
- 关键行为具备最小验证能力
- 旧脚本要么被删除，要么降级为兼容入口并转调 `pyramid` 新总控
- 文档能反映真实执行路径与维护方式

## 5. 旧实现映射

当前已确认的主要映射关系如下：

- `pipeline.ts`
  迁往段Ⅰ总控及 `00/01/10/11/12`
- `raw-to-preliminary.ts`
  迁往 `03-mineru-preliminary`
- `cleanup.ts`
  拆往 `04/05/06/07`
- `mineru-kb.ts`
  拆往 `08/09`
- `mineru-json-structure.ts`
  迁往 `02-structure-json`
- `kb-metadata.ts`
  迁往 `10-metadata-fetch`
- `kb-archive-filename.ts`
  迁往 `10/11/12`
- `archive-inbox.ts`
  迁往段Ⅲ中的 `01/03/04`
- `archive-out.ts`
  迁往段Ⅲ中的 `00/01/03`

## 6. 执行顺序

本次重构按以下顺序推进：

1. 先搭建段Ⅰ骨架并迁移最独立、最稳定的节点
2. 再拆分段Ⅰ中的正文清洗节点
3. 再迁移段Ⅱ与段Ⅲ的流程总控
4. 最后处理兼容入口、收尾文档和旧脚本退场

## 7. 总进度清单

### A. 基础规划与约束

- [x] 明确 `pyramid` 的目录职责规则与总控规则
- [x] 明确三段业务主线与各自边界
- [x] 明确旧实现到新结构的初步映射
- [x] 建立本完成规划文档，作为后续勾选面板

### B. 段Ⅰ `segment-inbox-to-out`

#### B1. 段级总控

- [ ] 为 `segment-inbox-to-out/` 建立根总控代码文件
- [ ] 设计并落地段Ⅰ统一上下文对象
- [ ] 让段Ⅰ总控按固定顺序调度 `00` 到 `12`
- [ ] 确定段Ⅰ总控的最小可运行入口

#### B2. 第一批优先迁移节点

- [ ] `00-entry-routing`：迁移参数解析与运行选项整理
- [ ] `01-read-validate`：迁移输入读取、路径解析、基础校验
- [ ] `02-structure-json`：迁移 MinerU JSON 结构块生成
- [ ] `03-mineru-preliminary`：迁移原始稿初步规整逻辑
- [ ] `10-metadata-fetch`：迁移 metadata 补全与获取逻辑
- [ ] `11-write-final`：迁移最终输出路径决策与写文件逻辑
- [ ] `12-inbox-sync`：迁移 inbox 源稿对齐与更名逻辑

#### B3. 第二批正文清洗拆分

- [ ] `04-layout-flow`：迁移段落流、断词、软换行合并逻辑
- [ ] `05-headers-footers-pages`：迁移页眉页脚、页码、重复噪声清理
- [ ] `07-cleanup-generic`：迁移通用清洗与非 KB 特定规则

#### B4. 第三批高规则密度节点

- [ ] `06-tables-blocks`：迁移表格与特殊块处理逻辑
- [ ] `08-cleanup-kb-specific`：迁移 KB 专用清洗主逻辑
- [ ] `09-formula-fragments`：迁移短公式与碎片规则主逻辑

#### B5. 段Ⅰ收口

- [ ] 让新段Ⅰ总控跑通最小闭环
- [ ] 让旧 `pipeline.ts` 转调新段Ⅰ总控，或确认退役方式
- [ ] 更新段Ⅰ README，使其反映真实代码结构

### C. 段Ⅱ `segment-out-to-knowledge`

#### C1. 段级总控

- [ ] 为 `segment-out-to-knowledge/` 建立根总控代码文件
- [ ] 明确段Ⅱ输入、输出、前置条件与成功判定

#### C2. 子节点落地

- [ ] `00-pre-out-check`：定义入库前检查动作
- [ ] `01-copy-to-knowledge`：落地复制到知识库目录的动作
- [ ] `02-metadata-id`：处理 `paperId`、DOI、slug 对齐
- [ ] `03-ingest-index`：接入 `ingest:literature` 等动作
- [ ] `04-verify-search`：建立最小抽样验证
- [ ] `05-mark-ready-archive`：定义可进入归档阶段的判定

#### C3. 段Ⅱ收口

- [ ] 更新段Ⅱ README，使其反映真实代码结构
- [ ] 明确与主项目根目录现有流程的衔接方式

### D. 段Ⅲ `segment-out-to-archive`

#### D1. 段级总控

- [ ] 为 `segment-out-to-archive/` 建立根总控代码文件
- [ ] 明确段Ⅲ触发时机、输入、目标路径和幂等策略

#### D2. 子节点落地

- [ ] `00-archive-trigger`：定义归档触发条件
- [ ] `01-target-paths`：统一归档目标目录规则
- [ ] `02-idempotency`：建立冲突与重复执行策略
- [ ] `03-move-execute`：落地实际搬运逻辑
- [ ] `04-inbox-archive-sidecar`：迁移 inbox 源稿归档逻辑
- [ ] `05-audit-log`：决定是否记录审计日志，并实现最小版本

#### D3. 段Ⅲ收口

- [ ] 让旧 `archive-inbox.ts` / `archive-out.ts` 转调新段Ⅲ总控，或确认退役方式
- [ ] 更新段Ⅲ README，使其反映真实代码结构

### E. 横切能力与回归

- [ ] 明确 `fragment-audit.ts`、`fragment-list.ts`、`fragment-fixtures.ts`、`fragment-apply-inplace.ts` 在新架构中的位置
- [ ] 确保 `09-formula-fragments` 与现有碎片审计/回归机制兼容
- [ ] 为新总控链路建立最小验证方式
- [ ] 为关键迁移节点补充必要测试或回归样例

### F. 兼容入口与文档收尾

- [ ] 确定旧入口脚本的保留、转调或删除策略
- [ ] 更新 `pdf-text-cleanup/README.md`
- [ ] 更新 `pdf-text-cleanup/WORKFLOW.md`
- [ ] 更新 `pyramid/README.md`
- [ ] 补充迁移完成后的维护约定

## 8. 当前建议的立即下一步

建议按以下顺序开始编码：

1. 为段Ⅰ建立根总控代码文件
2. 迁移 `00-entry-routing`
3. 迁移 `03-mineru-preliminary`
4. 迁移 `12-inbox-sync`
5. 再补 `01`、`02`、`10`、`11`

原因：
- 这些节点边界最清楚
- 与旧实现一一对应
- 最适合先建立“根总控 + 子节点”的工作方式
- 能最快形成可运行的段Ⅰ骨架
