#!/usr/bin/env python3
"""
html2pdf.py - OPTIONAL PDF renderer for homewise output.

homewise's baseline output is self-contained HTML that works on every surface. PDF is an opt-in
enhancement for environments that have a renderer (e.g. Claude Code with Node). It is not on PATH and
is never required: on surfaces without a renderer (e.g. claude.ai) the user prints to PDF from the
browser instead.

Usage:
  python3 html2pdf.py <input.html> [output.pdf]

Render path, in order: $HOMEWISE_HTML2PDF override, a local Chrome/Chromium (headless, --no-sandbox),
wkhtmltopdf, then a cached `node + puppeteer` install. Honors the document's own @media print + @page.

Dependencies: Python 3 stdlib. External renderers are used when present and reported clearly when not.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

# Render script for the node+puppeteer path. Written into the puppeteer cache dir and run there so
# `require('puppeteer')` resolves from the sibling node_modules.
RENDER_CJS = r"""
const puppeteer = require('puppeteer');
(async () => {
  const [, , input, output] = process.argv;
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.goto('file://' + input, { waitUntil: 'networkidle0' });
  await page.pdf({ path: output, format: 'Letter', printBackground: true, preferCSSPageSize: true });
  await browser.close();
})().catch((e) => { console.error(String((e && e.stack) || e)); process.exit(1); });
"""


def _run(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True)


def _have(tool: str) -> bool:
    return shutil.which(tool) is not None


def _chrome_binary() -> str | None:
    for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser",
                 "chrome", "brave-browser", "microsoft-edge"):
        if _have(name):
            return name
    return None


def _result(code: int, out: Path, via: str) -> int:
    if code == 0 and out.is_file():
        print(f"homewise: wrote {out} (via {via})")
        return 0
    print(f"homewise: error: PDF generation failed (via {via})", file=sys.stderr)
    return 1


def main(argv: list[str] | None = None) -> int:
    argv = argv if argv is not None else sys.argv[1:]
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__.strip())
        return 0 if argv else 2
    src = Path(argv[0]).expanduser().resolve()
    if not src.is_file():
        print(f"homewise: error: not a file: {src}", file=sys.stderr)
        return 2
    out = Path(argv[1]).expanduser().resolve() if len(argv) > 1 else src.with_suffix(".pdf")
    out.parent.mkdir(parents=True, exist_ok=True)

    # 1) explicit override - run as: <cmd> <in> <out> (through a shell, so a pipeline works)
    override = os.environ.get("HOMEWISE_HTML2PDF")
    if override:
        r = subprocess.run(f'{override} "{src}" "{out}"', shell=True)
        return _result(r.returncode, out, "$HOMEWISE_HTML2PDF")

    # 2) local Chrome/Chromium headless - honors @media print + @page in the doc's own CSS
    chrome = _chrome_binary()
    if chrome:
        r = _run([chrome, "--headless=new", "--no-sandbox", "--disable-gpu",
                  f"--print-to-pdf={out}", "--no-pdf-header-footer", src.as_uri()])
        if r.returncode == 0 and out.is_file():
            return _result(0, out, chrome)

    # 3) wkhtmltopdf
    if _have("wkhtmltopdf"):
        r = _run(["wkhtmltopdf", "--print-media-type", "--enable-local-file-access",
                  str(src), str(out)])
        if r.returncode == 0 and out.is_file():
            return _result(0, out, "wkhtmltopdf")

    # 4) node + puppeteer, installed once into a cache dir (downloads Chromium on first run)
    if _have("npm") and _have("node"):
        cache = Path(os.environ.get("XDG_CACHE_HOME", str(Path.home() / ".cache"))) / "homewise"
        cache.mkdir(parents=True, exist_ok=True)
        if not (cache / "node_modules" / "puppeteer").exists():
            print("homewise: installing puppeteer for PDF rendering (one-time, downloads Chromium - slow)...",
                  file=sys.stderr)
            subprocess.run(["npm", "install", "puppeteer@latest", "--prefix", str(cache),
                            "--no-fund", "--no-audit", "--loglevel", "error"])
        if (cache / "node_modules" / "puppeteer").exists():
            script = cache / "render-pdf.cjs"
            script.write_text(RENDER_CJS, encoding="utf-8")
            r = subprocess.run(["node", str(script), str(src), str(out)])
            if r.returncode == 0 and out.is_file():
                return _result(0, out, "node+puppeteer")

    print("homewise: error: no HTML->PDF renderer available. Install a browser (chromium/chrome) or "
          "wkhtmltopdf, ensure `npm`/`node` are on PATH, or set $HOMEWISE_HTML2PDF. The HTML is complete "
          "and print-ready - open it and use Print > Save as PDF instead.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
