import type { DynamicCardField } from "../agent/workflows/content-create-card-llm.js";

function plain(s: string): { tag: "plain_text"; content: string } {
  return { tag: "plain_text", content: s };
}

function selectOptions(opts: { label: string; value: string }[]) {
  return opts.map((o) => ({
    text: plain(o.label),
    value: o.value,
  }));
}

/**
 * 飞书消息卡片 1.0（interactive）。
 * 所有下拉与提交必须在 **tag: "form"** 容器内，且提交按钮 **action_type: "form_submit"**，
 * 否则点击后不会聚合 form_value，服务端无法收到选项。
 * @see https://open.feishu.cn/document/feishu-cards/card-components/containers/form-container
 */
export function buildContentCreateInteractiveCard(params: {
  sessionId: string;
  originalRequestPreview: string;
  dynamicFields: DynamicCardField[];
}): Record<string, unknown> {
  const { sessionId, originalRequestPreview, dynamicFields } = params;

  const submitPayload = {
    action: "content_create_submit",
    session_id: sessionId,
  };

  /** 表单项必须直接挂在 form.elements 下，才能随 form_submit 进入 form_value */
  const formInner: Record<string, unknown>[] = [
    {
      tag: "select_static",
      name: "cc_audience",
      placeholder: plain("受众"),
      options: selectOptions([
        { label: "大众 / 患者科普", value: "public" },
        { label: "医疗专业人士（HCP）", value: "hcp" },
      ]),
    },
    {
      tag: "select_static",
      name: "cc_deliverable",
      placeholder: plain("稿型"),
      options: selectOptions([
        { label: "内审草稿（可后置合规）", value: "draft" },
        { label: "对外终稿", value: "final" },
      ]),
    },
    {
      tag: "select_static",
      name: "cc_brand_stance",
      placeholder: plain("品牌/品名"),
      options: selectOptions([
        { label: "不出现具体商品名", value: "no_brand" },
        { label: "通用名/机制表述，可谨慎", value: "generic" },
        { label: "可适度点名（审慎合规）", value: "naming_ok" },
      ]),
    },
    {
      tag: "select_static",
      name: "cc_voice",
      placeholder: plain("叙事身份"),
      options: selectOptions([
        { label: "KOL / 种草感", value: "kol" },
        { label: "机构 / 科普", value: "institution" },
        { label: "中立第三方", value: "neutral" },
      ]),
    },
    {
      tag: "select_static",
      name: "cc_delegate",
      placeholder: plain("其余细节"),
      options: selectOptions([
        { label: "其余由编辑默认（不再追问）", value: "yes" },
        { label: "我仍要补充细节（聊天说明）", value: "no" },
      ]),
    },
  ];

  for (const d of dynamicFields) {
    formInner.push({
      tag: "select_static",
      name: d.id,
      placeholder: plain(d.title),
      options: selectOptions(d.options),
    });
  }

  formInner.push({
    tag: "button",
    action_type: "form_submit",
    name: "ccf_submit",
    text: {
      tag: "lark_md",
      content: "细节已明，开始生成",
    },
    type: "primary",
    value: submitPayload,
  });

  return {
    config: { wide_screen_mode: true },
    header: {
      template: "blue",
      title: { tag: "plain_text", content: "撰稿参数确认" },
    },
    elements: [
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `**内容创作 — 结构化确认**\n请在下方面板内选择后点「开始生成」。\n\n**任务摘要**：${escapeMd(originalRequestPreview.slice(0, 200))}${originalRequestPreview.length > 200 ? "…" : ""}`,
        },
      },
      { tag: "hr" },
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: "**【常规项】与【补充项】**（均在下方表单内提交）",
        },
      },
      {
        tag: "form",
        name: "content_create_form_v1",
        elements: formInner,
      },
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content:
            "**合规提示**：处方药/功效表述以审慎为原则；对外终稿投放前请走客户合规流程。",
        },
      },
    ],
  };
}

function escapeMd(s: string): string {
  return s.replace(/[*#[\]`]/g, "");
}
