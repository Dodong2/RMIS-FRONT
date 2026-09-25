export interface MockWorkPlanVersion {
  version: number;
  changeType: "initial" | "revision" | "extension" | "amendment";
  status: "approved" | "submitted";
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  revisedBy: string;
  revisionRemarks: string;
}

export const WORK_PLAN_VERSIONS: MockWorkPlanVersion[] = [
  {
    version: 1,
    changeType: "initial",
    status: "approved",
    createdAt: "2026-01-20",
    approvedAt: "2026-01-28",
    approvedBy: "CRC Chairperson",
    revisedBy: "Project Leader",
    revisionRemarks: "Inception work plan captured from the approved proposal at the inception meeting.",
  },
  {
    version: 2,
    changeType: "revision",
    status: "submitted",
    createdAt: "2026-07-02",
    revisedBy: "Project Leader",
    revisionRemarks: "Adjusted data-gathering schedule after the midterm review; no change to deliverables.",
  },
];
