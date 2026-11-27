#!/usr/bin/env python3
"""
Extract the official built-in skill-kit assets (/skill-kit/*) from an upstream
PanPan Workbench Windows NSIS setup executable into a local directory (default:
~/lovart-skill-kit) so `npm run sync:skills` can bundle them identically on
Android, iOS, and macOS without committing upstream assets into git.
"""

from __future__ import annotations

import argparse
import json
import lzma
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

UPSTREAM_REPO = "huang957201826-cyber/panpan-workbench"
PATH_RE = re.compile(rb"/skill-kit/[A-Za-z0-9_./-]+")


def download_latest_setup_exe(dest_path: Path, repo: str = UPSTREAM_REPO) -> Path:
    api_url = f"https://api.github.com/repos/{repo}/releases/latest"
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "panpan-workbench-skill-kit-extractor",
    }
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(api_url, headers=headers)
    with urllib.request.urlopen(req, timeout=60) as resp:
        release = json.loads(resp.read().decode("utf-8"))

    assets = release.get("assets") or []
    exe_asset = next(
        (a for a in assets if str(a.get("name", "")).endswith("_x64-setup.exe")),
        None,
    )
    if not exe_asset:
        raise RuntimeError(f"No *_x64-setup.exe asset found in {repo} latest release")

    dl_url = exe_asset["browser_download_url"]
    print(f"[skill-kit] Downloading {exe_asset['name']} from {repo} ({release.get('tag_name')})...")
    dl_req = urllib.request.Request(dl_url, headers={"User-Agent": headers["User-Agent"]})
    with urllib.request.urlopen(dl_req, timeout=180) as resp, open(dest_path, "wb") as f:
        shutil.copyfileobj(resp, f)
    return dest_path


def decompress_nsis_lzma(exe_bytes: bytes) -> bytes:
    idx = exe_bytes.find(b"NullsoftInst")
    if idx == -1:
        raise RuntimeError("NSIS signature (NullsoftInst) not found in setup executable")
    lzma_start = idx + 20
    props = exe_bytes[lzma_start]
    lc = props % 9
    rem = props // 9
    lp = rem % 5
    pb = rem // 5
    dict_size = int.from_bytes(exe_bytes[lzma_start + 1 : lzma_start + 5], "little")
    dec = lzma.LZMADecompressor(
        format=lzma.FORMAT_RAW,
        filters=[{
            "id": lzma.FILTER_LZMA1,
            "lc": lc,
            "lp": lp,
            "pb": pb,
            "dict_size": dict_size,
        }],
    )
    return dec.decompress(exe_bytes[lzma_start + 5 :])


def extract_brotli_assets(payload: bytes, out_dir: Path) -> int:
    manifest_pos = payload.find(b"/skill-kit/MANIFEST.json")
    if manifest_pos == -1:
        raise RuntimeError("/skill-kit/MANIFEST.json not found in decompressed payload")

    pe_start = -1
    pos = 0
    while True:
        m = payload.find(b"MZ", pos, manifest_pos)
        if m == -1:
            break
        if m + 0x40 < len(payload):
            e_lfanew = struct.unpack_from("<I", payload, m + 0x3C)[0]
            if (
                0 < e_lfanew < 0x1000
                and m + e_lfanew + 26 < len(payload)
                and payload[m + e_lfanew : m + e_lfanew + 4] == b"PE\x00\x00"
                and struct.unpack_from("<H", payload, m + e_lfanew + 24)[0] == 0x20B
            ):
                pe_start = m
        pos = m + 2

    if pe_start == -1:
        raise RuntimeError("Embedded PE32+ executable not found")

    pe = memoryview(payload)[pe_start:]
    e_lfanew = struct.unpack_from("<I", pe, 0x3C)[0]
    num_sections = struct.unpack_from("<H", pe, e_lfanew + 6)[0]
    opt_size = struct.unpack_from("<H", pe, e_lfanew + 20)[0]
    image_base = struct.unpack_from("<Q", pe, e_lfanew + 24 + 24)[0]
    sec_off = e_lfanew + 24 + opt_size
    sections: list[tuple[int, int, int]] = []
    for i in range(num_sections):
        off = sec_off + i * 40
        _, vaddr, rsize, rptr = struct.unpack_from("<IIII", pe, off + 8)
        sections.append((vaddr, rptr, rsize))

    pe_end = max(rptr + rsize for _, rptr, rsize in sections)
    pe_bytes = bytes(pe[:pe_end])

    def off_to_va(foff: int) -> int | None:
        for vaddr, rptr, rsize in sections:
            if rptr <= foff < rptr + rsize:
                return image_base + vaddr + (foff - rptr)
        return None

    def va_to_off(va: int) -> int | None:
        rva = va - image_base
        for vaddr, rptr, rsize in sections:
            if vaddr <= rva < vaddr + rsize:
                return rptr + (rva - vaddr)
        return None

    paths = sorted(set(m.group(0) for m in PATH_RE.finditer(pe_bytes)))
    if not paths:
        raise RuntimeError("No /skill-kit/* asset entries found in PE image")

    extracted = 0
    for key in paths:
        k_pos = 0
        while True:
            k_off = pe_bytes.find(key, k_pos)
            if k_off == -1:
                break
            k_pos = k_off + 1
            k_va = off_to_va(k_off)
            if k_va is None:
                continue
            needle = struct.pack("<QQ", k_va, len(key))
            hit = pe_bytes.find(needle)
            if hit != -1:
                d_va, d_len = struct.unpack_from("<QQ", pe_bytes, hit + 16)
                d_off = va_to_off(d_va)
                if d_off is not None and 0 < d_len < 10_000_000:
                    rel = key.decode("utf-8")[len("/skill-kit/") :]
                    br_path = out_dir / (rel + ".br")
                    br_path.parent.mkdir(parents=True, exist_ok=True)
                    br_path.write_bytes(pe_bytes[d_off : d_off + d_len])
                    extracted += 1
                    break

    if extracted != len(paths):
        raise RuntimeError(f"Only extracted {extracted}/{len(paths)} skill-kit assets")
    return extracted


def decompress_brotli_tree(out_dir: Path) -> None:
    node_script = r"""
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const root = process.argv[1];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.br')) {
      const raw = zlib.brotliDecompressSync(fs.readFileSync(full));
      fs.writeFileSync(full.slice(0, -3), raw);
      fs.unlinkSync(full);
    }
  }
}
walk(root);
"""
    subprocess.run(["node", "-e", node_script, str(out_dir)], check=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--exe", type=Path, help="Local official *_x64-setup.exe path")
    parser.add_argument("--repo", default=UPSTREAM_REPO, help="Upstream GitHub repo")
    parser.add_argument(
        "--out",
        type=Path,
        default=Path.home() / "lovart-skill-kit",
        help="Destination skill-kit directory",
    )
    args = parser.parse_args()

    out_dir: Path = args.out.expanduser().resolve()
    with tempfile.TemporaryDirectory(prefix="panpan-skill-kit-") as tmp:
        tmp_path = Path(tmp)
        exe_path = args.exe.expanduser().resolve() if args.exe else download_latest_setup_exe(tmp_path / "setup.exe", args.repo)
        payload = decompress_nsis_lzma(exe_path.read_bytes())

        stage_dir = tmp_path / "stage"
        stage_dir.mkdir(parents=True, exist_ok=True)
        count = extract_brotli_assets(payload, stage_dir)
        decompress_brotli_tree(stage_dir)

        manifest_path = stage_dir / "MANIFEST.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        skills = manifest.get("skills") or []
        if not skills:
            raise RuntimeError("Extracted MANIFEST.json contains 0 skills")

        if out_dir.exists():
            shutil.rmtree(out_dir)
        shutil.copytree(stage_dir, out_dir)
        print(f"[skill-kit] Extracted {count} files ({len(skills)} skills) to {out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
