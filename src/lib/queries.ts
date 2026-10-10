import { queryOptions, useQuery } from "@tanstack/react-query";
import { authApi } from "./authApi";
import { budgetApi } from "./budgetApi";
import { documentApi } from "./documentApi";
import { financialApi } from "./financialApi";
import { monitoringApi } from "./monitoringApi";
import { personnelApi } from "./personnelApi";
import { researchApi } from "./researchApi";

export const queryKeys = {
  projects: ["projects"] as const,
  budgets: (project?: number) => (project ? (["budgets", project] as const) : (["budgets"] as const)),
  roles: ["roles"] as const,
  users: ["users"] as const,
  milestones: ["milestones"] as const,
  assignments: (params: AssignmentParams = {}) => ["assignments", params] as const,
  monitoringStatus: (project: number) => ["monitoring-status", project] as const,
  budgetSummaries: ["budget-summary"] as const,
  budgetSummary: (budget: number) => ["budget-summary", budget] as const,
  financialAll: ["financial"] as const,
  financial: (budget?: number) => ["financial", budget ?? "all"] as const,
  documentsAll: ["documents"] as const,
  documents: (params: DocumentParams = {}) => ["documents", params] as const,
  documentShares: (doc: number) => ["document-shares", doc] as const,
  assignmentsAll: ["assignments"] as const,
  staffProfiles: ["staff-profiles"] as const,
  usersByRole: (code: string) => ["users-by-role", code] as const,
  collaborationAll: ["collaboration"] as const,
  collaboration: (crossOnly: boolean) => ["collaboration", crossOnly] as const,
  personnelChanges: ["personnel-changes"] as const,
  programs: ["programs"] as const,
  tasksAll: ["tasks"] as const,
  tasks: (params: TaskParams = {}) => ["tasks", params] as const,
  taskUpdates: (task: number) => ["task-updates", task] as const,
  workloadAll: ["workload"] as const,
  workload: (project?: number) => ["workload", project ?? "all"] as const,
};

type AssignmentParams = Parameters<typeof personnelApi.getAssignments>[0];
type DocumentParams = Parameters<typeof documentApi.getDocuments>[0];
type TaskParams = Parameters<typeof personnelApi.getTasks>[0];

export const projectsQuery = queryOptions({ queryKey: queryKeys.projects, queryFn: researchApi.getProjects });

/** Every realignment in the user's scope (Budget page global view + notification bell). */
export const realignmentsQuery = () =>
  queryOptions({ queryKey: [...queryKeys.financialAll, "realignments"], queryFn: () => financialApi.getRealignments() });

export const budgetsQuery = (project?: number) =>
  queryOptions({ queryKey: queryKeys.budgets(project), queryFn: () => budgetApi.getBudgets(project) });

export const rolesQuery = queryOptions({ queryKey: queryKeys.roles, queryFn: authApi.getRoles });

export const usersQuery = queryOptions({ queryKey: queryKeys.users, queryFn: authApi.getUsers });

export const milestonesQuery = queryOptions({ queryKey: queryKeys.milestones, queryFn: () => researchApi.getMilestones() });

export const assignmentsQuery = (params: AssignmentParams = {}) =>
  queryOptions({ queryKey: queryKeys.assignments(params), queryFn: () => personnelApi.getAssignments(params) });

export const monitoringStatusQuery = (project: number) =>
  queryOptions({ queryKey: queryKeys.monitoringStatus(project), queryFn: () => monitoringApi.getProjectStatus(project) });

export const budgetSummaryQuery = (budget: number) =>
  queryOptions({ queryKey: queryKeys.budgetSummary(budget), queryFn: () => financialApi.getBudgetSummary(budget) });

export const financialRecordsQuery = (budget?: number) =>
  queryOptions({
    queryKey: queryKeys.financial(budget),
    queryFn: async () => {
      const [disbursements, realignments] = await Promise.all([
        financialApi.getDisbursements(budget ? { budget } : {}),
        financialApi.getRealignments(budget),
      ]);
      return { disbursements, realignments };
    },
  });

export const documentsQuery = (params: DocumentParams = {}) =>
  queryOptions({ queryKey: queryKeys.documents(params), queryFn: () => documentApi.getDocuments(params) });

export const documentSharesQuery = (doc: number) =>
  queryOptions({ queryKey: queryKeys.documentShares(doc), queryFn: () => documentApi.getShares(doc) });

export const staffProfilesQuery = queryOptions({ queryKey: queryKeys.staffProfiles, queryFn: () => personnelApi.getStaffProfiles() });

export const usersByRoleQuery = (code: string) =>
  queryOptions({ queryKey: queryKeys.usersByRole(code), queryFn: () => researchApi.getUsersByRole(code) });

export const collaborationQuery = (crossOnly: boolean) =>
  queryOptions({ queryKey: queryKeys.collaboration(crossOnly), queryFn: () => personnelApi.getCollaboration({ cross_only: crossOnly }) });

export const personnelChangesQuery = queryOptions({ queryKey: queryKeys.personnelChanges, queryFn: () => personnelApi.getChanges() });

export const programsQuery = queryOptions({ queryKey: queryKeys.programs, queryFn: () => researchApi.getPrograms() });

export const tasksQuery = (params: TaskParams = {}) =>
  queryOptions({ queryKey: queryKeys.tasks(params), queryFn: () => personnelApi.getTasks(params) });

export const taskUpdatesQuery = (task: number) =>
  queryOptions({ queryKey: queryKeys.taskUpdates(task), queryFn: () => personnelApi.getTaskUpdates(task) });

export const workloadQuery = (project?: number) =>
  queryOptions({ queryKey: queryKeys.workload(project), queryFn: () => personnelApi.getWorkload(project ? { project } : {}) });

type Gate = { enabled?: boolean };

export const useProjects = (gate: Gate = {}) => useQuery({ ...projectsQuery, ...gate });

export const useBudgets = (project?: number, gate: Gate = {}) => useQuery({ ...budgetsQuery(project), ...gate });

export const useRoles = (gate: Gate = {}) => useQuery({ ...rolesQuery, ...gate });

export const useUsers = (gate: Gate = {}) => useQuery({ ...usersQuery, ...gate });
