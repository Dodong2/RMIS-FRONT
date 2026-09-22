import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { researchApi } from "../lib/researchApi";
import type { Program, FundingType } from "../types/research";
import type { AdminUser } from "../types/auth";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { AppShell } from "../components/layout/AppShell";
import { EmptyOption } from "../components/common/EmptyOption";
import { FieldLabel } from "../components/common/FieldLabel";
import { PageHeader } from "../components/common/Page";
import { MultiSelect } from "../components/common/MultiSelect";
import {
  PRIORITY_AREA_LABELS,
  RESEARCH_TYPE_LABELS,
  SDG_OPTIONS,
  SECTOR_LABELS,
  TYPOLOGY_OPTIONS,
} from "../lib/projectOptions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { notify } from "../lib/notify";

const FUNDING_LABELS: Record<FundingType, string> = {
  institutional: "Institutional (LSPU-Funded)",
  core_funded: "Core-Funded (Self-Funded)",
  externally_funded: "Externally-Funded",
};

function RegisterProjectContent() {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [projectLeaders, setProjectLeaders] = useState<AdminUser[]>([]);
  const [attempted, setAttempted] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [form, setForm] = useState({
    title: "",
    project_code: "",
    funding_type: "",
    program: "",
    lead: "",
    ntp_number: "",
    ntp_date: "",
    toe_signed_date: "",
    is_dry_research: "true",
    start_date: "",
    target_end_date: "",
    rei_thrust: "",
    sdgs: [] as string[],
    sector: "",
    sector_other: "",
    is_continuing: "false",
    research_type: "",
    research_priority_area: "",
    research_typology: [] as string[],
    campus: "",
    implementing_unit: "",
    cooperating_agencies: "",
    total_cost: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const [programList, leaders] = await Promise.all([
          researchApi.getPrograms(),
          researchApi.getUsersByRole("project_leader"),
        ]);
        setPrograms(programList);
        setProjectLeaders(leaders);
      } catch {
        notify.error("Could not load form data. Check your connection and refresh.");
      }
    })();
  }, []);

  const handleCreate = async () => {
    setAttempted(true);
    if (!form.title || !form.project_code || !form.funding_type || !form.lead) {
      notify.error("Project title, project code, funding type, and lead are required.");
      return;
    }
    if (form.sdgs.length === 0) {
      notify.error("Select at least one Sustainable Development Goal.");
      return;
    }
    if (!form.sector) {
      notify.error("Sector is required.");
      return;
    }
    if (form.sector === "others" && !form.sector_other.trim()) {
      notify.error("Specify the sector when 'Others' is selected.");
      return;
    }
    setIsCreating(true);
    try {
      await researchApi.createProject({
        program: form.program ? Number(form.program) : null,
        title: form.title,
        project_code: form.project_code,
        funding_type: form.funding_type,
        lead: Number(form.lead),
        ntp_number: form.ntp_number || undefined,
        ntp_date: form.ntp_date || undefined,
        toe_signed_date: form.toe_signed_date || undefined,
        is_dry_research: form.is_dry_research === "true",
        start_date: form.start_date || undefined,
        target_end_date: form.target_end_date || undefined,
        rei_thrust: form.rei_thrust || undefined,
        sdgs: form.sdgs.map(Number),
        sector: form.sector,
        sector_other: form.sector === "others" ? form.sector_other : undefined,
        is_continuing: form.is_continuing === "true",
        research_type: form.research_type || undefined,
        research_priority_area: form.research_priority_area || undefined,
        research_typology: form.research_typology,
        campus: form.campus || undefined,
        implementing_unit: form.implementing_unit || undefined,
        cooperating_agencies: form.cooperating_agencies || undefined,
        total_cost: form.total_cost || undefined,
      });
      notify.success("Project registered.");
      navigate("/projects");
    } catch (err: any) {
      const data = err?.response?.data;
      notify.error(
        data?.detail ??
          data?.non_field_errors?.[0] ??
          data?.sdgs?.[0] ??
          data?.sector?.[0] ??
          data?.sector_other?.[0] ??
          "Could not register the project.",
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-3" onClick={() => navigate("/projects")}>
        <ArrowLeft className="size-4" />
        Back to Projects
      </Button>

      <PageHeader title="Register a Project" description="Requires an approved Notice to Proceed." />

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <FieldLabel required>Title</FieldLabel>
            <Input
              aria-invalid={attempted && !form.title.trim()}
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Project title"
            />
          </div>
          <div>
            <FieldLabel required>Project Code (LSPU Faculty Research Number)</FieldLabel>
            <Input
              aria-invalid={attempted && !form.project_code.trim()}
              value={form.project_code}
              onChange={(e) => setForm((p) => ({ ...p, project_code: e.target.value }))}
              placeholder="e.g. FRN-2026-001"
            />
          </div>
          <div>
            <FieldLabel required>Funding Type</FieldLabel>
            <Select value={form.funding_type} onValueChange={(v) => setForm((p) => ({ ...p, funding_type: v }))}>
              <SelectTrigger aria-invalid={attempted && !form.funding_type}>
                <SelectValue placeholder="Select funding type" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FUNDING_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-xs">Parent Program (optional)</Label>
            <Select value={form.program} onValueChange={(v) => setForm((p) => ({ ...p, program: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="No parent program" />
              </SelectTrigger>
              <SelectContent>
                {programs.length === 0 && <EmptyOption message="No programs registered yet" />}
                {programs.map((prog) => (
                  <SelectItem key={prog.id} value={String(prog.id)}>
                    {prog.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <FieldLabel required>Project Leader</FieldLabel>
            <Select value={form.lead} onValueChange={(v) => setForm((p) => ({ ...p, lead: v }))}>
              <SelectTrigger aria-invalid={attempted && !form.lead}>
                <SelectValue placeholder="Select leader" />
              </SelectTrigger>
              <SelectContent>
                {projectLeaders.length === 0 && <EmptyOption message="No active project leaders yet" />}
                {projectLeaders.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-xs">Research Type</Label>
            <Select
              value={form.is_dry_research}
              onValueChange={(v) => setForm((p) => ({ ...p, is_dry_research: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Dry Research</SelectItem>
                <SelectItem value="false">Wet / Laboratory Research</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-xs">NTP Number (optional)</Label>
            <Input
              value={form.ntp_number}
              onChange={(e) => setForm((p) => ({ ...p, ntp_number: e.target.value }))}
              placeholder="Notice to Proceed no."
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs">NTP Date (optional)</Label>
            <Input
              type="date"
              value={form.ntp_date}
              onChange={(e) => setForm((p) => ({ ...p, ntp_date: e.target.value }))}
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs">TOE Signed Date (optional)</Label>
            <Input
              type="date"
              value={form.toe_signed_date}
              onChange={(e) => setForm((p) => ({ ...p, toe_signed_date: e.target.value }))}
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Start Date (optional)</Label>
            <Input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Target End Date (optional)</Label>
            <Input
              type="date"
              value={form.target_end_date}
              onChange={(e) => setForm((p) => ({ ...p, target_end_date: e.target.value }))}
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs">REI Thrust (optional)</Label>
            <Input
              value={form.rei_thrust}
              onChange={(e) => setForm((p) => ({ ...p, rei_thrust: e.target.value }))}
              placeholder="e.g. Sustainable Agriculture"
            />
          </div>
          <div>
            <FieldLabel required>Sustainable Development Goals</FieldLabel>
            <MultiSelect
              invalid={attempted && form.sdgs.length === 0}
              options={SDG_OPTIONS}
              value={form.sdgs}
              onChange={(next) => setForm((p) => ({ ...p, sdgs: next }))}
              placeholder="Select SDGs"
            />
          </div>
          <div>
            <FieldLabel required>Sector</FieldLabel>
            <Select value={form.sector} onValueChange={(v) => setForm((p) => ({ ...p, sector: v }))}>
              <SelectTrigger aria-invalid={attempted && !form.sector}>
                <SelectValue placeholder="Select sector" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SECTOR_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.sector === "others" && (
            <div>
              <FieldLabel required>Specify Sector</FieldLabel>
              <Input
                aria-invalid={attempted && !form.sector_other.trim()}
                value={form.sector_other}
                onChange={(e) => setForm((p) => ({ ...p, sector_other: e.target.value }))}
                placeholder="Other sector"
              />
            </div>
          )}
          <div>
            <Label className="mb-1 block text-xs">Proposal Type</Label>
            <Select
              value={form.is_continuing}
              onValueChange={(v) => setForm((p) => ({ ...p, is_continuing: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">New Proposal</SelectItem>
                <SelectItem value="true">Continuing</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-xs">Research Category (optional)</Label>
            <Select
              value={form.research_type}
              onValueChange={(v) => setForm((p) => ({ ...p, research_type: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Basic or applied" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RESEARCH_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-xs">Research Priority Area (optional)</Label>
            <Select
              value={form.research_priority_area}
              onValueChange={(v) => setForm((p) => ({ ...p, research_priority_area: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select priority area" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRIORITY_AREA_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-xs">Research Typology (optional)</Label>
            <MultiSelect
              options={TYPOLOGY_OPTIONS}
              value={form.research_typology}
              onChange={(next) => setForm((p) => ({ ...p, research_typology: next }))}
              placeholder="Select typology"
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Campus (optional)</Label>
            <Input value={form.campus} onChange={(e) => setForm((p) => ({ ...p, campus: e.target.value }))} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Implementing Unit (optional)</Label>
            <Input
              value={form.implementing_unit}
              onChange={(e) => setForm((p) => ({ ...p, implementing_unit: e.target.value }))}
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Cooperating Agencies (optional)</Label>
            <Input
              value={form.cooperating_agencies}
              onChange={(e) => setForm((p) => ({ ...p, cooperating_agencies: e.target.value }))}
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Total Cost (optional)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.total_cost}
              onChange={(e) => setForm((p) => ({ ...p, total_cost: e.target.value }))}
              placeholder="0.00"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/projects")}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleCreate} disabled={isCreating}>
            <Plus className="size-4" />
            {isCreating ? "Registering..." : "Register Project"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function RegisterProjectPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Register a Project">
        <RegisterProjectContent />
      </AppShell>
    </ProtectedRoute>
  );
}
