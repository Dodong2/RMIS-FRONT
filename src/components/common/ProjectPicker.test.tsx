import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProjectPicker } from "./ProjectPicker";

const projects = [
  { id: 11, project_code: "LSPU-RD-GRANT-SIN-2024-011", title: "ACCEPTABILITY AND MARKETABILITY OF INDIGENOUS VEGETABLE LEAVES" },
  { id: 1, project_code: "LSPU-RD-GRANT-SIN-2024-001", title: "Optimizing University Research Operations" },
];

describe("ProjectPicker", () => {
  it("shows the selected project's NTP above its title", () => {
    const html = renderToStaticMarkup(<ProjectPicker projects={projects} value="1" onChange={() => {}} />);
    const ntp = html.indexOf("LSPU-RD-GRANT-SIN-2024-001");
    const title = html.indexOf("Optimizing University Research Operations");
    expect(ntp).toBeGreaterThan(-1);
    expect(title).toBeGreaterThan(ntp);
    expect(html).not.toContain("LSPU-RD-GRANT-SIN-2024-011");
    expect(html).toContain('aria-expanded="false"');
  });

  it("shows a placeholder when nothing is selected", () => {
    const html = renderToStaticMarkup(<ProjectPicker projects={projects} value="" onChange={() => {}} />);
    expect(html).toContain("Select a project");
  });
});
