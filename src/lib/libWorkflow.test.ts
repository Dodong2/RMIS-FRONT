import { describe, expect, it } from "vitest";
import { libActions, libToDo } from "./libWorkflow";

const leader = { isOwnLeader: true, canEndorse: false, canCertify: false };
const crc = { isOwnLeader: false, canEndorse: true, canCertify: false };
const officer = { isOwnLeader: false, canEndorse: false, canCertify: true };
const steps = (...args: Parameters<typeof libActions>) => libActions(...args).map((a) => a.step);

describe("libActions", () => {
  it("gives each role only its own step, in order", () => {
    expect(steps("draft", leader)).toEqual(["submit"]);
    expect(steps("submitted", crc)).toEqual(["for-checking", "hold"]);
    expect(steps("crc_processing", crc)).toEqual(["for-checking", "hold"]);
    expect(steps("for_checking", crc)).toEqual(["for-checking", "hold"]);
    expect(steps("endorsed", officer)).toEqual(["start-certification", "hold"]);
    expect(steps("certifying", officer)).toEqual(["certify", "hold"]);
    expect(steps("returned", leader)).toEqual(["resubmit"]);
  });

  it("gives nothing outside the viewer's level or once certified", () => {
    expect(steps("submitted", leader)).toEqual([]);
    expect(steps("endorsed", crc)).toEqual([]);
    expect(steps("submitted", officer)).toEqual([]);
    for (const v of [leader, crc, officer]) expect(steps("certified", v)).toEqual([]);
  });

  it("asks for remarks on hold", () => {
    expect(libActions("submitted", crc).find((a) => a.step === "hold")?.remarks).toBe("required");
  });
});

describe("libToDo", () => {
  it("tells the leader who put the LIB on hold", () => {
    expect(libToDo({ status: "returned", hold_level: "budget" }, leader)).toBe("On Hold by the Budget Officer · edit and resubmit");
    expect(libToDo({ status: "returned", hold_level: "crc" }, crc)).toBeNull();
  });

  it("puts Ready for Certification in the Budget Officer's queue only", () => {
    expect(libToDo({ status: "endorsed", hold_level: null }, officer)).toBe("Ready for certification");
    expect(libToDo({ status: "for_checking", hold_level: null }, officer)).toBeNull();
  });
});
