export const HOURS_PER_WORKING_DAY = 8;

const toDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export function workingDays(start: string, end: string) {
  if (!start || !end || end < start) return 0;
  let days = 0;
  for (const d = toDate(start); d <= toDate(end); d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0 && d.getDay() !== 6) days++;
  }
  return days;
}

export function plannedHoursLabel(start: string, end: string) {
  if (!start || !end) return "Pick a Start and End Date to see the planned hours.";
  if (end < start) return "The End Date can't be before the Start Date.";
  const days = workingDays(start, end);
  if (!days) return "The dates must include at least one working day (Mon-Fri).";
  return `Planned: ${days} working day${days !== 1 ? "s" : ""} × ${HOURS_PER_WORKING_DAY}h = ${days * HOURS_PER_WORKING_DAY}h`;
}
