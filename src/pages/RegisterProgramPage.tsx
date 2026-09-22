import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { researchApi } from "../lib/researchApi";
import type { FundingType } from "../types/research";
import type { AdminUser } from "../types/auth";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { AppShell } from "../components/layout/AppShell";
import { EmptyOption } from "../components/common/EmptyOption";
import { FieldLabel } from "../components/common/FieldLabel";
import { PageHeader } from "../components/common/Page";
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

function RegisterProgramContent() {
  const navigate = useNavigate();
  const [programLeaders, setProgramLeaders] = useState<AdminUser[]>([]);
  const [attempted, setAttempted] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [form, setForm] = useState({
    title: "",
    funding_type: "",
    lead: "",
    rei_thrust: "",
    start_date: "",
  });

  useEffect(() => {
    (async () => {
      try {
        setProgramLeaders(await researchApi.getUsersByRole("program_leader"));
      } catch {
        notify.error("Could not load program leaders. Check your connection and refresh.");
      }
    })();
  }, []);

  const handleCreate = async () => {
    setAttempted(true);
    if (!form.title || !form.funding_type || !form.lead) {
      notify.error("Program title, funding type, and lead are required.");
      return;
    }
    setIsCreating(true);
    try {
      await researchApi.createProgram({
        title: form.title,
        funding_type: form.funding_type,
        lead: Number(form.lead),
        rei_thrust: form.rei_thrust || undefined,
        start_date: form.start_date || undefined,
      });
      notify.success("Program registered.");
      navigate("/projects");
    } catch (err: any) {
      notify.error(
        err?.response?.data?.detail ??
          err?.response?.data?.non_field_errors?.[0] ??
          "Could not register the program.",
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

      <PageHeader title="Register a Program" description="Group two or more related projects under a shared program." />

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel required>Title</FieldLabel>
            <Input
              aria-invalid={attempted && !form.title.trim()}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Program title"
            />
          </div>
          <div>
            <FieldLabel required>Funding Type</FieldLabel>
            <Select value={form.funding_type} onValueChange={(v) => setForm((f) => ({ ...f, funding_type: v }))}>
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
            <FieldLabel required>Program Leader</FieldLabel>
            <Select value={form.lead} onValueChange={(v) => setForm((f) => ({ ...f, lead: v }))}>
              <SelectTrigger aria-invalid={attempted && !form.lead}>
                <SelectValue placeholder="Select leader" />
              </SelectTrigger>
              <SelectContent>
                {programLeaders.length === 0 && <EmptyOption message="No active program leaders yet" />}
                {programLeaders.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-xs">REI Thrust (optional)</Label>
            <Input
              value={form.rei_thrust}
              onChange={(e) => setForm((f) => ({ ...f, rei_thrust: e.target.value }))}
              placeholder="e.g. Sustainable Agriculture"
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Start Date (optional)</Label>
            <Input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/projects")}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleCreate} disabled={isCreating}>
            <Plus className="size-4" />
            {isCreating ? "Registering..." : "Register Program"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function RegisterProgramPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Register a Program">
        <RegisterProgramContent />
      </AppShell>
    </ProtectedRoute>
  );
}
