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
  {
    input: "$2022 ^ { 8, 9 }$",
    expected: "2022^8,9",
  },
  {
    input: "$ { \\mathrm { I I b } } ^ { 2, 3 }$",
    expected: "IIb^2,3",
  },
  {
    input: "$1^{*}10^{13}\\mathrm{Vg / ml}$",
    expected: "1×10^13 Vg/ml",
  },
  {
    input: "$1 \\mathsf { c m } ^ { 3 }$",
    expected: "1 cm^3",
  },
  {
    input: "$1 \\mathrm{~h}$",
    expected: "1 h",
  },
  {
    input: "$3.34 ~ \\mathsf { m L }$",
    expected: "3.34 mL",
  },
  {
    input: "$100 ~ \\mu \\ L$",
    expected: "100 μL",
  },
  {
    input: "$0.125M$",
    expected: "0.125 M",
  },
  {
    input: "$1.5x$",
    expected: "1.5×",
  },
  {
    input: "$( 1 \\% 0 _ { 2 } )$",
    expected: "(1% O₂)",
  },
  {
    input: "$40 { - } 60 \\%$",
    expected: "40-60%",
  },
  {
    input: "$\\left|\\mathrm{FC}\\right| \\geq 1.5$",
    expected: "|FC| ≥ 1.5",
  },
  {
    input: "$c . 3019 G \\mathrm { > A }$",
    expected: "c.3019 G>A",
  },
  {
    input: "${ \\sf H } _ { 2 } { \\sf O } _ { 2 }$",
    expected: "H₂O₂",
  },
  {
    input: "$(1\\mathrm{mg / kg})$",
    expected: "(1 mg/kg)",
  },
  {
    input: "$( 1 \\mu g)$",
    expected: "(1 μg)",
  },
  {
    input: "$3548 ~ \\mu g / L ;$",
    expected: "3548 μg/L",
  },
  {
    input: "$10 \\mu \\ M$",
    expected: "10 μM",
  },
  {
    input: "$50 \\mu m ;$",
    expected: "50 μm",
  },
  {
    input: "$7, 10, 110 { - } 119$",
    expected: "7,10,110-119",
  },
  {
    input: "$\\mathbf { \\sigma } \\cdot \\kappa B$",
    expected: "σ·κB",
  },
  {
    input: "$\\mu \\mathrm { B C A }$",
    expected: "μBCA",
  },
  {
    input: "$( \\boldsymbol { \\| } )$",
    expected: "(I)",
  },
  {
    input: "$\\cdot D A ^ { + }$",
    expected: "·DA+",
  },
  {
    input: "$( I N S ^ { w / G F P } )$",
    expected: "(INS^w/GFP)",
  },
  {
    input: "$11 S ^ { + } \\mathrm { ~ \\beta ~ }$",
    expected: "11S+ β",
  },
  {
    input: "$1g$",
    expected: "1 g",
  },
  {
    input: "${ 20 ~ 9 }$",
    expected: "20 g",
  },
  {
    input: "${ \\mathrm { c . 1303 C { > } T } }$",
    expected: "c.1303 C>T",
  },
];
