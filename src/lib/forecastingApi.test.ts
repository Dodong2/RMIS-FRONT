import { describe, expect, it, vi } from "vitest";

vi.mock("./apiClient", () => ({ apiClient: { get: vi.fn(async () => ({ data: [{ id: 3, project_code: "NTP-3", title: "Vetiver" }] })) } }));

import { apiClient } from "./apiClient";
import { forecastProjectLabel, forecastingApi } from "./forecastingApi";

describe("Budget Forecast projects (Tasks 64-A, 66)", () => {
  it("labels a project by title first, then its NTP", () => {
    expect(forecastProjectLabel({ id: 1, project_code: "LSPU-RD-001", title: "Waste to Wealth" })).toBe("Waste to Wealth — LSPU-RD-001");
  });

  it("loads the dropdown from the backend's Active-project list", async () => {
    expect(await forecastingApi.getProjects()).toEqual([{ id: 3, project_code: "NTP-3", title: "Vetiver" }]);
    expect(apiClient.get).toHaveBeenCalledWith("/api/forecasting/projects/");
  });
});
