"""Behavior tests for bin/rag-trace (append one structured entry to an active card's trace.md).

Locks the mechanics that moved from a per-invocation model instruction into code: correct block
format, append-only, header bootstrap on a just-activated card, and the active-card guard.
"""
from __future__ import annotations

import io

import pytest


def _active_card(corpus, name="CARD-T1", with_trace=False):
    """Create an active card dir under the corpus; optionally seed a trace.md header."""
    card = corpus / "issues" / "active" / name
    card.mkdir(parents=True)
    if with_trace:
        (card / "trace.md").write_text(f"# Investigation Trace — {name}\n", encoding="utf-8")
    return card


def _run(rag_trace, corpus, extra, body=None):
    args = ["--root", str(corpus), *extra]
    if body is not None:
        args += ["--body", body]
    return rag_trace.main(args)


# --- card-id sanitizer parity with rag-new-card --------------------------------------

@pytest.mark.parametrize("raw, expected", [
    ("40576", "CARD-40576"),
    ("CARD-40576", "CARD-40576"),
    ("#40576", "CARD-40576"),
    ("../../etc", "CARD-etc"),
])
def test_normalize_card_name_matches_new_card(rag_trace, raw, expected):
    assert rag_trace.normalize_card_name(raw) == expected


# --- append mechanics ----------------------------------------------------------------

def test_appends_well_formed_block_to_existing_trace(rag_trace, empty_corpus):
    _active_card(empty_corpus, with_trace=True)
    rc = _run(rag_trace, empty_corpus,
              ["--card", "T1", "--type", "finding", "--date", "2026-07-07 12:00"],
              body="hard-coded 4096 at export.c:342")
    assert rc == 0
    text = (empty_corpus / "issues" / "active" / "CARD-T1" / "trace.md").read_text(encoding="utf-8")
    assert "---\ndate: 2026-07-07 12:00\nsession: claude\ntype: finding\n---\n" in text
    assert "hard-coded 4096 at export.c:342" in text
    # blank-line separator before the entry block
    assert "\n\n---\ndate: 2026-07-07 12:00" in text


def test_bootstraps_header_when_trace_missing(rag_trace, empty_corpus):
    """A card just activated from backlog has no trace.md yet; the tool seeds the header."""
    card = _active_card(empty_corpus, name="CARD-BOOT", with_trace=False)
    assert not (card / "trace.md").exists()
    rc = _run(rag_trace, empty_corpus, ["--card", "BOOT", "--type", "next-step"], body="start here")
    assert rc == 0
    text = (card / "trace.md").read_text(encoding="utf-8")
    assert text.startswith("# Investigation Trace — CARD-BOOT")
    assert "asymmetric economy" in text          # economy reminder carried into the header
    assert "start here" in text


def test_append_only_preserves_prior_entries(rag_trace, empty_corpus):
    _active_card(empty_corpus, name="CARD-MULTI", with_trace=True)
    _run(rag_trace, empty_corpus, ["--card", "MULTI", "--type", "finding"], body="first")
    _run(rag_trace, empty_corpus, ["--card", "MULTI", "--type", "hypothesis"], body="second")
    text = (empty_corpus / "issues" / "active" / "CARD-MULTI" / "trace.md").read_text(encoding="utf-8")
    assert "first" in text and "second" in text
    assert text.index("first") < text.index("second")   # order preserved, appended
    assert text.count("type: finding") == 1 and text.count("type: hypothesis") == 1


def test_body_from_stdin_when_body_flag_omitted(rag_trace, empty_corpus, monkeypatch):
    _active_card(empty_corpus, name="CARD-STDIN", with_trace=True)
    monkeypatch.setattr("sys.stdin", io.StringIO("piped multi\nline body"))
    rc = _run(rag_trace, empty_corpus, ["--card", "STDIN", "--type", "finding"])
    assert rc == 0
    text = (empty_corpus / "issues" / "active" / "CARD-STDIN" / "trace.md").read_text(encoding="utf-8")
    assert "piped multi\nline body" in text


def test_custom_session_label(rag_trace, empty_corpus):
    _active_card(empty_corpus, name="CARD-SESS", with_trace=True)
    _run(rag_trace, empty_corpus, ["--card", "SESS", "--type", "finding", "--session", "gemini"],
         body="x")
    text = (empty_corpus / "issues" / "active" / "CARD-SESS" / "trace.md").read_text(encoding="utf-8")
    assert "session: gemini" in text


def test_prints_economy_readout(rag_trace, empty_corpus, capsys):
    """Each append reports the re-read tokens it avoided (minimal, no persistent state)."""
    _active_card(empty_corpus, name="CARD-READOUT", with_trace=True)
    _run(rag_trace, empty_corpus, ["--card", "READOUT", "--type", "finding"], body="x")
    out = capsys.readouterr().out
    assert "not pulled into context" in out
    assert "~" in out and "tokens" in out
    # the seeded trace header is non-empty, so the avoided-token estimate should be > 0
    num = out.split("~", 1)[1].split("tokens", 1)[0].strip().replace(",", "")
    assert int(num) > 0


# --- guards --------------------------------------------------------------------------

def test_rejects_nonexistent_card(rag_trace, empty_corpus):
    assert _run(rag_trace, empty_corpus, ["--card", "GHOST", "--type", "finding"], body="x") == 1


def test_rejects_non_active_card_with_activation_hint(rag_trace, empty_corpus, capsys):
    (empty_corpus / "issues" / "backlog" / "CARD-PARKED").mkdir(parents=True)
    rc = _run(rag_trace, empty_corpus, ["--card", "PARKED", "--type", "finding"], body="x")
    assert rc == 1
    assert "backlog" in capsys.readouterr().err.lower()


def test_empty_body_exits_2(rag_trace, empty_corpus, monkeypatch):
    _active_card(empty_corpus, name="CARD-EMPTY", with_trace=True)
    monkeypatch.setattr("sys.stdin", io.StringIO("   \n  "))
    assert _run(rag_trace, empty_corpus, ["--card", "EMPTY", "--type", "finding"]) == 2


def test_invalid_type_is_rejected(rag_trace, empty_corpus):
    _active_card(empty_corpus, name="CARD-BADTYPE", with_trace=True)
    with pytest.raises(SystemExit):   # argparse choices rejection
        _run(rag_trace, empty_corpus, ["--card", "BADTYPE", "--type", "bogus"], body="x")
