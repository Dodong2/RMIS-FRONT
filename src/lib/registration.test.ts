import { describe, expect, it } from "vitest";
import { EMPTY_PROFILE, fieldErrors, loginBlock, profilePayload, profileProblems } from "./registration";

const complete = {
  gender: "female" as const, campus: "Siniloan", college_unit: "CCS - College of Computer Studies",
  mobile_number: "09171234567", staff_id: "123456", requested_role: "11",
};

describe("profileProblems", () => {
  it("asks for every field when nothing is filled in", () => {
    expect(Object.keys(profileProblems(EMPTY_PROFILE)).sort()).toEqual(
      ["campus", "college_unit", "gender", "mobile_number", "requested_role", "staff_id"],
    );
  });

  it("accepts a complete profile, including +639 mobile numbers", () => {
    expect(profileProblems(complete)).toEqual({});
    expect(profileProblems({ ...complete, mobile_number: "+639171234567" })).toEqual({});
  });

  it("checks the Staff ID and mobile formats", () => {
    for (const staff_id of ["12345", "1234567", "abcdef", "12 456"]) {
      expect(profileProblems({ ...complete, staff_id }).staff_id).toBe("Staff ID must be 6 digits.");
    }
    for (const mobile_number of ["0917123456", "9171234567", "+63917123456"]) {
      expect(profileProblems({ ...complete, mobile_number }).mobile_number).toMatch(/mobile number/);
    }
  });
});

describe("profilePayload", () => {
  it("trims the typed values and sends the role as a number", () => {
    expect(profilePayload({ ...complete, staff_id: " 123456 ", mobile_number: " 09171234567" })).toEqual({
      gender: "female", campus: "Siniloan", college_unit: "CCS - College of Computer Studies",
      mobile_number: "09171234567", staff_id: "123456", requested_role: 11,
    });
  });
});

describe("fieldErrors", () => {
  it("keeps the first message per field and leaves out detail", () => {
    const err = { response: { status: 400, data: { staff_id: ["This Staff ID is already registered."], detail: "x" } } };
    expect(fieldErrors(err)).toEqual({ staff_id: "This Staff ID is already registered." });
    expect(fieldErrors(new Error("network"))).toEqual({});
  });
});

describe("loginBlock", () => {
  it("reads the account state the backend sends when the password was right", () => {
    const err = { response: { status: 400, data: { detail: ["Verify your e-mail first."], account_state: ["unverified"] } } };
    expect(loginBlock(err)).toEqual({ state: "unverified", message: "Verify your e-mail first." });
  });

  it("is null for a plain wrong password", () => {
    expect(loginBlock({ response: { status: 400, data: { non_field_errors: ["Unable to log in."] } } })).toBeNull();
  });
});
