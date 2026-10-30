import type { ReactNode } from "react";
import { BookOpen, CircleCheck, ClipboardList, FileText, Folder, Scale, School, Target, TriangleAlert, Users, Wallet } from "lucide-react";
import type { ReportFormat, ReportType } from "../types/reports";

const ICON = "inline-block h-[1em] w-[1em] align-[-0.125em]";

export type ReportDomain = "project" | "financial" | "compliance" | "output" | "monitoring" | "risk" | "personnel" | "institutional";
export type CatalogFormat = ReportFormat;
export type ReportParam = "project" | "campus" | "funding_type" | "status" | "rde_thrust" | "year";
export type ClientReportId = "risk_register" | "evaluation_summary";

export interface ReportDefinition {
  id: ReportType | ClientReportId;
  name: string;
  domain: ReportDomain;
  description: string;
  icon: ReactNode;
  source: "server" | "client";
  formats: CatalogFormat[];
  params: ReportParam[];
  required: ReportParam[];
}

const SERVER_FORMATS: CatalogFormat[] = ["pdf", "xlsx", "csv", "docx"];
const CLIENT_FORMATS: CatalogFormat[] = ["pdf", "xlsx"];
const SCOPE: ReportParam[] = ["campus", "funding_type"];

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  { id: "project_list", name: "Project Status Summary Report", domain: "project", icon: <Folder className={ICON} aria-hidden="true" />, source: "server", formats: SERVER_FORMATS, params: ["campus", "funding_type", "status", "rde_thrust", "year"], required: [], description: "Filtered list of programs/projects by campus, funding type, status, RDE thrust and start year." },
  { id: "appendix_e", name: "Appendix E — Midterm Progress Report", domain: "monitoring", icon: <ClipboardList className={ICON} aria-hidden="true" />, source: "server", formats: SERVER_FORMATS, params: ["project"], required: ["project"], description: "LSPU-RDO-SF-017 form per project year: % accomplishment per objective (Q1–Q4) and the 6Ps matrix. Same layout in every format." },
  { id: "appendix_f", name: "Appendix F — Terminal Report", domain: "monitoring", icon: <BookOpen className={ICON} aria-hidden="true" />, source: "server", formats: SERVER_FORMATS, params: ["project"], required: ["project"], description: "SF-16 terminal narrative report outline, filled from the project's registration and terminal report. Available once a terminal report is submitted." },
  { id: "evaluation_summary", name: "Evaluation Summary Report", domain: "monitoring", icon: <Scale className={ICON} aria-hidden="true" />, source: "client", formats: CLIENT_FORMATS, params: ["project"], required: [], description: "Scheduled and completed panel evaluations with outcome and rubric-weighted score." },
  { id: "financial", name: "Financial / Procurement Report", domain: "financial", icon: <Wallet className={ICON} aria-hidden="true" />, source: "server", formats: SERVER_FORMATS, params: SCOPE, required: [], description: "Approved, adjusted and actual amounts per project (current LIB) plus the procurement pipeline." },
  { id: "compliance", name: "Compliance Report", domain: "compliance", icon: <CircleCheck className={ICON} aria-hidden="true" />, source: "server", formats: SERVER_FORMATS, params: SCOPE, required: [], description: "Requirement fulfillment, similarity checks, AI declarations and integrity records per project." },
  { id: "outputs", name: "Research Outputs (6Ps) Report", domain: "output", icon: <FileText className={ICON} aria-hidden="true" />, source: "server", formats: SERVER_FORMATS, params: SCOPE, required: [], description: "Expected vs. actual outputs across the 6Ps per project." },
  { id: "risk_register", name: "Risk Register Export", domain: "risk", icon: <TriangleAlert className={ICON} aria-hidden="true" />, source: "client", formats: CLIENT_FORMATS, params: ["project"], required: [], description: "Full risk register with L×I scores, levels, owners, status and mitigation actions." },
  { id: "personnel", name: "Personnel and Task Report", domain: "personnel", icon: <Users className={ICON} aria-hidden="true" />, source: "server", formats: SERVER_FORMATS, params: SCOPE, required: [], description: "Leaders and assigned staff per project with their task load." },
  { id: "appendix_g", name: "Appendix G — R&D Accomplishment Report", domain: "institutional", icon: <School className={ICON} aria-hidden="true" />, source: "server", formats: SERVER_FORMATS, params: ["campus", "year"], required: [], description: "Institution-wide (or campus-scoped) research and development accomplishment summary." },
];

export const DOMAIN_META: Record<ReportDomain, { label: string; color: string; bg: string; icon: ReactNode }> = {
  project: { label: "Project", color: "#0d2a5e", bg: "#e0eaf7", icon: <Folder className={ICON} aria-hidden="true" /> },
  financial: { label: "Financial", color: "#0891b2", bg: "#e0f2fe", icon: <Wallet className={ICON} aria-hidden="true" /> },
  compliance: { label: "Compliance", color: "#f59e0b", bg: "#fef3c7", icon: <CircleCheck className={ICON} aria-hidden="true" /> },
  output: { label: "Output", color: "#059669", bg: "#d1fae5", icon: <FileText className={ICON} aria-hidden="true" /> },
  monitoring: { label: "Monitoring", color: "#7c3aed", bg: "#ede9fe", icon: <Target className={ICON} aria-hidden="true" /> },
  risk: { label: "Risk", color: "#dc2626", bg: "#fee2e2", icon: <TriangleAlert className={ICON} aria-hidden="true" /> },
  personnel: { label: "Personnel", color: "#ea580c", bg: "#ffedd5", icon: <Users className={ICON} aria-hidden="true" /> },
  institutional: { label: "Institutional", color: "#334155", bg: "#f1f5f9", icon: <School className={ICON} aria-hidden="true" /> },
};

export const FORMAT_META: Record<CatalogFormat, { label: string; color: string; bg: string }> = {
  pdf: { label: "PDF", color: "#dc2626", bg: "#fee2e2" },
  xlsx: { label: "Excel", color: "#059669", bg: "#d1fae5" },
  csv: { label: "CSV", color: "#0891b2", bg: "#e0f2fe" },
  docx: { label: "Word", color: "#1d4ed8", bg: "#dbeafe" },
};

export const PARAM_LABELS: Record<ReportParam, string> = {
  project: "Project",
  campus: "Campus",
  funding_type: "Funding Type",
  status: "Project Status",
  rde_thrust: "RDE Thrust",
  year: "Year",
};


export const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  completed: "Completed",
  archived: "Archived",
};
