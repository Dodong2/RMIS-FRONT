import type { ReportFormat, ReportType } from "../types/reports";

export type ReportDomain = "project" | "financial" | "compliance" | "output" | "monitoring" | "risk" | "personnel" | "institutional";
export type CatalogFormat = ReportFormat;
export type ReportParam = "project" | "campus" | "funding_type" | "status" | "rei_thrust" | "year";
export type ClientReportId = "risk_register" | "evaluation_summary";

export interface ReportDefinition {
  id: ReportType | ClientReportId;
  name: string;
  domain: ReportDomain;
  description: string;
  icon: string;
  source: "server" | "client";
  formats: CatalogFormat[];
  params: ReportParam[];
  required: ReportParam[];
}

const SERVER_FORMATS: CatalogFormat[] = ["pdf", "xlsx", "csv", "docx"];
const CLIENT_FORMATS: CatalogFormat[] = ["pdf", "xlsx"];
const SCOPE: ReportParam[] = ["campus", "funding_type"];

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  { id: "project_list", name: "Project Status Summary Report", domain: "project", icon: "📁", source: "server", formats: SERVER_FORMATS, params: ["campus", "funding_type", "status", "rei_thrust", "year"], required: [], description: "Filtered list of programs/projects by campus, funding type, status, REI thrust and start year." },
  { id: "appendix_e", name: "Appendix E — Midterm Progress Report", domain: "monitoring", icon: "📋", source: "server", formats: SERVER_FORMATS, params: ["project"], required: ["project"], description: "Midterm progress per project year: narrative, expenditure summary and accomplishments." },
  { id: "appendix_f", name: "Appendix F — Terminal Report", domain: "monitoring", icon: "📘", source: "server", formats: SERVER_FORMATS, params: ["project"], required: ["project"], description: "End-of-project terminal report. Available once the project has a submitted terminal report." },
  { id: "evaluation_summary", name: "Evaluation Summary Report", domain: "monitoring", icon: "⚖️", source: "client", formats: CLIENT_FORMATS, params: ["project"], required: [], description: "Scheduled and completed panel evaluations with outcome and rubric-weighted score." },
  { id: "financial", name: "Financial / Procurement Report", domain: "financial", icon: "💰", source: "server", formats: SERVER_FORMATS, params: SCOPE, required: [], description: "Approved, adjusted and actual amounts per project (current LIB) plus the procurement pipeline." },
  { id: "compliance", name: "Compliance Report", domain: "compliance", icon: "✅", source: "server", formats: SERVER_FORMATS, params: SCOPE, required: [], description: "Requirement fulfillment, similarity checks, AI declarations and integrity records per project." },
  { id: "outputs", name: "Research Outputs (6Ps) Report", domain: "output", icon: "📄", source: "server", formats: SERVER_FORMATS, params: SCOPE, required: [], description: "Expected vs. actual outputs across the 6Ps per project." },
  { id: "risk_register", name: "Risk Register Export", domain: "risk", icon: "⚠️", source: "client", formats: CLIENT_FORMATS, params: ["project"], required: [], description: "Full risk register with L×I scores, levels, owners, status and mitigation actions." },
  { id: "personnel", name: "Personnel and Task Report", domain: "personnel", icon: "👥", source: "server", formats: SERVER_FORMATS, params: SCOPE, required: [], description: "Leaders and assigned staff per project with their task load." },
  { id: "appendix_g", name: "Appendix G — R&D Accomplishment Report", domain: "institutional", icon: "🏫", source: "server", formats: SERVER_FORMATS, params: ["campus", "year"], required: [], description: "Institution-wide (or campus-scoped) research and development accomplishment summary." },
];

export const DOMAIN_META: Record<ReportDomain, { label: string; color: string; bg: string; icon: string }> = {
  project: { label: "Project", color: "#0d2a5e", bg: "#e0eaf7", icon: "📁" },
  financial: { label: "Financial", color: "#0891b2", bg: "#e0f2fe", icon: "💰" },
  compliance: { label: "Compliance", color: "#f59e0b", bg: "#fef3c7", icon: "✅" },
  output: { label: "Output", color: "#059669", bg: "#d1fae5", icon: "📄" },
  monitoring: { label: "Monitoring", color: "#7c3aed", bg: "#ede9fe", icon: "🎯" },
  risk: { label: "Risk", color: "#dc2626", bg: "#fee2e2", icon: "⚠️" },
  personnel: { label: "Personnel", color: "#ea580c", bg: "#ffedd5", icon: "👥" },
  institutional: { label: "Institutional", color: "#334155", bg: "#f1f5f9", icon: "🏫" },
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
  rei_thrust: "REI Thrust",
  year: "Year",
};

export const FUNDING_TYPE_LABELS: Record<string, string> = {
  institutional: "Institutional (LSPU-Funded)",
  core_funded: "Core-Funded (Self-Funded)",
  externally_funded: "Externally-Funded",
};

export const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  completed: "Completed",
  archived: "Archived",
};
