const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const peso = (n: number) => `₱${Math.round(n).toLocaleString("en-PH")}`;

export const monthLabel = (yyyyMm: string) => `${MONTHS[Number(yyyyMm.slice(5)) - 1]} ${yyyyMm.slice(2, 4)}`;

export const FUNDING_LABELS: Record<string, string> = {
  institutional: "Institutional (LSPU-Funded)",
  core_funded: "Core-Funded (Self-Funded)",
  externally_funded: "Externally-Funded",
};

export const STATUS_LABELS: Record<string, string> = { active: "Active", completed: "Completed", archived: "Archived" };
