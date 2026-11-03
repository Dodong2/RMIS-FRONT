import { describe, expect, it } from "vitest";
import { EMPTY_PROFILE, fieldErrors, loginBlock, orderRequestableRoles, profilePayload, profileProblems } from "./registration";

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

describe("orderRequestableRoles", () => {
  it("follows the client's role order whatever order the API sends", () => {
    const api = ["project_staff", "riuh", "project_leader", "vprei", "crc_chair", "finance_budget", "university_admin", "procurement_officer_lib"]
      .map((code, id) => ({ id, code }));
    expect(orderRequestableRoles(api).map((r) => r.code)).toEqual([
      "vprei", "university_admin", "crc_chair", "riuh", "finance_budget", "procurement_officer_lib", "project_leader", "project_staff",
    ]);
  });

  it("puts an unknown role last and does not change the input", () => {
    const api = [{ code: "new_role" }, { code: "project_staff" }, { code: "vprei" }];
    expect(orderRequestableRoles(api).map((r) => r.code)).toEqual(["vprei", "project_staff", "new_role"]);
    expect(api[0].code).toBe("new_role");
  });
});

describe("College Unit by requested role (Task 39)", () => {
  const noCollege = { ...complete, college_unit: "" };

  it("is not needed for VP for REI, University Administration and CRC/CRD, and is not sent", () => {
    for (const code of ["vprei", "university_admin", "crc_chair"]) {
      const profile = { ...complete, requested_role_code: code };
      expect(profileProblems({ ...noCollege, requested_role_code: code }).college_unit).toBeUndefined();
      expect(profilePayload(profile).college_unit).toBe("");
    }
  });

  it("is still required for the other roles and for an unknown role", () => {
    for (const code of ["riuh", "finance_budget", "procurement_officer_lib", "project_leader", "project_staff", undefined]) {
      expect(profileProblems({ ...noCollege, requested_role_code: code }).college_unit).toBe("Choose your College Unit.");
      expect(profilePayload({ ...complete, requested_role_code: code }).college_unit).toBe(complete.college_unit);
    }
  });
});
