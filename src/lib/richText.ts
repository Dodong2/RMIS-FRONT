import DOMPurify from "dompurify";

// Client 2026-10-23: proposal Sections II, IV, VI, VIII and IX are TipTap HTML. Same allowlist as the backend
// (rmis-backend research_projects/serializers.py RICH_TEXT_TAGS), which already sanitizes on save.
const RICH_TEXT_TAGS = [
  "p", "br", "strong", "b", "em", "i", "u", "s", "h2", "h3", "h4", "ul", "ol", "li", "blockquote",
  "table", "thead", "tbody", "tr", "th", "td", "a", "colgroup", "col",
];
const RICH_TEXT_ATTRS = ["href", "rel", "target", "colspan", "rowspan"];
const HTML_TAG = /<\/?[a-zA-Z][^>]*>/;

/** Saved editor HTML, as opposed to text from before the editor (or an Excel cell). */
export const looksLikeHtml = (value: string) => HTML_TAG.test(value);

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** What the editor opens: saved HTML as it is, older plain text one paragraph per line. */
export const toEditorHtml = (value: string) =>
  !value ? "" : looksLikeHtml(value) ? value : value.split("\n").map((line) => `<p>${escapeHtml(line)}</p>`).join("");

/** No visible text, e.g. the editor's empty "<p></p>". */
export const isRichTextEmpty = (html: string) =>
  !html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();

/** What a section saves from the editor: blank when it has no text, so "Not provided" still applies. */
export const editorValue = (html: string) => (isRichTextEmpty(html) ? "" : html);

/** Sanitized HTML to display a section (old plain text included). */
export const safeHtml = (value: string) =>
  DOMPurify.sanitize(toEditorHtml(value), { ALLOWED_TAGS: RICH_TEXT_TAGS, ALLOWED_ATTR: RICH_TEXT_ATTRS });

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };
const decode = (text: string) => text.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, name: string) => ENTITIES[name]);
const OBJECTIVE_BLOCKS = new Set(["p", "br", "h2", "h3", "h4", "blockquote", "tr"]);

/** III. Objectives as plain texts, one per objective (client Task 29-A), same reading as the backend's
 * objective_items: each top-level list entry (a nested list stays with it), or each paragraph when there is no list;
 * older plain text one per line with its "1." numbering dropped. */
export function objectiveItems(value: string | null | undefined): string[] {
  const text = value ?? "";
  if (!looksLikeHtml(text)) {
    return text.split("\n").map((line) => line.replace(/^\d+[.)]\s*/, "").trim()).filter(Boolean);
  }
  const hasList = /<li[\s>]/i.test(text);
  const items = [""];
  let depth = 0;
  for (const [token, closing, rawTag] of text.matchAll(/<(\/?)([a-zA-Z0-9]+)[^>]*>|[^<]+/g)) {
    const tag = rawTag?.toLowerCase();
    if (!tag) {
      if (depth || !hasList) items[items.length - 1] += decode(token);
    } else if (tag === "li") {
      if (closing) depth = Math.max(depth - 1, 0);
      else if (depth++ === 0) items.push("");
    } else if (!hasList && OBJECTIVE_BLOCKS.has(tag)) {
      items.push("");
    } else {
      items[items.length - 1] += " ";
    }
  }
  return items.map((item) => item.replace(/\s+/g, " ").trim()).filter(Boolean);
}

/** The Objectives editor's content: saved HTML as it is; older plain text or a list of objectives as a numbered list. */
export function objectivesHtml(value: string | string[] | null | undefined): string {
  if (typeof value === "string" && looksLikeHtml(value)) return value;
  const items = Array.isArray(value) ? value.map((o) => o.trim()).filter(Boolean) : objectiveItems(value);
  return `<ol>${(items.length ? items : [""]).map((o) => `<li><p>${escapeHtml(o)}</p></li>`).join("")}</ol>`;
}
