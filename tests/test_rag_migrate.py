"""Characterization + spec tests for bin/rag-migrate.

Phase 1 locked the doc-pass baseline. Phase 2 (v0.5.0 rework) reintroduces a deterministic,
NO-PARSE card pass and a per-kind format_gen meta map; read_corpus_gen's contract changes from
a flat int to {doc, card}. These tests SPECIFY that new behavior (written test-first). The reused
doc-pass machinery (_ensure_format_gen sweep/stamp, body-preservation) must stay green.
"""
from __future__ import annotations

import json

import pytest


# --- _ensure_format_gen: the plugin_schema -> format_gen sweep + stamp (REUSED AS-IS) -

def test_sweep_plugin_schema_to_format_gen_same_value(rag_migrate):
    out = rag_migrate._ensure_format_gen("---\nplugin_schema: 3\n---\nbody line\n", 3)
    assert out is not None
    assert "format_gen: 3" in out
    assert "plugin_schema" not in out
    assert out.endswith("---\nbody line\n")


def test_format_gen_at_target_is_idempotent(rag_migrate):
    assert rag_migrate._ensure_format_gen("---\nformat_gen: 3\n---\nbody\n", 3) is None


def test_sweep_and_bump_when_behind(rag_migrate):
    out = rag_migrate._ensure_format_gen("---\nplugin_schema: 2\n---\nbody\n", 3)
    assert out is not None
    assert "format_gen: 3" in out and "plugin_schema" not in out


def test_insert_format_gen_after_status(rag_migrate):
    out = rag_migrate._ensure_format_gen("---\nstatus: active\ntags: []\n---\nB\n", 3)
    assert out is not None
    head = out.split("---")[1]
    assert head.index("status:") < head.index("format_gen:") < head.index("tags:")


def test_ensure_format_gen_ignores_non_frontmatter(rag_migrate):
    assert rag_migrate._ensure_format_gen("no header here\n", 3) is None


# --- read_corpus_gen: NEW per-kind {doc, card} contract -------------------------------

@pytest.mark.parametrize("meta, expected", [
    ({"format_gen": {"doc": 3, "card": 1}, "plugin": "rag"}, {"doc": 3, "card": 1}),
    ({"format_gen": {"doc": 3}}, {"doc": 3, "card": 0}),          # missing kind -> 0
    ({"format_gen": 3}, {"doc": 3, "card": 0}),                    # legacy flat int = doc gen
    ({"plugin_schema": 3}, {"doc": 3, "card": 0}),                 # legacy 0.4.0 key
    ({"schema": 2}, {"doc": 2, "card": 0}),                        # legacy <=0.3.0 key
    ({"plugin": "rag"}, {"doc": 0, "card": 0}),                    # no generation key
])
def test_read_corpus_gen_per_kind(rag_migrate, tmp_path, meta, expected):
    (tmp_path / ".rag-meta.json").write_text(json.dumps(meta), encoding="utf-8")
    assert rag_migrate.read_corpus_gen(tmp_path) == expected


def test_read_corpus_gen_missing_meta_is_zero(rag_migrate, tmp_path):
    assert rag_migrate.read_corpus_gen(tmp_path) == {"doc": 0, "card": 0}


def test_read_corpus_gen_invalid_json_is_zero(rag_migrate, tmp_path):
    (tmp_path / ".rag-meta.json").write_text("{not json", encoding="utf-8")
    assert rag_migrate.read_corpus_gen(tmp_path) == {"doc": 0, "card": 0}


# --- corpus fixtures ------------------------------------------------------------------

@pytest.fixture
def migrate_corpus(tmp_path):
    root = tmp_path / "rag-memory"
    for d in ("issues/active", "issues/backlog", "issues/done", "issues/archive",
              "system/known-behaviors"):
        (root / d).mkdir(parents=True)
    return root


def _write_card(root, lifecycle, name, context_text, *, with_trace=False, with_bench=False):
    d = root / "issues" / lifecycle / name
    d.mkdir(parents=True, exist_ok=True)
    (d / "context.md").write_text(context_text, encoding="utf-8")
    if with_trace:
        (d / "trace.md").write_text(
            "---\ndate: 2026-01-01 00:00\nsession: manual\ntype: finding\n---\nentry\n",
            encoding="utf-8")
    if with_bench:
        (d / "benchmarks.md").write_text("# Benchmark Moments\n\n---\nstatus: pending\n---\n",
                                         encoding="utf-8")
    return d


# --- NEW: deterministic, no-parse CARD pass -------------------------------------------

def test_card_pass_bootstraps_headerless_context_from_dir_name(
        rag_migrate, migrate_corpus, init_templates_dir):
    # Body deliberately claims a DIFFERENT id, to prove the stamp does NOT parse the body.
    card = _write_card(
        migrate_corpus, "active", "CARD-REAL",
        "# CARD-REAL\n\n## Issue Summary\n- **Card ID**: CARD-BOGUS\n- **Source**: ado\n\nbody text\n")
    rc = rag_migrate.main(["--root", str(migrate_corpus),
                           "--templates-dir", str(init_templates_dir), "--apply"])
    assert rc == 0
    text = (card / "context.md").read_text(encoding="utf-8")
    assert text.startswith("---")
    head = text.split("---", 2)[1]
    assert "card_id: CARD-REAL" in head            # id is the DIRECTORY name
    assert "CARD-BOGUS" not in head                  # body was NOT parsed
    assert "format_gen: 1" in head
    assert 'title: ""' in head
    assert "body text" in text                       # body preserved
    assert "CARD-BOGUS" in text                      # body untouched (id still there)


def test_card_pass_idempotent_on_current_card(rag_migrate, migrate_corpus, init_templates_dir):
    hdr = ('---\ncard_id: CARD-X\ntitle: ""\nopened:\nclosed:\nformat_gen: 1\ntags: []\n---\n'
           '\n# CARD-X\nbody\n')
    card = _write_card(migrate_corpus, "done", "CARD-X", hdr)
    rag_migrate.main(["--root", str(migrate_corpus),
                      "--templates-dir", str(init_templates_dir), "--apply"])
    assert (card / "context.md").read_text(encoding="utf-8") == hdr   # byte-unchanged
    assert rag_migrate.main(["--root", str(migrate_corpus),
                             "--templates-dir", str(init_templates_dir), "--check"]) == 0


def test_card_pass_sweeps_plugin_schema_in_card(rag_migrate, migrate_corpus, init_templates_dir):
    card = _write_card(migrate_corpus, "backlog", "CARD-Y",
                       '---\ncard_id: CARD-Y\nplugin_schema: 1\ntags: []\n---\n\nbody\n')
    rag_migrate.main(["--root", str(migrate_corpus),
                      "--templates-dir", str(init_templates_dir), "--apply"])
    head = (card / "context.md").read_text(encoding="utf-8").split("---", 2)[1]
    assert "format_gen: 1" in head and "plugin_schema" not in head


def test_card_pass_walks_all_lifecycle_dirs(rag_migrate, migrate_corpus, init_templates_dir):
    for state in ("active", "backlog", "done", "archive"):
        _write_card(migrate_corpus, state, f"CARD-{state}", f"# CARD-{state}\n\nbody\n")
    rag_migrate.main(["--root", str(migrate_corpus),
                      "--templates-dir", str(init_templates_dir), "--apply"])
    for state in ("active", "backlog", "done", "archive"):
        text = (migrate_corpus / "issues" / state / f"CARD-{state}" / "context.md").read_text()
        assert text.startswith("---") and f"card_id: CARD-{state}" in text.split("---", 2)[1]


def test_card_pass_leaves_trace_and_benchmarks_untouched(
        rag_migrate, migrate_corpus, init_templates_dir):
    card = _write_card(migrate_corpus, "active", "CARD-Z", "# CARD-Z\n\nbody\n",
                       with_trace=True, with_bench=True)
    trace_before = (card / "trace.md").read_text(encoding="utf-8")
    bench_before = (card / "benchmarks.md").read_text(encoding="utf-8")
    rag_migrate.main(["--root", str(migrate_corpus),
                      "--templates-dir", str(init_templates_dir), "--apply"])
    assert (card / "trace.md").read_text(encoding="utf-8") == trace_before
    assert (card / "benchmarks.md").read_text(encoding="utf-8") == bench_before
    assert (card / "context.md").read_text(encoding="utf-8").startswith("---")


def test_card_walk_skips_non_dirs_and_hidden(rag_migrate, migrate_corpus, init_templates_dir):
    # a stray AppleDouble FILE + a hidden dir must not break the walk
    (migrate_corpus / "issues" / "active" / "._CARD-APPLEDOUBLE").write_text("junk", encoding="utf-8")
    (migrate_corpus / "issues" / "active" / ".hidden").mkdir()
    rc = rag_migrate.main(["--root", str(migrate_corpus),
                           "--templates-dir", str(init_templates_dir), "--apply"])
    assert rc == 0


# --- per-kind meta map + end-to-end ---------------------------------------------------

def test_meta_is_per_kind_map_after_apply(rag_migrate, migrate_corpus, init_templates_dir):
    rag_migrate.main(["--root", str(migrate_corpus),
                      "--templates-dir", str(init_templates_dir), "--apply"])
    meta = json.loads((migrate_corpus / ".rag-meta.json").read_text(encoding="utf-8"))
    assert meta.get("format_gen") == {"doc": 3, "card": 1}


def test_legacy_flat_meta_migrated_to_per_kind(rag_migrate, migrate_corpus, init_templates_dir):
    (migrate_corpus / ".rag-meta.json").write_text('{"format_gen": 3, "plugin": "rag"}',
                                                    encoding="utf-8")
    rag_migrate.main(["--root", str(migrate_corpus),
                      "--templates-dir", str(init_templates_dir), "--apply"])
    meta = json.loads((migrate_corpus / ".rag-meta.json").read_text(encoding="utf-8"))
    assert meta.get("format_gen") == {"doc": 3, "card": 1}


def test_apply_sweeps_doc_and_stamps_meta_then_idempotent(
        rag_migrate, migrate_corpus, init_templates_dir):
    doc = migrate_corpus / "system" / "known-behaviors" / "foo.md"
    doc.write_text("---\nplugin_schema: 3\n---\n# Foo\n\nbody stays\n", encoding="utf-8")
    rc = rag_migrate.main(["--root", str(migrate_corpus),
                           "--templates-dir", str(init_templates_dir), "--apply"])
    assert rc == 0
    text = doc.read_text(encoding="utf-8")
    assert "format_gen: 3" in text and "plugin_schema" not in text
    assert "body stays" in text
    meta = json.loads((migrate_corpus / ".rag-meta.json").read_text(encoding="utf-8"))
    assert meta.get("format_gen") == {"doc": 3, "card": 1}
    assert rag_migrate.main(["--root", str(migrate_corpus),
                             "--templates-dir", str(init_templates_dir), "--check"]) == 0


def test_check_reports_needed_on_schema_zero_corpus(
        rag_migrate, migrate_corpus, init_templates_dir):
    assert rag_migrate.main(["--root", str(migrate_corpus),
                             "--templates-dir", str(init_templates_dir), "--check"]) == 10
