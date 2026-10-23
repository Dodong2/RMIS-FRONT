import { describe, expect, it } from "vitest";
import { editorValue, isRichTextEmpty, looksLikeHtml, toEditorHtml } from "./richText";

describe("rich text proposal sections (client 2026-10-23)", () => {
  it("tells saved editor HTML from older plain text", () => {
    expect(looksLikeHtml("<p>Hi <strong>there</strong></p>")).toBe(true);
    expect(looksLikeHtml("Farmers < 50 & fishers > 20")).toBe(false);
  });

  it("opens older plain text in the editor one paragraph per line, escaped", () => {
    expect(toEditorHtml("Rice & corn\nFarmers < 50 > 20")).toBe("<p>Rice &amp; corn</p><p>Farmers &lt; 50 &gt; 20</p>");
  });

  it("opens saved HTML as it is and nothing as nothing", () => {
    expect(toEditorHtml("<ul><li><p>One</p></li></ul>")).toBe("<ul><li><p>One</p></li></ul>");
    expect(toEditorHtml("")).toBe("");
  });

  it("an editor with no text is empty, so the section saves blank", () => {
    expect(isRichTextEmpty("<p></p>")).toBe(true);
    expect(isRichTextEmpty("<p>&nbsp; </p><p><br></p>")).toBe(true);
    expect(isRichTextEmpty("<table><tbody><tr><td><p>x</p></td></tr></tbody></table>")).toBe(false);
    expect([editorValue("<p></p>"), editorValue("<p>Hi</p>")]).toEqual(["", "<p>Hi</p>"]);
  });
});
