import type { WechatArticleMeta } from "../shared/wechat-meta.js";
import type { WechatSourceProfile } from "../stage-shared.js";

export function detectWechatSourceProfile(
  meta: WechatArticleMeta,
): WechatSourceProfile {
  const mpName = meta.mp_name?.trim() ?? "";
  if (/梅斯/.test(mpName)) return "medsci";
  if (/良医/.test(mpName)) return "liangyi_hui";
  return "generic_wechat";
}

export function inferWechatStyleVariantFromProfile(
  profile: WechatSourceProfile,
): string | undefined {
  if (profile === "medsci") return "medsci";
  if (profile === "liangyi_hui") return "liangyi_hui";
  return undefined;
}
