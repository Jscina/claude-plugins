"""Characterization tests for bin/rag-migrate (current / baseline behavior).

Locks the doc-pass machinery the v0.5.0 rework REUSES for the new card pass
(`_ensure_format_gen` sweep/stamp, body-preservation, idempotency, the meta sweep) plus
`read_corpus_gen`'s current flat-int contract. When the rework lands, the read_corpus_gen
contract test is revised deliberately (flat int -> per-kind {doc, card}); the rest must
stay green to prove the reused machinery didn't regress.
"""
from __future__ import annotations

import json

import pytest


# --- _ensure_format_gen: the plugin_schema -> format_gen sweep + stamp ----------------

def test_sweep_plugin_schema_to_format_gen_same_value(rag_migrate):
    out = rag_migrate._ensure_format_gen("---\nplugin_schema: 3\n---\nbody line\n", 3)
    assert out is not None
    assert "format_gen: 3" in out
    assert "plugin_schema" not in out
    assert out.endswith("---\nbody line\n")            # body preserved verbatim


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


# --- read_corpus_gen: CURRENT flat-int contract (the rework revises this to {doc,card}) -

@pytest.mark.parametrize("meta, expected", [
    ({"format_gen": 3, "plugin": "rag"}, 3),
    ({"plugin_schema": 3}, 3),                  # legacy 0.4.0 key
    ({"schema": 2}, 2),                          # legacy <=0.3.0 key
    ({"plugin": "rag"}, 0),                      # no generation key
])
def test_read_corpus_gen_flat_int_contract(rag_migrate, tmp_path, meta, expected):
    (tmp_path / ".rag-meta.json").write_text(json.dumps(meta), encoding="utf-8")
    assert rag_migrate.read_corpus_gen(tmp_path) == expected


def test_read_corpus_gen_missing_meta_is_zero(rag_migrate, tmp_path):
    assert rag_migrate.read_corpus_gen(tmp_path) == 0


def test_read_corpus_gen_invalid_json_is_zero(rag_migrate, tmp_path):
    (tmp_path / ".rag-meta.json").write_text("{not json", encoding="utf-8")
    assert rag_migrate.read_corpus_gen(tmp_path) == 0


# --- end-to-end migration: doc sweep + meta stamp + idempotency -----------------------

@pytest.fixture
def migrate_corpus(tmp_path):
    root = tmp_path / "rag-memory"
    for d in ("issues/active", "issues/backlog", "issues/done", "issues/archive",
              "system/known-behaviors"):
        (root / d).mkdir(parents=True)
    return root


def test_apply_sweeps_doc_and_stamps_meta_then_idempotent(
        rag_migrate, migrate_corpus, init_templates_dir):
    doc = migrate_corpus / "system" / "known-behaviors" / "foo.md"
    doc.write_text("---\nplugin_schema: 3\n---\n# Foo\n\nbody stays\n", encoding="utf-8")
    rc = rag_migrate.main(["--root", str(migrate_corpus),
                           "--templates-dir", str(init_templates_dir), "--apply"])
    assert rc == 0
    text = doc.read_text(encoding="utf-8")
    assert "format_gen: 3" in text and "plugin_schema" not in text
    assert "body stays" in text                         # body preserved through the sweep
    meta = json.loads((migrate_corpus / ".rag-meta.json").read_text(encoding="utf-8"))
    assert meta.get("format_gen") == 3                  # flat-int meta (baseline)
    # idempotent: a second --check reports up to date (exit 0)
    assert rag_migrate.main(["--root", str(migrate_corpus),
                             "--templates-dir", str(init_templates_dir), "--check"]) == 0


def test_meta_sweep_plugin_schema_to_format_gen(
        rag_migrate, migrate_corpus, init_templates_dir):
    (migrate_corpus / ".rag-meta.json").write_text(
        '{"plugin_schema": 3, "plugin": "rag"}', encoding="utf-8")
    rc = rag_migrate.main(["--root", str(migrate_corpus),
                           "--templates-dir", str(init_templates_dir), "--apply"])
    assert rc == 0
    meta = json.loads((migrate_corpus / ".rag-meta.json").read_text(encoding="utf-8"))
    assert "format_gen" in meta and "plugin_schema" not in meta


def test_check_reports_needed_on_schema_zero_corpus(
        rag_migrate, migrate_corpus, init_templates_dir):
    # bare corpus, no meta -> migration needed -> exit 10
    assert rag_migrate.main(["--root", str(migrate_corpus),
                             "--templates-dir", str(init_templates_dir), "--check"]) == 10
