import { describe, expect, it } from "vitest";
import { paymentMeta } from "./procurementStatus";

describe("paymentMeta", () => {
  it("shows Paid only when Finance confirmed the payment", () => {
    expect(paymentMeta("paid").label).toBe("Paid");
  });

  it("shows Awaiting Payment otherwise, Completed or not", () => {
    expect(paymentMeta("awaiting_payment").label).toBe("Awaiting Payment");
    expect(paymentMeta("not_payable").label).toBe("Awaiting Payment");
  });
});
