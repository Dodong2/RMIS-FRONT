import { describe, expect, it } from "vitest";
import { editorValue, isRichTextEmpty, looksLikeHtml, objectiveItems, objectivesHtml, toEditorHtml } from "./richText";

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

describe("III. Objectives (client Task 29-A)", () => {
  const rich =
    "<ol><li><p>Evaluate the <strong>status</strong> of extension&nbsp;projects</p></li>" +
    "<li><p>Prepare a report</p><ul><li>for the RDO</li></ul></li><li><p></p></li></ol>";

  it("reads one objective per top-level list entry, like the backend", () => {
    expect(objectiveItems(rich)).toEqual(["Evaluate the status of extension projects", "Prepare a report for the RDO"]);
  });

  it("reads older plain text one per line without its numbering", () => {
    expect(objectiveItems("1. Evaluate the status\n\n2) Prepare a report\n")).toEqual(["Evaluate the status", "Prepare a report"]);
  });

  it("reads paragraphs without a list one each, and nothing from an empty editor", () => {
    expect(objectiveItems("<p>First &amp; foremost</p><p>Second<br>Third</p>")).toEqual(["First & foremost", "Second", "Third"]);
    for (const empty of ["", "<p></p>", "<ol><li><p></p></li></ol>", null]) expect(objectiveItems(empty)).toEqual([]);
  });

  it("opens older objectives as a numbered list and keeps saved HTML", () => {
    expect(objectivesHtml("1. Train teachers & staff\n2. Map communities")).toBe(
      "<ol><li><p>Train teachers &amp; staff</p></li><li><p>Map communities</p></li></ol>",
    );
    expect(objectivesHtml(["A", " ", "B"])).toBe("<ol><li><p>A</p></li><li><p>B</p></li></ol>");
    expect(objectivesHtml("")).toBe("<ol><li><p></p></li></ol>");
    expect(objectivesHtml(rich)).toBe(rich);
  });
});
