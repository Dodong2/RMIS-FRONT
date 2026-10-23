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
