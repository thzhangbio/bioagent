/**
 * 碎片规则回归用例：在 {@link mineru-kb.ts} 增加/修改规则后，在此添加 `input`（完整短 `$…$`）与 `expected`（归一后全文），
 * 运行 `pnpm run pdf-kb-fragment-fixtures` 验证。
 */
export interface KbFragmentFixture {
  input: string;
  expected: string;
}

export const KB_FRAGMENT_FIXTURES: KbFragmentFixture[] = [
  {
    input:
      "$( 95 \\% \\mathrm { { H P D } } 3.39 \\times 10 ^ { - 5 } \\mathrm { { t o } } 7.46 \\times 10 ^ { - 5 } ) ^ { 18 }$",
    expected:
      "(95% HPD 3.39×10^-5 to 7.46×10^-5)^18",
  },
  {
    input: "$S L C 30 A 8 ^ { - / - }$",
    expected: "SLC30A8−/−",
  },
  {
    input: "$(30^{\\circ}C)$",
    expected: "(30°C)",
  },
  {
    input: "$50 \\mu m$",
    expected: "50 μm",
  },
  {
    input: "$10 \\mu M$",
    expected: "10 μM",
  },
  {
    input: "$Ebf2$",
    expected: "Ebf2",
  },
  {
    input: "$Pgc1\\alpha$",
    expected: "Pgc1α",
  },
  {
    input: "$^ +$",
    expected: "⁺",
  },
  {
    input: "$\\beta 3$",
    expected: "β3",
  },
  {
    input: "$^{\\Delta \\mathrm{IDR}}$",
    expected: "^ΔIDR",
  },
  {
    input: "$300 \\times 9$",
    expected: "300×9",
  },
  {
    input: "$1\\mathrm{nM}$",
    expected: "1 nM",
  },
  {
    input: "$30\\mathrm{min}$",
    expected: "30 min",
  },
  {
    input: "$\\mathrm{VO}_2$",
    expected: "VO₂",
  },
  {
    input: "$\\mathrm{VCO}_2$",
    expected: "VCO₂",
  },
  {
    input: "$9.7 \\pm 3.6$",
    expected: "9.7±3.6",
  },
  {
    input: "$\\geq 10^{\\circ}C$",
    expected: "≥10°C",
  },
  {
    input: "$50 ~ \\mu \\ g / \\mathrm { mL }$",
    expected: "50 μg/mL",
  },
  {
    input: "$P$",
    expected: "P",
  },
  {
    input: "$(Dlk1, Ly6a)$",
    expected: "(Dlk1, Ly6a)",
  },
  {
    input: "$Runx1^{fl/f}$",
    expected: "Runx1^fl/f",
  },
  {
    input: "$300g$",
    expected: "300 g",
  },
];
