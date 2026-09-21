import { useEffect, useState } from "react";
import { Plus, UserPlus } from "lucide-react";
import { personnelApi } from "../lib/personnelApi";
import { researchApi } from "../lib/researchApi";
import { errorMessage } from "../lib/errorMessage";
import type { ProjectAssignment, StaffProfile } from "../types/personnel";
import type { Project, Study } from "../types/research";
import type { AdminUser } from "../types/auth";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { useAuth } from "../context/AuthContext";
import { AppShell } from "../components/layout/AppShell";
import { FormAlert } from "../components/common/FormAlert";
import { EmptyState, PageHeader, TableSkeletonRows } from "../components/common/Page";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const MANAGE_CODES = ["system_admin", "crc_chair", "drd", "riuh"];

const LEVELS = ["1", "2", "3"];

const today = () => new Date().toLocaleDateString("en-CA");

function StaffContent() {
  const { user } = useAuth();
  const canManage = !!user?.role && MANAGE_CODES.includes(user.role.code);

  const [profiles, setProfiles] = useState<StaffProfile[]>([]);
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [studies, setStudies] = useState<Study[]>([]);
  const [staffUsers, setStaffUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);

  const [profileForm, setProfileForm] = useState({ user: "", staff_level: "" });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [assignForm, setAssignForm] = useState({
    user: "",
    target: "project",
    project: "",
    study: "",
    role_label: "",
    start_date: today(),
  });
  const [isAssigning, setIsAssigning] = useState(false);

  const projectTitle = (id: number | null) => projects.find((p) => p.id === id)?.title ?? `#${id}`;
  const levelOf = (userId: number) => profiles.find((p) => p.user === userId)?.staff_level;
  const profileUserIds = new Set(profiles.map((p) => p.user));
  const unprofiled = staffUsers.filter((u) => !profileUserIds.has(u.id));

  const load = async () => {
    setIsLoading(true);
    try {
      const [profileList, assignmentList, projectList] = await Promise.all([
        personnelApi.getStaffProfiles(),
        personnelApi.getAssignments(),
        researchApi.getProjects(),
      ]);
      setProfiles(profileList);
      setAssignments(assignmentList);
      setProjects(projectList);
      setError("");
    } catch {
      setError("Could not load staff records. Check your connection and refresh.");
    } finally {
      setIsLoading(false);
    }

    if (canManage) {
      try {
        setStaffUsers(await researchApi.getUsersByRole("project_staff"));
      } catch {
        setStaffUsers([]);
      }
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  const handleAddProfile = async () => {
    setError("");
    setSuccess("");
    if (!profileForm.user || !profileForm.staff_level) {
      setError("Select a staff member and a level.");
      return;
    }
    setIsSavingProfile(true);
    try {
      await personnelApi.createStaffProfile({
        user: Number(profileForm.user),
        staff_level: Number(profileForm.staff_level),
      });
      setSuccess("Staff level saved.");
      setProfileForm({ user: "", staff_level: "" });
      await load();
    } catch (err) {
      setError(errorMessage(err, "Could not save the staff level."));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleLevelChange = async (profile: StaffProfile, level: string) => {
    setError("");
    setSuccess("");
    try {
      const updated = await personnelApi.updateStaffProfile(profile.id, Number(level));
      setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err) {
      setError(errorMessage(err, "Could not update the staff level."));
    }
  };

  const handleTargetProject = async (value: string) => {
    setAssignForm((f) => ({ ...f, project: value, study: "" }));
    try {
      setStudies(await researchApi.getStudies(Number(value)));
    } catch {
      setStudies([]);
    }
  };

  const handleAssign = async () => {
    setError("");
    setSuccess("");
    const targetId = assignForm.target === "project" ? assignForm.project : assignForm.study;
    if (!assignForm.user || !targetId || !assignForm.start_date) {
      setError("Staff member, project or study, and start date are required.");
      return;
    }
    setIsAssigning(true);
    try {
      await personnelApi.createAssignment({
        user: Number(assignForm.user),
        project: assignForm.target === "project" ? Number(targetId) : null,
        study: assignForm.target === "study" ? Number(targetId) : null,
        role_label: assignForm.role_label || undefined,
        start_date: assignForm.start_date,
      });
      setSuccess("Staff assigned.");
      setAssignForm({
        user: "",
        target: "project",
        project: "",
        study: "",
        role_label: "",
        start_date: today(),
      });
      setStudies([]);
      await load();
    } catch (err) {
      setError(errorMessage(err, "Could not create the assignment."));
    } finally {
      setIsAssigning(false);
    }
  };

  const handleEnd = async (assignment: ProjectAssignment) => {
    setError("");
    setSuccess("");
    try {
      const updated = await personnelApi.updateAssignment(assignment.id, { end_date: today() });
      setAssignments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setSuccess("Assignment ended.");
    } catch (err) {
      setError(errorMessage(err, "Could not end the assignment."));
    }
  };

  const visibleAssignments = activeOnly ? assignments.filter((a) => a.is_active) : assignments;

  return (
    <div>
      <PageHeader
        title="Staff and assignments"
        description="Project staff levels and who is assigned to which project or study."
      />

      <FormAlert tone="error" message={error} className="mb-4" />
      <FormAlert tone="success" message={success} className="mb-4" />

      {canManage && (
        <Card className="mb-6 p-4">
          <h3 className="mb-3 text-sm font-semibold text-navy">Set a Staff Level</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label className="mb-1 block text-xs">Project Staff</Label>
              <Select value={profileForm.user} onValueChange={(v) => setProfileForm((f) => ({ ...f, user: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff without a level" />
                </SelectTrigger>
                <SelectContent>
                  {unprofiled.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Level</Label>
              <Select
                value={profileForm.staff_level}
                onValueChange={(v) => setProfileForm((f) => ({ ...f, staff_level: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      Level {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button size="sm" onClick={handleAddProfile} disabled={isSavingProfile}>
                <Plus className="size-4" />
                {isSavingProfile ? "Saving..." : "Save Level"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="mb-6 overflow-hidden p-0">
        <div className="border-b border-border p-4">
          <h3 className="text-sm font-semibold text-navy">Staff Levels</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/60 hover:bg-secondary/60">
              <TableHead>Staff</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeletonRows rows={3} columns={3} />
            ) : profiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="p-0">
                  <EmptyState
                    icon={<UserPlus className="size-7" />}
                    title="No staff levels yet"
                    description="Set a level for each project staff member."
                  />
                </TableCell>
              </TableRow>
            ) : (
              profiles.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.user_detail.email}</TableCell>
                  <TableCell>
                    {canManage ? (
                      <Select
                        value={String(p.staff_level)}
                        onValueChange={(v) => handleLevelChange(p, v)}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEVELS.map((l) => (
                            <SelectItem key={l} value={l}>
                              Level {l}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline">Level {p.staff_level}</Badge>
                    )}
                  </TableCell>
                  <TableCell>{new Date(p.updated_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {canManage && (
        <Card className="mb-6 p-4">
          <h3 className="mb-3 text-sm font-semibold text-navy">Assign Staff</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label className="mb-1 block text-xs">Project Staff</Label>
              <Select value={assignForm.user} onValueChange={(v) => setAssignForm((f) => ({ ...f, user: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent>
                  {staffUsers.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Assign To</Label>
              <Select
                value={assignForm.target}
                onValueChange={(v) => setAssignForm((f) => ({ ...f, target: v, study: "" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="project">A project</SelectItem>
                  <SelectItem value="study">A study</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Project</Label>
              <Select value={assignForm.project} onValueChange={handleTargetProject}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.project_code} — {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {assignForm.target === "study" && (
              <div>
                <Label className="mb-1 block text-xs">Study</Label>
                <Select
                  value={assignForm.study}
                  onValueChange={(v) => setAssignForm((f) => ({ ...f, study: v }))}
                  disabled={studies.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select study" />
                  </SelectTrigger>
                  <SelectContent>
                    {studies.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="mb-1 block text-xs">Role Label (optional)</Label>
              <Input
                value={assignForm.role_label}
                onChange={(e) => setAssignForm((f) => ({ ...f, role_label: e.target.value }))}
                placeholder="e.g. Research Assistant"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Start Date</Label>
              <Input
                type="date"
                value={assignForm.start_date}
                onChange={(e) => setAssignForm((f) => ({ ...f, start_date: e.target.value }))}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={handleAssign} disabled={isAssigning}>
              <Plus className="size-4" />
              {isAssigning ? "Assigning..." : "Assign Staff"}
            </Button>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <h3 className="text-sm font-semibold text-navy">Assignments</h3>
          <div className="w-44">
            <Select value={activeOnly ? "active" : "all"} onValueChange={(v) => setActiveOnly(v === "active")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="all">All assignments</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/60 hover:bg-secondary/60">
              <TableHead>Staff</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Period</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeletonRows rows={3} columns={canManage ? 6 : 5} />
            ) : visibleAssignments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canManage ? 6 : 5} className="p-0">
                  <EmptyState
                    icon={<UserPlus className="size-7" />}
                    title="No assignments"
                    description="Staff assigned to a project or study will appear here."
                  />
                </TableCell>
              </TableRow>
            ) : (
              visibleAssignments.map((a) => {
                const level = levelOf(a.user);
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.user_detail.email}</TableCell>
                    <TableCell>{level ? `Level ${level}` : "—"}</TableCell>
                    <TableCell>
                      {a.project ? projectTitle(a.project) : `Study #${a.study}`}
                    </TableCell>
                    <TableCell>{a.role_label || "—"}</TableCell>
                    <TableCell>
                      {a.start_date} → {a.end_date ?? "present"}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        {a.is_active && (
                          <Button size="sm" variant="outline" onClick={() => handleEnd(a)}>
                            End
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export default function StaffPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Staff and assignments">
        <StaffContent />
      </AppShell>
    </ProtectedRoute>
  );
}
