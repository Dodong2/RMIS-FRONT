export interface MockNotification {
  id: number;
  text: string;
  time: string;
  type: "warning" | "info" | "danger" | "success";
}

export const NOTIFICATIONS: MockNotification[] = [
  { id: 1, text: "Biochar project Q3 Progress Report due in 3 days", time: "1h ago", type: "warning" },
  { id: 2, text: "Procurement request from Engr. Villanueva pending processing", time: "3h ago", type: "info" },
  { id: 3, text: "Similarity check for LSPU-RD-2025-001 is over the 20% threshold", time: "5h ago", type: "danger" },
  { id: 4, text: "Research Output #RO-2025-012 recorded and verified", time: "1d ago", type: "success" },
  { id: 5, text: "Budget utilization alert: IoT project Travel & Subsistence — 0% used", time: "2d ago", type: "warning" },
];
