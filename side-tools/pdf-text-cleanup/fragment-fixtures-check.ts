/**
 * 校验 {@link KB_FRAGMENT_FIXTURES} 与当前 {@link normalizeMineruInlineLatex} 行为一致。
 */
import { normalizeMineruInlineLatex } from "./mineru-kb.js";
import { KB_FRAGMENT_FIXTURES } from "./fragment-fixtures.js";

function main(): void {
  if (KB_FRAGMENT_FIXTURES.length === 0) {
    console.log("KB_FRAGMENT_FIXTURES 为空；在 fragment-fixtures.ts 添加用例后重试。");
    process.exit(0);
  }
  let failed = 0;
  for (const { input, expected } of KB_FRAGMENT_FIXTURES) {
    const got = normalizeMineruInlineLatex(input);
    if (got !== expected) {
      console.error("FAIL", { input, expected, got });
      failed++;
    }
  }
  if (failed === 0)
    console.log(`OK: ${KB_FRAGMENT_FIXTURES.length} 条碎片夹具通过。`);
  process.exit(failed ? 1 : 0);
}

main();
