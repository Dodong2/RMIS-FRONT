import { useEffect, useState } from "react";
import { ClipboardList, Plus, Trash2 } from "lucide-react";
import { personnelApi } from "../lib/personnelApi";
import { researchApi } from "../lib/researchApi";
import { errorMessage } from "../lib/errorMessage";
import type { Task, TaskStatus } from "../types/personnel";
import type { Project, Study } from "../types/research";
import type { AdminUser } from "../types/auth";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { useAuth } from "../context/AuthContext";
import { AppShell } from "../components/layout/AppShell";
import { EmptyOption } from "../components/common/EmptyOption";
import { FieldLabel } from "../components/common/FieldLabel";
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
import { notify } from "../lib/notify";

const TASK_ASSIGNER_CODES = [
  "system_admin",
  "crc_chair",
  "drd",
  "riuh",
  "program_leader",
  "project_leader",
  "study_leader",
];

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  for_review: "For Review",
  done: "Done",
  blocked: "Blocked",
};

const ALL = "all";

function TasksContent() {
  const { user } = useAuth();
  const canAssign = !!user?.role && TASK_ASSIGNER_CODES.includes(user.role.code);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [staff, setStaff] = useState<AdminUser[]>([]);
  const [studies, setStudies] = useState<Study[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [attempted, setAttempted] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);

  const [form, setForm] = useState({
    project: "",
    study: "",
    title: "",
    description: "",
    due_date: "",
    assignee: "",
  });
  const [isCreating, setIsCreating] = useState(false);

  const projectTitle = (id: number) => projects.find((p) => p.id === id)?.title ?? `#${id}`;

  const load = async () => {
    setIsLoading(true);
    try {
      const [taskList, projectList] = await Promise.all([
        personnelApi.getTasks(),
        researchApi.getProjects(),
      ]);
      setTasks(taskList);
      setProjects(projectList);
    } catch {
      notify.error("Could not load tasks. Check your connection and refresh.");
    } finally {
      setIsLoading(false);
    }

    if (canAssign) {
      try {
        setStaff(await researchApi.getUsersByRole("project_staff"));
      } catch {
        setStaff([]);
      }
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAssign]);

  const handleProjectChange = async (value: string) => {
    setForm((f) => ({ ...f, project: value, study: "" }));
    try {
      setStudies(await researchApi.getStudies(Number(value)));
    } catch {
      setStudies([]);
    }
  };

  const handleCreate = async () => {
    setAttempted(true);
    if (!form.project || !form.title || !form.assignee) {
      notify.error("Project, title, and assignee are required.");
      return;
    }
    setIsCreating(true);
    try {
      await personnelApi.createTask({
        project: Number(form.project),
        study: form.study ? Number(form.study) : null,
        title: form.title,
        description: form.description || undefined,
        due_date: form.due_date || undefined,
        assignee: Number(form.assignee),
      });
      setAttempted(false);
      notify.success("Task assigned.");
      setForm({ project: "", study: "", title: "", description: "", due_date: "", assignee: "" });
      setStudies([]);
      await load();
    } catch (err: any) {
      notify.error(errorMessage(err, "Could not assign the task."));
    } finally {
      setIsCreating(false);
    }
  };

  const handleStatusChange = async (task: Task, status: TaskStatus) => {
    try {
      const updated = await personnelApi.updateTaskStatus(task.id, status);
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err: any) {
      notify.error(errorMessage(err, "Could not update the task status."));
    }
  };

  const handleDelete = async (task: Task) => {
    try {
      await personnelApi.deleteTask(task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      notify.success("Task deleted.");
    } catch (err: any) {
      notify.error(errorMessage(err, "Could not delete the task."));
    }
  };

  const visibleTasks =
    statusFilter === ALL ? tasks : tasks.filter((t) => t.status === statusFilter);

  return (
    <div>
      <PageHeader
        title="Tasks"
        description={
          canAssign
            ? "Assign work to project staff and track its progress."
            : "Tasks assigned to you. Update the status as you work."
        }
      />

      {canAssign && (
        <Card className="mb-6 p-4">
          <h3 className="mb-3 text-sm font-semibold text-navy">Assign a Task</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <FieldLabel required>Project</FieldLabel>
              <Select value={form.project} onValueChange={handleProjectChange}>
                <SelectTrigger aria-invalid={attempted && (!form.project)}>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.length === 0 && <EmptyOption message="No projects registered yet" />}
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.project_code} — {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Study (optional)</Label>
              <Select
                value={form.study}
                onValueChange={(v) => setForm((f) => ({ ...f, study: v }))}
                disabled={studies.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No specific study" />
                </SelectTrigger>
                <SelectContent>
                  {studies.length === 0 && <EmptyOption message="No studies for this project" />}
                  {studies.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel required>Assignee</FieldLabel>
              <Select value={form.assignee} onValueChange={(v) => setForm((f) => ({ ...f, assignee: v }))}>
                <SelectTrigger aria-invalid={attempted && (!form.assignee)}>
                  <SelectValue placeholder="Select project staff" />
                </SelectTrigger>
                <SelectContent>
                  {staff.length === 0 && <EmptyOption message="No active project staff yet" />}
                  {staff.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel required>Title</FieldLabel>
              <Input aria-invalid={attempted && (!form.title.trim())}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Task title"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Due Date (optional)</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Description (optional)</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What needs to be done"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={handleCreate} disabled={isCreating}>
              <Plus className="size-4" />
              {isCreating ? "Assigning..." : "Assign Task"}
            </Button>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <h3 className="text-sm font-semibold text-navy">{canAssign ? "All Tasks" : "My Tasks"}</h3>
          <div className="w-44">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/60 hover:bg-secondary/60">
              <TableHead>Task</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              {canAssign && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeletonRows rows={4} columns={canAssign ? 6 : 5} />
            ) : visibleTasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canAssign ? 6 : 5} className="p-0">
                  <EmptyState
                    icon={<ClipboardList className="size-7" />}
                    title="No tasks found"
                    description={
                      canAssign
                        ? "Assign the first task above."
                        : "Nothing has been assigned to you yet."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              visibleTasks.map((task) => {
                const canUpdate = canAssign || task.assignee === user?.pk;
                return (
                  <TableRow key={task.id}>
                    <TableCell>
                      <p className="font-medium">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-muted-foreground">{task.description}</p>
                      )}
                    </TableCell>
                    <TableCell>{projectTitle(task.project)}</TableCell>
                    <TableCell>{task.assignee_detail.email}</TableCell>
                    <TableCell>{task.due_date ?? "—"}</TableCell>
                    <TableCell>
                      {canUpdate ? (
                        <Select
                          value={task.status}
                          onValueChange={(v) => handleStatusChange(task, v as TaskStatus)}
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline">{STATUS_LABELS[task.status]}</Badge>
                      )}
                    </TableCell>
                    {canAssign && (
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => handleDelete(task)}>
                          <Trash2 className="size-4" />
                        </Button>
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

export default function TasksPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Tasks">
        <TasksContent />
      </AppShell>
    </ProtectedRoute>
  );
}
