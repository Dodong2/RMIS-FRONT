import type { OutputDashboard, PerformanceDashboard } from "../../types/dashboard";
import { SkeletonRows } from "../common/proto";
import { STATUS_LABELS } from "./format";
import { ChartCard, CountBars, DonutChart, EmptyChart, HBar, KpiBox, MiniBar } from "./ProtoCharts";

const PUBLICATION_TYPE_LABELS: Record<string, string> = {
  journal_article: "Journal Article",
  book: "Book",
  book_chapter: "Book Chapter",
  conference_proceeding: "Conference Proceeding",
  instructional_material: "Instructional Material",
};

const IP_STATUS_LABELS: Record<string, string> = {
  disclosed: "Disclosed",
  filed: "Filed",
  registered: "Registered",
  adopted: "Adopted by Community",
};

const STATUS_COLORS: Record<string, string> = { active: "#059669", completed: "#0d2a5e", archived: "#94a3b8" };
const humanize = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function OutputsTab({ data, outputDash }: { data: PerformanceDashboard | null; outputDash: OutputDashboard | null }) {
  if (!data) return <SkeletonRows />;
  const rows = data.projects;
  const withOutputs = rows.filter((r) => r.outputs > 0);
  const totalOutputs = rows.reduce((a, r) => a + r.outputs, 0);
  const milestonesDone = rows.reduce((a, r) => a + r.milestones_done, 0);
  const techTransfers = outputDash?.ip_records_by_status.adopted ?? 0;

  const byProject = [...withOutputs].sort((a, b) => b.outputs - a.outputs || a.project_code.localeCompare(b.project_code));
  const maxProject = Math.max(0, ...byProject.map((r) => r.outputs));

  const byCollege = Object.values(
    withOutputs.reduce<Record<string, { label: string; value: number }>>((acc, r) => {
      if (!r.college) return acc;
      const key = `${r.campus}|${r.college}`;
      acc[key] ??= { label: `${r.college_code}${r.campus ? ` (${r.campus})` : ""}`, value: 0 };
      acc[key].value += r.outputs;
      return acc;
    }, {}),
  ).sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiBox label="Total Outputs" value={String(totalOutputs)} sub="Recorded project outputs" color="#0d2a5e" />
        <KpiBox label="Projects with Outputs" value={String(withOutputs.length)} sub={`of ${rows.length} scoped projects`} color="#0891b2" />
        <KpiBox label="Tech Transfers" value={String(techTransfers)} sub="IP adopted by community" color="#059669" />
        <KpiBox label="Milestones Done" value={String(milestonesDone)} sub="Completed milestones" color="#7c3aed" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Research Outputs by Project">
          {byProject.length === 0 ? (
            <EmptyChart message="No outputs match the selected filters." />
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {byProject.map((r, i) => (
                <HBar key={r.project} label={r.project_code} val={r.outputs} max={maxProject} color={["#7c3aed", "#0891b2", "#059669", "#0d2a5e"][i % 4]} valLabel={`${r.outputs} output${r.outputs !== 1 ? "s" : ""}`} />
              ))}
            </div>
          )}
        </ChartCard>

        <ChartCard title="Output Activity Summary">
          <DonutChart
            segments={[
              { label: "Recorded Outputs", value: totalOutputs, color: "#0d2a5e" },
              { label: "Tech Transfers", value: techTransfers, color: "#059669" },
              { label: "Completed Milestones", value: milestonesDone, color: "#7c3aed" },
            ]}
            centerLabel="Activities"
            tooltipLabel="Activity type"
            valueLabel="Records"
          />
        </ChartCard>

        <ChartCard title="Output-Producing Project Status">
          {withOutputs.length === 0 ? (
            <EmptyChart message="No projects with outputs in the selected filters." />
          ) : (
            <div className="space-y-3">
              {Object.keys(STATUS_LABELS).map((status) => (
                <MiniBar
                  key={status}
                  label={STATUS_LABELS[status]}
                  pct={Math.round((withOutputs.filter((r) => r.status === status).length / withOutputs.length) * 100)}
                  color={STATUS_COLORS[status]}
                />
              ))}
            </div>
          )}
        </ChartCard>

        <ChartCard title="Outputs by College">
          {byCollege.length === 0 ? (
            <EmptyChart message="No college output data matches the selected filters." />
          ) : (
            <div className="space-y-2 mt-1 max-h-[420px] overflow-y-auto pr-1">
              {byCollege.map((c, i) => (
                <HBar key={c.label} label={c.label} val={c.value} max={byCollege[0].value} color={["#0d2a5e", "#0891b2", "#059669", "#64748b"][i % 4]} valLabel={`${c.value} output${c.value !== 1 ? "s" : ""}`} />
              ))}
            </div>
          )}
        </ChartCard>

        <ChartCard title="Publications by Type">
          <CountBars data={outputDash?.publications_by_type ?? {}} labelFor={(k) => PUBLICATION_TYPE_LABELS[k] ?? humanize(k)} emptyMessage="No publications recorded yet." />
        </ChartCard>

        <ChartCard title="IP Records by Status">
          <CountBars data={outputDash?.ip_records_by_status ?? {}} labelFor={(k) => IP_STATUS_LABELS[k] ?? humanize(k)} emptyMessage="No IP records logged yet." />
        </ChartCard>
      </div>
    </div>
  );
}
