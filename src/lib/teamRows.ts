export type TeamRow = { id?: number; member_role: string; name: string; gender: string; user: number | null };

export const TEAM_ROLE_LABELS: Record<string, string> = { co_leader: "Co-Project Leader", member: "Team Member" };

export function teamMissing(lead: string, team: TeamRow[]): string[] {
  return [
    ...(lead ? [] : ["Project Leader"]),
    ...team.flatMap((t, i) => (t.name.trim() ? [] : [`the member of Team row ${i + 1} (${TEAM_ROLE_LABELS[t.member_role] ?? t.member_role})`])),
  ];
}

export function needsTeamConfirm(from: number, to: number, confirmed: boolean): boolean {
  return !confirmed && from <= 1 && to > 1;
}
