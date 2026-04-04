# bioagent

医学编辑向 AI 助手：飞书长连接收消息 →（可选 RAG）→ Claude 生成 → 飞书回复 / 云文档。详见 `docs/` 内产品与设计文档。

## 数据流与隐私（2.0 E 摘要）

以下内容用于团队自检「用户数据去了哪里」；**不构成法律或合规承诺**，正式对外投放仍需人工流程。

| 环节 | 数据去向 | 说明 |
|------|----------|------|
| 飞书 IM | 飞书开放平台 | 收文本/文件事件，按应用权限发消息、建云文档、加协作者等 |
| 对话与创作 | Claude（通常经 `ANTHROPIC_BASE_URL` 中转） | 用户当前句、会话历史、写作任务拼装后的 payload、合规协审等 |
| 日常对话 RAG | OpenAI 兼容 Embeddings 端 | 用户问句嵌入；仅检索片段进入提示，不单独「上传整库」 |
| 向量库 / 记忆 | 本机 `data/` | `rag-store.json`、`memory.json`、`uploads/` 等；**已在 `.gitignore`，勿提交** |
| 环境变量 | 本机 `.env` | 密钥仅存本地；仓库仅保留 `.env.example` 模板 |

## 日志约定

- **默认**：标准输出**不**打印用户消息与机器人回复的**全文**，只打长度与约前 80 字预览（见 `src/lib/privacy-log.ts`）。
- **排障**：需要全文时设置 `DEBUG_CONTENT=1` 再启动。另有 `DEBUG_LARK`、`DEBUG_RAG` 控制飞书 SDK 与 RAG 细日志（见 `.env.example`）。

## 快速开始

```bash
cp .env.example .env
# 编辑 .env：至少 ANTHROPIC_*、FEISHU_APP_*；RAG 需 OPENAI_API_KEY
pnpm install
pnpm start
```

更多脚本与侧车工具见 `package.json` 与 `docs/显式状态登记.md`。
