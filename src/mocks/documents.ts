export interface MockDocumentShare {
  sharedWith: string;
  role: string;
  sharedBy: string;
  sharedAt: string;
  expiresAt: string;
}

export const DOCUMENT_SHARES: MockDocumentShare[] = [
  { sharedWith: "External Evaluator — DOST-PCAARRD", role: "Funding agency reviewer", sharedBy: "Project Leader", sharedAt: "2026-09-10", expiresAt: "2026-10-10" },
  { sharedWith: "Campus Research Coordinator", role: "CRC Chair", sharedBy: "RIUH", sharedAt: "2026-09-02", expiresAt: "2026-09-30" },
];
