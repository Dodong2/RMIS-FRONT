import { queryOptions, useQuery } from "@tanstack/react-query";
import { authApi } from "./authApi";
import { budgetApi } from "./budgetApi";
import { researchApi } from "./researchApi";

export const queryKeys = {
  projects: ["projects"] as const,
  budgets: (project?: number) => (project ? (["budgets", project] as const) : (["budgets"] as const)),
  roles: ["roles"] as const,
  users: ["users"] as const,
};

export const projectsQuery = queryOptions({ queryKey: queryKeys.projects, queryFn: researchApi.getProjects });

export const budgetsQuery = (project?: number) =>
  queryOptions({ queryKey: queryKeys.budgets(project), queryFn: () => budgetApi.getBudgets(project) });

export const rolesQuery = queryOptions({ queryKey: queryKeys.roles, queryFn: authApi.getRoles });

export const usersQuery = queryOptions({ queryKey: queryKeys.users, queryFn: authApi.getUsers });

type Gate = { enabled?: boolean };

export const useProjects = (gate: Gate = {}) => useQuery({ ...projectsQuery, ...gate });

export const useBudgets = (project?: number, gate: Gate = {}) => useQuery({ ...budgetsQuery(project), ...gate });

export const useRoles = (gate: Gate = {}) => useQuery({ ...rolesQuery, ...gate });

export const useUsers = (gate: Gate = {}) => useQuery({ ...usersQuery, ...gate });
