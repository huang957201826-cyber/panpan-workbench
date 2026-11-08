"""重建内置等宽字体的子集版（SIL OFL 1.1 允许修改衍生，需改名）。

用法：
    python scripts/build-font-subset.py --source <原版 woff2> --output fonts/MapleMono-NF-CN-Regular.woff2

原版来源：https://github.com/subframe7536/maple-font/releases （v7.9 NF CN Regular）
当前仓库里的 fonts/MapleMono-NF-CN-Regular.woff2 已是本脚本产出的子集版；
如需重建，先从上游下载原版，或从 git 历史中取回：
    git show <旧提交>:fonts/MapleMono-NF-CN-Regular.woff2 > /tmp/maple-full.woff2

字符集 = ASCII + CJK/全角标点 + 源码与文档中出现的非 ASCII 字符 + GB2312 一级汉字（3755）。
Nerd Font PUA 图标不包含（源码里没有使用），缺字会回退到系统等宽字体，不会显示豆腐块。

依赖：pip install fonttools brotli
"""
from __future__ import annotations

import argparse
import pathlib

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
FAMILY = "Maple Mono NF CN Subset"

PUNCT = {
    0x00A0, 0x00B7, 0x00D7, 0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D,
    0x2022, 0x2026, 0x2190, 0x2192, 0x2605, 0x2606, 0x2713, 0x2717,
}


def source_literals() -> set[str]:
    found: set[str] = set()
    for pattern in ("src/**/*.tsx", "src/**/*.ts", "docs/execution/*.md", "src/assets/*.txt"):
        for path in ROOT.glob(pattern):
            try:
                found.update(c for c in path.read_text(encoding="utf-8", errors="ignore") if ord(c) > 127)
            except OSError:
                pass
    return found


def gb2312_level1() -> set[str]:
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
        set(range(0x20, 0x7F))
        | set(range(0x3000, 0x3040))
        | set(range(0xFF01, 0xFF61))
        | PUNCT
        | {ord(c) for c in source_literals()}
        | {ord(c) for c in gb2312_level1()}
    )
    return "".join(chr(code) for code in sorted(wanted & cmap))


def rename(font: TTFont) -> None:
    """OFL 衍生版不得冒用原字体名。"""
    for record in font["name"].names:
        try:
            value = record.toUnicode()
        except Exception:
            continue
        if record.nameID in (1, 4, 6):
            replacement = value.replace("Maple Mono NF CN", FAMILY).replace("MapleMono-NF-CN", "MapleMono-NF-CN-Subset")
            if replacement != value:
                record.string = replacement.encode(record.getEncoding())
        elif record.nameID == 3:
            record.string = f"{value}; subsetted".encode(record.getEncoding())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, help="官方原版 woff2/ttf 路径")
    parser.add_argument("--output", default=str(ROOT / "fonts/MapleMono-NF-CN-Regular.woff2"))
    args = parser.parse_args()

    source = pathlib.Path(args.source)
    output = pathlib.Path(args.output)
    cmap = set(TTFont(source).getBestCmap())
    charset = build_charset(cmap)

    options = subset.Options()
    options.flavor = "woff2"
    options.hinting = False
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6]
    options.layout_features = []
    options.notdef_outline = True

    font = subset.load_font(str(source), options)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=charset)
    subsetter.subset(font)
    rename(font)
    subset.save_font(font, str(output), options)

    print(f"charset={len(charset)} size={output.stat().st_size / 1024:.1f} KiB -> {output}")


if __name__ == "__main__":
    main()
