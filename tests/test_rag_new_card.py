"""Characterization tests for bin/rag-new-card (current / baseline behavior).

rag-new-card is template-driven and needs NO change in the v0.5.0 card-migration rework;
these lock its behavior so the rework can't regress the scaffolder or its path-safety.
"""
from __future__ import annotations

import pytest


# --- normalize_card_name: the FS-safety / path-traversal sanitizer -------------------

@pytest.mark.parametrize("raw, expected", [
    ("ADO-11111", "CARD-ADO-11111"),
    ("CARD-ADO-1", "CARD-ADO-1"),                  # existing CARD- prefix not doubled
    ("card-abc", "CARD-abc"),                       # prefix detection is case-insensitive
    ("#12345", "CARD-12345"),                       # '#' stripped
    ("Planned: retry storms", "CARD-Planned-retry-storms"),
    ("a/b/c", "CARD-a-b-c"),                        # path separators neutralized
    ("a\\b", "CARD-a-b"),
    ("x---y", "CARD-x-y"),                          # repeated hyphens collapsed
    ("../../etc", "CARD-etc"),                       # traversal dots dropped, tail survives
    ("..\\..\\x", "CARD-x"),
])
def test_normalize_card_name(rag_new_card, raw, expected):
    assert rag_new_card.normalize_card_name(raw) == expected


@pytest.mark.parametrize("raw", ["../../etc", "..\\..\\x", "a/../b"])
def test_normalize_card_name_yields_one_safe_component(rag_new_card, raw):
    name = rag_new_card.normalize_card_name(raw)
    assert "/" not in name and "\\" not in name
    assert ".." not in name
    assert name.startswith("CARD-")


@pytest.mark.parametrize("raw", ["", "#", "::", "/", ".", "..", "..."])
def test_normalize_card_name_empty_after_sanitization_raises(rag_new_card, raw):
    with pytest.raises(ValueError):
        rag_new_card.normalize_card_name(raw)


# --- scaffolding behavior ------------------------------------------------------------

def _make(rag_new_card, corpus, templates, extra):
    return rag_new_card.main(["--root", str(corpus), "--templates-dir", str(templates), *extra])


def test_active_card_scaffolds_all_files(rag_new_card, empty_corpus, card_templates_dir):
    rc = _make(rag_new_card, empty_corpus, card_templates_dir,
               ["--id", "ADO-1", "--source", "ado", "--symptom", "boom", "--date", "2026-06-16"])
    assert rc == 0
    card = empty_corpus / "issues" / "active" / "CARD-ADO-1"
    assert (card / "context.md").is_file()
    assert (card / "trace.md").is_file()
    assert (card / "benchmarks.md").is_file()
    assert (card / "artifacts" / ".gitkeep").is_file()


def test_backlog_card_is_context_only(rag_new_card, empty_corpus, card_templates_dir):
    rc = _make(rag_new_card, empty_corpus, card_templates_dir, ["--id", "Planned idea", "--backlog"])
    assert rc == 0
    card = empty_corpus / "issues" / "backlog" / "CARD-Planned-idea"
    assert (card / "context.md").is_file()
    assert not (card / "trace.md").exists()
    assert not (card / "benchmarks.md").exists()
    assert not (card / "artifacts").exists()


def test_active_card_requires_symptom(rag_new_card, empty_corpus, card_templates_dir):
    rc = _make(rag_new_card, empty_corpus, card_templates_dir, ["--id", "NOSYMPTOM"])
    assert rc == 2


def test_refuses_to_overwrite_existing_card(rag_new_card, empty_corpus, card_templates_dir):
    extra = ["--id", "DUP", "--source", "qa", "--symptom", "x"]
    assert _make(rag_new_card, empty_corpus, card_templates_dir, extra) == 0
    assert _make(rag_new_card, empty_corpus, card_templates_dir, extra) == 1


def test_context_carries_format_gen_header_and_substitutes_tokens(
        rag_new_card, empty_corpus, card_templates_dir):
    rc = _make(rag_new_card, empty_corpus, card_templates_dir,
               ["--id", "HDR-1", "--source", "other", "--symptom", "exports truncate"])
    assert rc == 0
    text = (empty_corpus / "issues" / "active" / "CARD-HDR-1" / "context.md").read_text()
    assert text.startswith("---")
    frontmatter = text.split("---", 2)[1]
    assert "format_gen: 1" in frontmatter            # card lineage gen 1 (baseline)
    assert "card_id: CARD-HDR-1" in frontmatter
    assert "{{" not in text                            # all tokens substituted
    assert "exports truncate" in text                  # symptom rendered into the body
