"""Shared fixtures for the repo-root test suite.

Characterizes the `rag` plugin's bin/ scripts. Those scripts are executables without a
.py extension, so they're imported by path via SourceFileLoader (a normal `import`
won't find them). Dev-only: the suite needs pytest, but the shipped plugin code stays
standard-library-only and pytest is never bundled.
"""
from __future__ import annotations

import importlib.util
from importlib.machinery import SourceFileLoader
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
RAG_PLUGIN = REPO_ROOT / "plugins" / "rag"
RAG_BIN = RAG_PLUGIN / "bin"


def _load_script(filename: str):
    """Import an extension-less bin/ script as a module, by path."""
    mod_name = "rag_bin_" + filename.replace("-", "_")
    loader = SourceFileLoader(mod_name, str(RAG_BIN / filename))
    spec = importlib.util.spec_from_loader(mod_name, loader)
    module = importlib.util.module_from_spec(spec)
    loader.exec_module(module)
    return module


@pytest.fixture(scope="session")
def rag_new_card():
    return _load_script("rag-new-card")


@pytest.fixture(scope="session")
def rag_migrate():
    return _load_script("rag-migrate")


@pytest.fixture(scope="session")
def rag_trace():
    return _load_script("rag-trace")


@pytest.fixture(scope="session")
def rag_bin_dir() -> Path:
    return RAG_BIN


@pytest.fixture(scope="session")
def card_templates_dir() -> Path:
    return RAG_PLUGIN / "skills" / "card" / "templates"


@pytest.fixture(scope="session")
def init_templates_dir() -> Path:
    return RAG_PLUGIN / "skills" / "init" / "templates"


@pytest.fixture
def empty_corpus(tmp_path) -> Path:
    """A minimal corpus root: the issues/ lifecycle dirs (enough for find_corpus_root
    and rag-new-card). No meta, no system docs."""
    root = tmp_path / "rag-memory"
    for d in ("issues/active", "issues/backlog", "issues/done", "issues/archive"):
        (root / d).mkdir(parents=True)
    return root
