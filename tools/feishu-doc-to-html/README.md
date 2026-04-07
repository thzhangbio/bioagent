# Feishu Doc To HTML

将飞书 `docx` 文档抓取为本地 HTML，并套用当前项目使用中的梅斯学术单页 CSS。

支持能力：

- 保留飞书 Markdown 的逐行分段
- 渲染标题、小标题、列表、表格、引用块
- 下载并嵌入飞书文档中的图片
- 可选导出单文件离线版 HTML（图片转为 `data:` URI）

## 用法

```bash
pnpm exec tsx tools/feishu-doc-to-html/render-feishu-doc-to-html.ts \
  --doc https://feishu.cn/docx/GBFYdStwcopBsXxC2tscpAsSnbb \
  --slug 03-wes-pediatric-lupus-slot-driven \
  --out-dir output/medsci-html-final/20260406 \
  --standalone
```

常用参数：

- `--doc`：飞书文档 URL
- `--slug`：输出文件名前缀
- `--out-dir`：输出目录
- `--as`：`bot` 或 `user`，默认 `bot`
- `--standalone`：额外生成单文件离线版

输出结果：

- `<slug>.html`
- `<slug>-assets/`
- 若传 `--standalone`，额外输出 `<slug>-standalone.html`
