import { apiClient } from "./apiClient";
import type {
  LeaderLoad,
  PersonnelChange,
  ProjectAssignment,
  StaffProfile,
  Task,
  TaskStatus,
  WorkloadRow,
} from "../types/personnel";

export const personnelApi = {
  getWorkload: async (params: { project?: number } = {}): Promise<WorkloadRow[]> => {
    const { data } = await apiClient.get("/api/personnel/workload/", { params });
    return data;
  },
  getTasks: async (
    params: { project?: number; study?: number; assignee?: number; status?: TaskStatus } = {},
  ): Promise<Task[]> => {
    const { data } = await apiClient.get("/api/personnel/tasks/", { params });
    return data;
  },
  createTask: async (payload: {
    project: number;
    study?: number | null;
    title: string;
    description?: string;
    due_date?: string;
    assignee: number;
  }): Promise<Task> => {
    const { data } = await apiClient.post("/api/personnel/tasks/", payload);
    return data;
  },
  updateTaskStatus: async (id: number, status: TaskStatus): Promise<Task> => {
    const { data } = await apiClient.patch(`/api/personnel/tasks/${id}/`, { status });
    return data;
  },
  deleteTask: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/personnel/tasks/${id}/`);
  },

  getStaffProfiles: async (): Promise<StaffProfile[]> => {
    const { data } = await apiClient.get("/api/personnel/staff-profiles/");
    return data;
  },
  createStaffProfile: async (payload: { user: number; staff_level: number }): Promise<StaffProfile> => {
    const { data } = await apiClient.post("/api/personnel/staff-profiles/", payload);
    return data;
  },
  updateStaffProfile: async (id: number, staff_level: number): Promise<StaffProfile> => {
    const { data } = await apiClient.patch(`/api/personnel/staff-profiles/${id}/`, { staff_level });
    return data;
  },

  getAssignments: async (
    params: { project?: number; study?: number; user?: number; active?: boolean } = {},
  ): Promise<ProjectAssignment[]> => {
    const { active, ...rest } = params;
    const { data } = await apiClient.get("/api/personnel/assignments/", {
      params: { ...rest, ...(active ? { active: "true" } : {}) },
    });
    return data;
  },
  createAssignment: async (payload: {
    user: number;
    project?: number | null;
    study?: number | null;
    role_label?: string;
    start_date: string;
  }): Promise<ProjectAssignment> => {
    const { data } = await apiClient.post("/api/personnel/assignments/", payload);
    return data;
  },
  updateAssignment: async (
    id: number,
    payload: { role_label?: string; end_date?: string | null },
  ): Promise<ProjectAssignment> => {
    const { data } = await apiClient.patch(`/api/personnel/assignments/${id}/`, payload);
    return data;
  },

  assignLeader: async (payload: {
    record_type: "program" | "project" | "study";
    record_id: number;
    lead: number;
  }): Promise<{ record_type: string; record_id: number; lead: number }> => {
    const { data } = await apiClient.post("/api/personnel/leaders/assign/", payload);
    return data;
  },
  getLeaderLoad: async (): Promise<LeaderLoad[]> => {
    const { data } = await apiClient.get("/api/personnel/leaders/load/");
    return data;
  },

  getChanges: async (): Promise<PersonnelChange[]> => {
    const { data } = await apiClient.get("/api/personnel/changes/");
    return data;
  },
  getChange: async (id: number): Promise<PersonnelChange> => {
    const { data } = await apiClient.get(`/api/personnel/changes/${id}/`);
    return data;
  },
  createChange: async (payload: {
    change_type: "leader" | "staff";
    program?: number | null;
    project?: number | null;
    study?: number | null;
    assignment?: number | null;
    outgoing: number;
    incoming: number;
    reason: string;
  }): Promise<PersonnelChange> => {
    const { data } = await apiClient.post("/api/personnel/changes/", payload);
    return data;
  },
  updateClearance: async (
    id: number,
    payload: { items?: string; par_number?: string; remarks?: string; acknowledge?: boolean },
  ): Promise<PersonnelChange> => {
    const { data } = await apiClient.patch(`/api/personnel/changes/${id}/clearance/`, payload);
    return data;
  },
  completeChange: async (id: number): Promise<PersonnelChange> => {
    const { data } = await apiClient.post(`/api/personnel/changes/${id}/complete/`);
    return data;
  },
};
