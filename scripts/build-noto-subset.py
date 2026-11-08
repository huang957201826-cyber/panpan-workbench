"""重建内置 UI 中文字体的 OFL 子集版（woff2）。

背景：原内置字体 HarmonyOS Sans SC（3 个 TTF，约 23.6 MiB）许可第 2 条禁止修改，
无法子集化、无法转 woff2。本脚本改用 SIL OFL 1.1 的 Noto Sans SC，子集化后
改名为衍生族名 "Noto Sans SC Subset"（OFL 第 3 条 / RFN 要求），并同步 name 表。

字体源（google/fonts 单文件变量字体，wght 轴 100-900）：
    页面：https://github.com/google/fonts/blob/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf
    raw ：https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf
    备用（noto-cjk 静态 OTF，同样 OFL 1.1）：
    https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf
许可证：SIL Open Font License 1.1
    https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/OFL.txt
    版权声明：Copyright 2014-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'
    （衍生版族名不含保留名 'Source'，且加 "Subset" 后缀，符合 OFL 第 3 条）

复现步骤：
    curl -fL -o /tmp/NotoSansSC-VF.ttf \
        "https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf"
    python scripts/build-noto-subset.py --source /tmp/NotoSansSC-VF.ttf
依赖：pip install fonttools brotli

字符集 = ASCII + 中文/全角标点 + GB2312 一级汉字(3755) + 遍历
src/**/*.tsx、src/**/*.ts、src/assets/*.txt、README.md（并含 docs/execution/*.md）
中出现的所有非 ASCII 字符。思路与 scripts/build-font-subset.py（Maple Mono）一致。

产物：
    fonts/NotoSansSC-Subset-Regular.woff2  变量字体，保留 wght 轴 100-900（主资产，CSS 引用）
    fonts/NotoSansSC-Subset-Medium.woff2   静态实例 wght=500（一并输出）
    fonts/NotoSansSC-Subset-Bold.woff2     静态实例 wght=700（一并输出）
源为变量字体，故主文件保留字重轴：同一 woff2 通过 CSS `font-weight: 100 900`
即可真实呈现 Regular/Medium/Bold 等字重，无需 font-synthesis。若源换成静态 OTF，
则只产出 Regular，需在 CSS 里用 font-synthesis 处理粗体。
"""
from __future__ import annotations

import argparse
import pathlib

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = pathlib.Path(__file__).resolve().parent.parent
FAMILY = "Noto Sans SC Subset"
PS = "NotoSansSCSubset"

# 通用标点 / 特殊符号补充（与 build-font-subset.py 保持一致）
PUNCT = {
    0x00A0, 0x00B7, 0x00D7, 0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D,
    0x2022, 0x2026, 0x2190, 0x2192, 0x2605, 0x2606, 0x2713, 0x2717,
}

# 任务指定：src/**/*.tsx、src/**/*.ts、src/assets/*.txt、README.md
# 附带 docs/execution/*.md，沿用现有脚本的文档扫描范围，避免漏字
SOURCE_PATTERNS = (
    "src/**/*.tsx",
    "src/**/*.ts",
    "src/assets/*.txt",
    "README.md",
    "docs/execution/*.md",
)


def source_literals() -> set[str]:
    found: set[str] = set()
    for pattern in SOURCE_PATTERNS:
        for path in ROOT.glob(pattern):
            try:
                found.update(
                    c for c in path.read_text(encoding="utf-8", errors="ignore")
                    if ord(c) > 127
                )
            except OSError:
                pass
    return found


def gb2312_level1() -> set[str]:
    """GB2312 一级汉字（3755 个，按区位 0xB0A1-0xD7F9 解码）。"""
    hanzi: set[str] = set()
    for high in range(0xB0, 0xD8):
        for low in range(0xA1, 0xFF):
            try:
                char = bytes([high, low]).decode("gb2312")
            except UnicodeDecodeError:
                continue
            if "\u4e00" <= char <= "\u9fff":
                hanzi.add(char)
    return hanzi


def build_charset(cmap: set[int]) -> str:
    wanted = (
        set(range(0x20, 0x7F))          # ASCII 可打印
        | set(range(0x3000, 0x3040))    # CJK 标点
        | set(range(0xFF01, 0xFF61))    # 全角字符
        | PUNCT                          # 常用标点 / 符号
        | {ord(c) for c in source_literals()}
        | {ord(c) for c in gb2312_level1()}
    )
    return "".join(chr(code) for code in sorted(wanted & cmap))


def rename(font: TTFont) -> None:
    """OFL 衍生版不得冒用原字体名；同步 name 表全部平台记录。"""
    for record in font["name"].names:
        try:
            value = record.toUnicode()
        except Exception:
            continue
        nid = record.nameID
        if nid in (1, 4, 16):            # Family / Full name / Typographic Family
            new = FAMILY
        elif nid == 6:                   # PostScript name（不含空格）
            new = f"{PS}-Regular"
        elif nid == 3:                   # Unique ID
            new = f"{value}; subsetted"
        else:
            new = value.replace("Noto Sans SC", FAMILY).replace("NotoSansSC", PS)
        if new != value:
            try:
                record.string = new.encode(record.getEncoding())
            except UnicodeEncodeError:
                pass


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, help="官方原版 ttf/otf/woff2 路径")
    parser.add_argument(
        "--output",
        default=str(ROOT / "fonts/NotoSansSC-Subset-Regular.woff2"),
        help="主输出（变量字体 woff2）路径",
    )
    args = parser.parse_args()

    source = pathlib.Path(args.source)
    output = pathlib.Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)

    cmap = set(TTFont(source).getBestCmap())
    charset = build_charset(cmap)

    options = subset.Options()
    options.flavor = "woff2"
    options.hinting = False
    options.notdef_outline = True
    options.layout_features = []          # 与 build-font-subset.py 一致，去掉 GSUB/GPOS
    options.name_IDs = ["*"]              # 保留变量字体命名实例 / STAT 需要的 name 记录

    font = subset.load_font(str(source), options)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=charset)
    subsetter.subset(font)
    rename(font)

    # 主资产：变量字体（保留 wght 轴）。先做静态实例再保存，避免 save_font 改动 flavor。
    static: list[tuple[TTFont, str]] = []
    if "fvar" in font:
        for weight, suffix in ((500, "Medium"), (700, "Bold")):
            static.append(
                (instancer.instantiateVariableFont(font, {"wght": weight}, inplace=False, optimize=True), suffix)
            )

    subset.save_font(font, str(output), options)
    print(f"[variable] charset={len(charset)} size={output.stat().st_size / 1024:.1f} KiB -> {output}")

    for inst, suffix in static:
        path = output.parent / f"NotoSansSC-Subset-{suffix}.woff2"
        subset.save_font(inst, str(path), options)
        print(f"[static wght] size={path.stat().st_size / 1024:.1f} KiB -> {path}")

    if not static:
        print("源非变量字体：仅产出 Regular，CSS 需自行用 font-synthesis 处理粗体。")


if __name__ == "__main__":
    main()
