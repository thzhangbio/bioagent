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

/** 飞书客户端 ≥ V7.9 才完整展示折叠面板；低版本可能显示升级提示 */
const WORKFLOW_MODE_HELP =
  "我将给你一个关于写作主题的多选项内容卡片，勾选沟通完成，以飞书文档的形式交付文章，后续可改。";

/**
 * 进入结构化撰稿前的确认卡片：Yes / No + 可折叠「工作流模式说明」。
 */
export function buildContentCreateConsentCard(params: {
  consentId: string;
  /** 展示在文案中的工作流名称，如「内容创作」 */
  workflowName: string;
}): Record<string, unknown> {
  const { consentId, workflowName } = params;

  const consentPayload = (choice: "yes" | "no") => ({
    action: "content_create_consent",
    choice,
    consent_id: consentId,
  });

  return {
    config: { wide_screen_mode: true },
    header: {
      template: "wathet",
      title: { tag: "plain_text", content: "是否进入创作工作流" },
    },
    elements: [
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `你想进入 **${escapeMd(workflowName)}** 工作流吗？\n选 **Yes**，我们进入**创作工作模式**（结构化卡片 + 飞书文档交付）。`,
        },
      },
      {
        tag: "collapsible_panel",
        expanded: false,
        header: {
          title: {
            tag: "plain_text",
            content: "该工作流模式说明",
          },
        },
        elements: [
          {
            tag: "div",
            text: {
              tag: "plain_text",
              content: WORKFLOW_MODE_HELP,
            },
          },
        ],
      },
      { tag: "hr" },
      {
        tag: "action",
        actions: [
          {
            tag: "button",
            type: "primary_filled",
            size: "medium",
            text: {
              tag: "plain_text",
              content: "Yes",
            },
            behaviors: [
              {
                type: "callback",
                value: consentPayload("yes"),
              },
            ],
          },
          {
            tag: "button",
            type: "default",
            size: "medium",
            text: {
              tag: "plain_text",
              content: "No",
            },
            behaviors: [
              {
                type: "callback",
                value: consentPayload("no"),
              },
            ],
          },
        ],
      },
    ],
  };
}
