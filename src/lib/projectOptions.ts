import type { PriorityArea, ResearchType, Sector, Typology } from "../types/research";

export const SECTOR_LABELS: Record<Sector, string> = {
  agriculture_fisheries: "Agriculture/Fisheries",
  education: "Education",
  community_development: "Community Development",
  information_tech: "Information Tech.",
  politics: "Politics",
  others: "Others",
};

export const RESEARCH_TYPE_LABELS: Record<ResearchType, string> = {
  basic: "Basic Research",
  applied: "Applied Research",
};

export const PRIORITY_AREA_LABELS: Record<PriorityArea, string> = {
  science_math: "Science and Mathematics",
  education_teacher_training: "Education and Teacher's Training",
  health: "Health and Health Profession",
  ict: "Information and Communication Tech.",
  engineering: "Engineering",
  agriculture_fisheries: "Agriculture and Fisheries",
  environmental_science: "Environmental Science",
  social_sciences_humanities: "Social Sciences and Humanities",
};

export const TYPOLOGY_LABELS: Record<Typology, string> = {
  operations: "Operations Research",
  development: "Development Research",
  qualitative: "Qualitative Research",
  quantitative: "Quantitative Research",
  descriptive_survey: "Descriptive/Survey Research",
  laboratory_field: "Laboratory/Field Research",
  quasi_experimental: "Quasi-Experimental Research",
  pure_experimental: "Pure Experimental Research",
};

export const SDG_LABELS: Record<number, string> = {
  1: "No Poverty",
  2: "Zero Hunger",
  3: "Good Health and Well-being",
  4: "Quality Education",
  5: "Gender Equality",
  6: "Clean Water and Sanitation",
  7: "Affordable and Clean Energy",
  8: "Decent Work and Economic Growth",
  9: "Industry, Innovation and Infrastructure",
  10: "Reduced Inequalities",
  11: "Sustainable Cities and Communities",
  12: "Responsible Consumption and Production",
  13: "Climate Action",
  14: "Life Below Water",
  15: "Life on Land",
  16: "Peace, Justice and Strong Institutions",
  17: "Partnerships for the Goals",
};

export const SDG_OPTIONS = Object.entries(SDG_LABELS).map(([n, label]) => ({
  value: n,
  label: `SDG ${n} — ${label}`,
}));

export const TYPOLOGY_OPTIONS = Object.entries(TYPOLOGY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export const SECTOR_OPTIONS = Object.entries(SECTOR_LABELS).map(([value, label]) => ({
  value,
  label,
}));
