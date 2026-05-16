/**
 * Markdown utilities: parse YAML frontmatter + body, and serialize back to disk.
 *
 * The source of truth in Phase 0 is the filesystem. These utilities are the only
 * code path that touches markdown files. All other modules operate on parsed
 * structures, so when we migrate to SQLite the markdown path stays.
 */

import matter from "gray-matter";
import { readFile, writeFile } from "node:fs/promises";
import type { GoalBody, ChangeLogEntry } from "../types.js";

// ============================================================================
// FRONTMATTER + BODY SPLITTING
// ============================================================================

export interface ParsedMarkdown<T> {
  frontmatter: T;
  body: string;
}

/**
 * Parse a markdown file into its frontmatter and body.
 * Throws if frontmatter is missing or malformed.
 */
export async function parseMarkdownFile<T>(filepath: string): Promise<ParsedMarkdown<T>> {
  const content = await readFile(filepath, "utf-8");
  const parsed = matter(content);

  if (!parsed.data || Object.keys(parsed.data).length === 0) {
    throw new Error(`No frontmatter found in ${filepath}`);
  }

  return {
    frontmatter: parsed.data as T,
    body: parsed.content,
  };
}

/**
 * Serialize a frontmatter object + body back to a markdown file.
 * Preserves the standard `---\n<yaml>\n---\n<body>` shape.
 */
export async function writeMarkdownFile<T extends object>(
  filepath: string,
  frontmatter: T,
  body: string
): Promise<void> {
  const serialized = matter.stringify(body, frontmatter);
  await writeFile(filepath, serialized, "utf-8");
}

// ============================================================================
// GOAL BODY PARSING
// ============================================================================

/**
 * Parse a goal markdown body into structured sections.
 *
 * The schema requires these sections in this order:
 *   ## Description
 *   ## Motivation
 *   ## Success Criteria (with Primary/Secondary subsections)
 *   ## Constraints (with Hard/Soft subsections)
 *   ## Assumptions
 *   ## Strategy Pillars
 *   ## KPIs
 *   ## Change Log (as a markdown table)
 *
 * Sections not in the standard set are preserved in rawBody but not extracted.
 */
export function parseGoalBody(body: string): GoalBody {
  return {
    description: extractSection(body, "Description") ?? "",
    motivation: extractSection(body, "Motivation") ?? "",
    successCriteria: {
      primary: extractListItems(body, "Success Criteria", "Primary"),
      secondary: extractListItems(body, "Success Criteria", "Secondary"),
    },
    constraints: {
      hard: extractListItems(body, "Constraints", "Hard"),
      soft: extractListItems(body, "Constraints", "Soft"),
    },
    assumptions: extractTopLevelList(body, "Assumptions"),
    strategyPillars: extractTopLevelList(body, "Strategy Pillars"),
    kpis: extractSection(body, "KPIs") ?? "",
    changeLog: extractChangeLog(body),
    rawBody: body,
  };
}

// ============================================================================
// SECTION EXTRACTION HELPERS
// ============================================================================

/**
 * Extract the text content of a `## Heading` section, stopping at the next
 * heading of equal or higher level.
 */
function extractSection(body: string, heading: string): string | null {
  // Match `## Heading` followed by everything until next `## ` or end of file.
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^## ${escaped}\\s*$([\\s\\S]*?)(?=^## |\\Z)`, "m");
  const match = body.match(regex);
  return match?.[1]?.trim() ?? null;
}

/**
 * Extract bulleted list items from a subsection (`### Sub`) nested inside a
 * top-level section (`## Top`).
 */
function extractListItems(body: string, topLevel: string, subLevel: string): string[] {
  const topSection = extractSection(body, topLevel);
  if (!topSection) return [];

  const escaped = subLevel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const subRegex = new RegExp(`^### ${escaped}.*?$([\\s\\S]*?)(?=^### |\\Z)`, "m");
  const subMatch = topSection.match(subRegex);
  const subSection = subMatch?.[1] ?? "";

  return parseBulletList(subSection);
}

/**
 * Extract bulleted list items from a top-level section directly (no subsection).
 */
function extractTopLevelList(body: string, heading: string): string[] {
  const section = extractSection(body, heading);
  if (!section) return [];
  return parseBulletList(section);
}

/**
 * Parse bullet list lines into trimmed strings.
 * Supports both `- ` and `* ` markers. Ignores indented continuations for now.
 */
function parseBulletList(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const items: string[] = [];
  for (const line of lines) {
    const match = line.match(/^[-*]\s+(.+)$/);
    if (match?.[1]) {
      items.push(match[1].trim());
    }
  }
  return items;
}

/**
 * Parse the change log markdown table into structured entries.
 * Expected format:
 *
 *   | Date | Version | Change | Trigger |
 *   |------|---------|--------|---------|
 *   | YYYY-MM-DD | 1 | ... | ... |
 */
function extractChangeLog(body: string): ChangeLogEntry[] {
  const section = extractSection(body, "Change Log");
  if (!section) return [];

  const entries: ChangeLogEntry[] = [];
  const lines = section.split(/\r?\n/);

  for (const line of lines) {
    // Skip header and separator rows.
    if (!line.trim().startsWith("|")) continue;
    if (line.includes("---")) continue;
    if (line.toLowerCase().includes("date") && line.toLowerCase().includes("version")) continue;

    const cells = line.split("|").map((c) => c.trim()).filter((c) => c.length > 0);
    if (cells.length < 4) continue;

    const date = cells[0];
    const versionStr = cells[1];
    const change = cells[2];
    const trigger = cells[3];

    if (!date || !versionStr || !change || !trigger) continue;

    const version = parseInt(versionStr, 10);
    if (Number.isNaN(version)) continue;

    entries.push({ date, version, change, trigger });
  }

  return entries;
}
