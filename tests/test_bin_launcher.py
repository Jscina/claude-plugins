"""The bin/ scripts are POSIX-sh / Python 3 polyglots.

They must run on Windows where `python3` is often the Microsoft Store alias stub (prints
"Python was not found" and exits non-zero) instead of a real interpreter. A plain
`#!/usr/bin/env python3` shebang silently no-ops there. These tests lock the launcher structure so a
refactor cannot revert to the bare shebang, and confirm each file is still a valid Python module
(the shell prologue lives inside the module docstring).
"""
from __future__ import annotations

import ast

import pytest

BIN_SCRIPTS = ["rag-trace", "rag-new-card", "rag-migrate"]


@pytest.mark.parametrize("name", BIN_SCRIPTS)
def test_launcher_is_sh_python_polyglot(rag_bin_dir, name):
    text = (rag_bin_dir / name).read_text(encoding="utf-8")
    lines = text.splitlines()
    # Launches via /bin/sh (the polyglot prologue), not a bare python3 shebang.
    assert lines[0] == "#!/bin/sh"
    assert "/usr/bin/env python3" not in lines[0]
    # Health-checked interpreter resolution: skip any interpreter that fails `-c ""`
    # (that is how the non-working Windows python3 stub gets skipped), and re-exec $0.
    assert '-c ""' in text
    assert 'exec "$_py" "$0" "$@"' in text
    # Fallbacks: real `python`, then the Windows `py -3` launcher.
    assert "for _py in python3 python" in text
    assert "py -3" in text
    # Still a valid Python module (shell prologue is inside the docstring).
    ast.parse(text)


@pytest.mark.parametrize("name", BIN_SCRIPTS)
def test_docstring_precedes_future_import(rag_bin_dir, name):
    """Only one string (the merged prologue+docstring) may precede `from __future__`."""
    module = ast.parse((rag_bin_dir / name).read_text(encoding="utf-8"))
    future = [n for n in module.body if isinstance(n, ast.ImportFrom) and n.module == "__future__"]
    assert future, f"{name} lost its __future__ import"
    # The __future__ import must be the first statement after the docstring.
    assert isinstance(module.body[0], ast.Expr) and isinstance(module.body[0].value, ast.Constant)
    assert module.body[1] is future[0]
