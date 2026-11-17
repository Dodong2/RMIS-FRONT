import { describe, expect, it } from "vitest";
import type { ProcurementRequest } from "../types/financial";
import { paymentMeta, upsertProcurement } from "./procurementStatus";

describe("paymentMeta", () => {
  it("shows Paid only when Finance confirmed the payment", () => {
    expect(paymentMeta("paid").label).toBe("Paid");
  });

  it("shows Awaiting Payment otherwise, Completed or not", () => {
    expect(paymentMeta("awaiting_payment").label).toBe("Awaiting Payment");
    expect(paymentMeta("not_payable").label).toBe("Awaiting Payment");
  });
});

describe("upsertProcurement (Task 68-B): the saved request shows at once", () => {
  const pr = (id: number, status: ProcurementRequest["status"], project = 1) => ({ id, status, project }) as ProcurementRequest;
  const open = (r: ProcurementRequest) => !["completed", "cancelled"].includes(r.status);

  it("replaces the row in place when it is already listed", () => {
    expect(upsertProcurement([pr(2, "requested"), pr(1, "requested")], pr(1, "under_review"))).toEqual([pr(2, "requested"), pr(1, "under_review")]);
  });

  it("adds a new request on top", () => {
    expect(upsertProcurement([pr(1, "requested")], pr(2, "requested"))).toEqual([pr(2, "requested"), pr(1, "requested")]);
  });

  it("drops it when it no longer belongs to that list", () => {
    expect(upsertProcurement([pr(1, "under_review"), pr(2, "requested")], pr(1, "completed"), open)).toEqual([pr(2, "requested")]);
    expect(upsertProcurement([pr(2, "requested")], pr(3, "requested", 9), (r) => r.project === 1)).toEqual([pr(2, "requested")]);
  });

  it("leaves a list that has not loaded yet alone", () => {
    expect(upsertProcurement(null, pr(1, "requested"))).toBeNull();
    expect(upsertProcurement(undefined, pr(1, "requested"))).toBeUndefined();
  });
});
