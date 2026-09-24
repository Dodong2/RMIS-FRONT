import { useEffect, useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import { complianceApi } from "../lib/complianceApi";
import { researchApi } from "../lib/researchApi";
import { errorMessage } from "../lib/errorMessage";
import type {
  AIUseDeclaration,
  COIStatus,
  ConflictOfInterestDisclosure,
  EthicsReviewBody,
  EthicsReviewReference,
  EthicsReviewStatus,
  MisconductCaseReference,
  MisconductCaseStatus,
  MisconductCaseType,
  SimilarityCheckRecord,
  SimilarityDocumentType,
} from "../types/compliance";
import type { Project, Study } from "../types/research";
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

const MANAGE_ROLE_CODES = ["system_admin", "riuh"];

const REVIEW_BODY_LABELS: Record<EthicsReviewBody, string> = {
  trc: "Technical Review Committee",
  integrity_review: "Research Integrity Review",
  external_review: "External Review Body",
};

const ETHICS_STATUS_LABELS: Record<EthicsReviewStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  conditional: "Conditionally Approved",
  revision_required: "Revision Required",
  rejected: "Rejected",
};

const DOC_TYPE_LABELS: Record<SimilarityDocumentType, string> = {
  published_article: "Article for Publication",
  thesis_dissertation: "Thesis/Dissertation",
  other: "Other",
};

const COI_STATUS_LABELS: Record<COIStatus, string> = {
  disclosed: "Disclosed",
  under_review: "Under Review",
  resolved: "Resolved",
};

const CASE_TYPE_LABELS: Record<MisconductCaseType, string> = {
  plagiarism: "Plagiarism",
  fabrication: "Fabrication",
  falsification: "Falsification",
  other: "Other",
};

const MISCONDUCT_STATUS_LABELS: Record<MisconductCaseStatus, string> = {
  reported: "Reported",
  under_investigation: "Under Investigation",
  upheld: "Upheld",
  dismissed: "Dismissed",
};

const SECTIONS = [
  { key: "ethics", label: "Ethics Reviews" },
  { key: "similarity", label: "Similarity Checks" },
  { key: "ai", label: "AI Declarations" },
  { key: "coi", label: "COI Disclosures" },
  { key: "misconduct", label: "Misconduct Cases" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

const today = () => new Date().toLocaleDateString("en-CA");

function ComplianceContent() {
  const { user } = useAuth();
  const canManage = !!user?.role && MANAGE_ROLE_CODES.includes(user.role.code);

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [studies, setStudies] = useState<Study[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [section, setSection] = useState<SectionKey>("ethics");

  const [ethicsReviews, setEthicsReviews] = useState<EthicsReviewReference[]>([]);
  const [similarityChecks, setSimilarityChecks] = useState<SimilarityCheckRecord[]>([]);
  const [aiDeclarations, setAiDeclarations] = useState<AIUseDeclaration[]>([]);
  const [coiDisclosures, setCoiDisclosures] = useState<ConflictOfInterestDisclosure[]>([]);
  const [misconductCases, setMisconductCases] = useState<MisconductCaseReference[]>([]);
  const [isLoadingSection, setIsLoadingSection] = useState(false);

  const [ethicsForm, setEthicsForm] = useState({
    study: "",
    review_body: "",
    reference_number: "",
    decision_date: "",
    remarks: "",
  });
  const [isSavingEthics, setIsSavingEthics] = useState(false);
  const [attemptedEthics, setAttemptedEthics] = useState(false);

  const [similarityForm, setSimilarityForm] = useState({
    study: "",
    document_type: "",
    document_title: "",
    similarity_index: "",
    software_used: "",
    checked_on: today(),
  });
  const [isSavingSimilarity, setIsSavingSimilarity] = useState(false);
  const [attemptedSimilarity, setAttemptedSimilarity] = useState(false);

  const [aiForm, setAiForm] = useState({
    study: "",
    tool_name: "",
    purpose: "",
    extent: "",
    declared_on: today(),
  });
  const [isSavingAi, setIsSavingAi] = useState(false);
  const [attemptedAi, setAttemptedAi] = useState(false);

  const [coiForm, setCoiForm] = useState({ description: "", mitigation_measures: "", disclosed_on: today() });
  const [isSavingCoi, setIsSavingCoi] = useState(false);
  const [attemptedCoi, setAttemptedCoi] = useState(false);

  const [misconductForm, setMisconductForm] = useState({
    subject_name: "",
    case_type: "",
    referred_to: "",
    remarks: "",
    reported_on: today(),
  });
  const [isSavingMisconduct, setIsSavingMisconduct] = useState(false);
  const [attemptedMisconduct, setAttemptedMisconduct] = useState(false);

  useEffect(() => {
    (async () => {
      setIsLoadingProjects(true);
      try {
        setProjects(await researchApi.getProjects());
      } catch {
        notify.error("Could not load projects. Check your connection and refresh.");
      } finally {
        setIsLoadingProjects(false);
      }
    })();
  }, []);

  const loadSection = async (projectId: number, key: SectionKey) => {
    setIsLoadingSection(true);
    try {
      if (key === "ethics") setEthicsReviews(await complianceApi.getEthicsReviews({ project: projectId }));
      if (key === "similarity") setSimilarityChecks(await complianceApi.getSimilarityChecks({ project: projectId }));
      if (key === "ai") setAiDeclarations(await complianceApi.getAIDeclarations({ project: projectId }));
      if (key === "coi") setCoiDisclosures(await complianceApi.getCOIDisclosures({ project: projectId }));
      if (key === "misconduct") setMisconductCases(await complianceApi.getMisconductCases({ project: projectId }));
    } catch {
      notify.error("Could not load records for this section.");
    } finally {
      setIsLoadingSection(false);
    }
  };

  const handleSelectProject = async (value: string) => {
    setSelectedProject(value);
    try {
      setStudies(await researchApi.getStudies(Number(value)));
    } catch {
      setStudies([]);
    }
    await loadSection(Number(value), section);
  };

  const handleSelectSection = async (key: SectionKey) => {
    setSection(key);
    if (selectedProject) await loadSection(Number(selectedProject), key);
  };

  const handleAddEthicsReview = async () => {
    setAttemptedEthics(true);
    if (!ethicsForm.review_body) {
      notify.error("Review body is required.");
      return;
    }
    setIsSavingEthics(true);
    try {
      await complianceApi.createEthicsReview({
        project: Number(selectedProject),
        study: ethicsForm.study ? Number(ethicsForm.study) : null,
        review_body: ethicsForm.review_body,
        reference_number: ethicsForm.reference_number || undefined,
        decision_date: ethicsForm.decision_date || null,
        remarks: ethicsForm.remarks || undefined,
      });
      setAttemptedEthics(false);
      notify.success("Ethics review reference logged.");
      setEthicsForm({ study: "", review_body: "", reference_number: "", decision_date: "", remarks: "" });
      await loadSection(Number(selectedProject), "ethics");
    } catch (err) {
      notify.error(errorMessage(err, "Could not log this ethics review."));
    } finally {
      setIsSavingEthics(false);
    }
  };

  const handleEthicsStatusChange = async (id: number, status: string) => {
    try {
      const updated = await complianceApi.updateEthicsReview(id, { status });
      setEthicsReviews((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err) {
      notify.error(errorMessage(err, "Could not update the status."));
    }
  };

  const handleAddSimilarityCheck = async () => {
    setAttemptedSimilarity(true);
    if (!similarityForm.document_type || !similarityForm.similarity_index || !similarityForm.checked_on) {
      notify.error("Document type, similarity index, and date checked are required.");
      return;
    }
    setIsSavingSimilarity(true);
    try {
      await complianceApi.createSimilarityCheck({
        project: Number(selectedProject),
        study: similarityForm.study ? Number(similarityForm.study) : null,
        document_type: similarityForm.document_type,
        document_title: similarityForm.document_title || undefined,
        similarity_index: similarityForm.similarity_index,
        software_used: similarityForm.software_used || undefined,
        checked_on: similarityForm.checked_on,
      });
      setAttemptedSimilarity(false);
      notify.success("Similarity check recorded.");
      setSimilarityForm({
        study: "",
        document_type: "",
        document_title: "",
        similarity_index: "",
        software_used: "",
        checked_on: today(),
      });
      await loadSection(Number(selectedProject), "similarity");
    } catch (err) {
      notify.error(errorMessage(err, "Could not record this similarity check."));
    } finally {
      setIsSavingSimilarity(false);
    }
  };

  const handleAddAiDeclaration = async () => {
    setAttemptedAi(true);
    if (!aiForm.tool_name.trim() || !aiForm.purpose.trim() || !aiForm.extent.trim() || !aiForm.declared_on) {
      notify.error("Tool name, purpose, extent, and date are required.");
      return;
    }
    setIsSavingAi(true);
    try {
      await complianceApi.createAIDeclaration({
        project: Number(selectedProject),
        study: aiForm.study ? Number(aiForm.study) : null,
        tool_name: aiForm.tool_name.trim(),
        purpose: aiForm.purpose.trim(),
        extent: aiForm.extent.trim(),
        declared_on: aiForm.declared_on,
      });
      setAttemptedAi(false);
      notify.success("AI use declared.");
      setAiForm({ study: "", tool_name: "", purpose: "", extent: "", declared_on: today() });
      await loadSection(Number(selectedProject), "ai");
    } catch (err) {
      notify.error(errorMessage(err, "Could not submit this AI use declaration."));
    } finally {
      setIsSavingAi(false);
    }
  };

  const handleAddCoiDisclosure = async () => {
    setAttemptedCoi(true);
    if (!coiForm.description.trim() || !coiForm.disclosed_on) {
      notify.error("Description and date disclosed are required.");
      return;
    }
    if (!user) return;
    setIsSavingCoi(true);
    try {
      await complianceApi.createCOIDisclosure({
        project: Number(selectedProject),
        discloser: user.pk,
        description: coiForm.description.trim(),
        mitigation_measures: coiForm.mitigation_measures || undefined,
        disclosed_on: coiForm.disclosed_on,
      });
      setAttemptedCoi(false);
      notify.success("Conflict of interest disclosed.");
      setCoiForm({ description: "", mitigation_measures: "", disclosed_on: today() });
      await loadSection(Number(selectedProject), "coi");
    } catch (err) {
      notify.error(errorMessage(err, "Could not submit this disclosure."));
    } finally {
      setIsSavingCoi(false);
    }
  };

  const handleCoiStatusChange = async (id: number, status: string) => {
    try {
      const updated = await complianceApi.updateCOIDisclosure(id, { status });
      setCoiDisclosures((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (err) {
      notify.error(errorMessage(err, "Could not update the status."));
    }
  };

  const handleAddMisconductCase = async () => {
    setAttemptedMisconduct(true);
    if (
      !misconductForm.subject_name.trim() ||
      !misconductForm.case_type ||
      !misconductForm.referred_to.trim() ||
      !misconductForm.reported_on
    ) {
      notify.error("Subject, case type, referred to, and date reported are required.");
      return;
    }
    setIsSavingMisconduct(true);
    try {
      await complianceApi.createMisconductCase({
        project: Number(selectedProject),
        subject_name: misconductForm.subject_name.trim(),
        case_type: misconductForm.case_type,
        referred_to: misconductForm.referred_to.trim(),
        remarks: misconductForm.remarks || undefined,
        reported_on: misconductForm.reported_on,
      });
      setAttemptedMisconduct(false);
      notify.success("Misconduct case logged.");
      setMisconductForm({ subject_name: "", case_type: "", referred_to: "", remarks: "", reported_on: today() });
      await loadSection(Number(selectedProject), "misconduct");
    } catch (err) {
      notify.error(errorMessage(err, "Could not log this case."));
    } finally {
      setIsSavingMisconduct(false);
    }
  };

  const handleMisconductStatusChange = async (id: number, status: string) => {
    try {
      const updated = await complianceApi.updateMisconductCase(id, { status });
      setMisconductCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (err) {
      notify.error(errorMessage(err, "Could not update the status."));
    }
  };

  return (
    <div>
      <PageHeader
        title="Ethics, Integrity, and Compliance"
        description="Logs outcomes of external ethics/integrity processes (TRC, research integrity review, external review bodies) — RMIS records status, it does not conduct the review."
      />

      <Card className="mb-6 p-4">
        <FieldLabel required>Project</FieldLabel>
        <Select value={selectedProject} onValueChange={handleSelectProject} disabled={isLoadingProjects}>
          <SelectTrigger className="sm:w-96">
            <SelectValue placeholder="Select a project" />
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
      </Card>

      {!selectedProject ? (
        <EmptyState
          icon={<ShieldCheck className="size-7" />}
          title="Select a project"
          description="Choose a project above to view or log its compliance records."
        />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap gap-2">
            {SECTIONS.map((s) => (
              <Button
                key={s.key}
                size="sm"
                variant={section === s.key ? "default" : "outline"}
                onClick={() => handleSelectSection(s.key)}
              >
                {s.label}
              </Button>
            ))}
          </div>

          {section === "ethics" && (
            <>
              {canManage && (
                <Card className="mb-6 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-navy">Log an Ethics Review Reference</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <FieldLabel>Study (optional)</FieldLabel>
                      <Select
                        value={ethicsForm.study}
                        onValueChange={(v) => setEthicsForm((f) => ({ ...f, study: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Whole project" />
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
                    <div>
                      <FieldLabel required>Review Body</FieldLabel>
                      <Select
                        value={ethicsForm.review_body}
                        onValueChange={(v) => setEthicsForm((f) => ({ ...f, review_body: v }))}
                      >
                        <SelectTrigger aria-invalid={attemptedEthics && !ethicsForm.review_body}>
                          <SelectValue placeholder="Select body" />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(REVIEW_BODY_LABELS) as EthicsReviewBody[]).map((b) => (
                            <SelectItem key={b} value={b}>
                              {REVIEW_BODY_LABELS[b]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <FieldLabel>Reference Number</FieldLabel>
                      <Input
                        value={ethicsForm.reference_number}
                        onChange={(e) => setEthicsForm((f) => ({ ...f, reference_number: e.target.value }))}
                      />
                    </div>
                    <div>
                      <FieldLabel>Decision Date</FieldLabel>
                      <Input
                        type="date"
                        value={ethicsForm.decision_date}
                        onChange={(e) => setEthicsForm((f) => ({ ...f, decision_date: e.target.value }))}
                      />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-1">
                      <FieldLabel>Remarks</FieldLabel>
                      <Input
                        value={ethicsForm.remarks}
                        onChange={(e) => setEthicsForm((f) => ({ ...f, remarks: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button size="sm" onClick={handleAddEthicsReview} disabled={isSavingEthics}>
                      <Plus className="size-4" />
                      {isSavingEthics ? "Logging..." : "Log Reference"}
                    </Button>
                  </div>
                </Card>
              )}

              <Card className="overflow-hidden p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/60 hover:bg-secondary/60">
                      <TableHead>Body</TableHead>
                      <TableHead>Reference No.</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Decision Date</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingSection ? (
                      <TableSkeletonRows rows={3} columns={5} />
                    ) : ethicsReviews.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="p-0">
                          <EmptyState icon={<ShieldCheck className="size-7" />} title="No ethics reviews logged yet" />
                        </TableCell>
                      </TableRow>
                    ) : (
                      ethicsReviews.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{REVIEW_BODY_LABELS[r.review_body]}</TableCell>
                          <TableCell>{r.reference_number || "—"}</TableCell>
                          <TableCell>
                            {canManage ? (
                              <Select value={r.status} onValueChange={(v) => handleEthicsStatusChange(r.id, v)}>
                                <SelectTrigger className="h-8 w-44">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(ETHICS_STATUS_LABELS).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant="outline">{ETHICS_STATUS_LABELS[r.status]}</Badge>
                            )}
                          </TableCell>
                          <TableCell>{r.decision_date || "—"}</TableCell>
                          <TableCell>{r.remarks || "—"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </>
          )}

          {section === "similarity" && (
            <>
              {canManage && (
                <Card className="mb-6 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-navy">Record a Similarity Check</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <FieldLabel>Study (optional)</FieldLabel>
                      <Select
                        value={similarityForm.study}
                        onValueChange={(v) => setSimilarityForm((f) => ({ ...f, study: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Whole project" />
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
                    <div>
                      <FieldLabel required>Document Type</FieldLabel>
                      <Select
                        value={similarityForm.document_type}
                        onValueChange={(v) => setSimilarityForm((f) => ({ ...f, document_type: v }))}
                      >
                        <SelectTrigger aria-invalid={attemptedSimilarity && !similarityForm.document_type}>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(DOC_TYPE_LABELS) as SimilarityDocumentType[]).map((t) => (
                            <SelectItem key={t} value={t}>
                              {DOC_TYPE_LABELS[t]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <FieldLabel>Document Title</FieldLabel>
                      <Input
                        value={similarityForm.document_title}
                        onChange={(e) => setSimilarityForm((f) => ({ ...f, document_title: e.target.value }))}
                      />
                    </div>
                    <div>
                      <FieldLabel required>Similarity Index (%)</FieldLabel>
                      <Input
                        aria-invalid={attemptedSimilarity && !similarityForm.similarity_index}
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={similarityForm.similarity_index}
                        onChange={(e) => setSimilarityForm((f) => ({ ...f, similarity_index: e.target.value }))}
                      />
                    </div>
                    <div>
                      <FieldLabel>Software Used</FieldLabel>
                      <Input
                        value={similarityForm.software_used}
                        onChange={(e) => setSimilarityForm((f) => ({ ...f, software_used: e.target.value }))}
                      />
                    </div>
                    <div>
                      <FieldLabel required>Date Checked</FieldLabel>
                      <Input
                        aria-invalid={attemptedSimilarity && !similarityForm.checked_on}
                        type="date"
                        value={similarityForm.checked_on}
                        onChange={(e) => setSimilarityForm((f) => ({ ...f, checked_on: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button size="sm" onClick={handleAddSimilarityCheck} disabled={isSavingSimilarity}>
                      <Plus className="size-4" />
                      {isSavingSimilarity ? "Recording..." : "Record Check"}
                    </Button>
                  </div>
                </Card>
              )}

              <Card className="overflow-hidden p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/60 hover:bg-secondary/60">
                      <TableHead>Document</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Similarity Index</TableHead>
                      <TableHead>Date Checked</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingSection ? (
                      <TableSkeletonRows rows={3} columns={4} />
                    ) : similarityChecks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="p-0">
                          <EmptyState icon={<ShieldCheck className="size-7" />} title="No similarity checks yet" />
                        </TableCell>
                      </TableRow>
                    ) : (
                      similarityChecks.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.document_title || "—"}</TableCell>
                          <TableCell>{DOC_TYPE_LABELS[s.document_type]}</TableCell>
                          <TableCell>
                            {s.similarity_index}%
                            {!s.is_within_threshold && (
                              <Badge variant="outline" className="ml-2 text-destructive">
                                Exceeds threshold
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{s.checked_on}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </>
          )}

          {section === "ai" && (
            <>
              <Card className="mb-6 p-4">
                <h3 className="mb-3 text-sm font-semibold text-navy">Declare Generative AI Use</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <FieldLabel>Study (optional)</FieldLabel>
                    <Select value={aiForm.study} onValueChange={(v) => setAiForm((f) => ({ ...f, study: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Whole project" />
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
                  <div>
                    <FieldLabel required>Tool Name</FieldLabel>
                    <Input
                      aria-invalid={attemptedAi && !aiForm.tool_name.trim()}
                      value={aiForm.tool_name}
                      onChange={(e) => setAiForm((f) => ({ ...f, tool_name: e.target.value }))}
                      placeholder="e.g. ChatGPT, Grammarly"
                    />
                  </div>
                  <div>
                    <FieldLabel required>Date Declared</FieldLabel>
                    <Input
                      aria-invalid={attemptedAi && !aiForm.declared_on}
                      type="date"
                      value={aiForm.declared_on}
                      onChange={(e) => setAiForm((f) => ({ ...f, declared_on: e.target.value }))}
                    />
                  </div>
                  <div>
                    <FieldLabel required>Purpose</FieldLabel>
                    <Input
                      aria-invalid={attemptedAi && !aiForm.purpose.trim()}
                      value={aiForm.purpose}
                      onChange={(e) => setAiForm((f) => ({ ...f, purpose: e.target.value }))}
                      placeholder="e.g. grammar editing, data analysis"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <FieldLabel required>Extent of Use</FieldLabel>
                    <Input
                      aria-invalid={attemptedAi && !aiForm.extent.trim()}
                      value={aiForm.extent}
                      onChange={(e) => setAiForm((f) => ({ ...f, extent: e.target.value }))}
                      placeholder="Describe how and where AI was used"
                    />
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button size="sm" onClick={handleAddAiDeclaration} disabled={isSavingAi}>
                    <Plus className="size-4" />
                    {isSavingAi ? "Declaring..." : "Declare"}
                  </Button>
                </div>
              </Card>

              <Card className="overflow-hidden p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/60 hover:bg-secondary/60">
                      <TableHead>Tool</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Extent</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingSection ? (
                      <TableSkeletonRows rows={3} columns={4} />
                    ) : aiDeclarations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="p-0">
                          <EmptyState icon={<ShieldCheck className="size-7" />} title="No AI use declared yet" />
                        </TableCell>
                      </TableRow>
                    ) : (
                      aiDeclarations.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{a.tool_name}</TableCell>
                          <TableCell>{a.purpose}</TableCell>
                          <TableCell>{a.extent}</TableCell>
                          <TableCell>{a.declared_on}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </>
          )}

          {section === "coi" && (
            <>
              <Card className="mb-6 p-4">
                <h3 className="mb-3 text-sm font-semibold text-navy">Disclose a Conflict of Interest</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="sm:col-span-2">
                    <FieldLabel required>Description</FieldLabel>
                    <Input
                      aria-invalid={attemptedCoi && !coiForm.description.trim()}
                      value={coiForm.description}
                      onChange={(e) => setCoiForm((f) => ({ ...f, description: e.target.value }))}
                    />
                  </div>
                  <div>
                    <FieldLabel required>Date Disclosed</FieldLabel>
                    <Input
                      aria-invalid={attemptedCoi && !coiForm.disclosed_on}
                      type="date"
                      value={coiForm.disclosed_on}
                      onChange={(e) => setCoiForm((f) => ({ ...f, disclosed_on: e.target.value }))}
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <FieldLabel>Mitigation Measures (optional)</FieldLabel>
                    <Input
                      value={coiForm.mitigation_measures}
                      onChange={(e) => setCoiForm((f) => ({ ...f, mitigation_measures: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button size="sm" onClick={handleAddCoiDisclosure} disabled={isSavingCoi}>
                    <Plus className="size-4" />
                    {isSavingCoi ? "Submitting..." : "Disclose"}
                  </Button>
                </div>
              </Card>

              <Card className="overflow-hidden p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/60 hover:bg-secondary/60">
                      <TableHead>Description</TableHead>
                      <TableHead>Mitigation</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date Disclosed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingSection ? (
                      <TableSkeletonRows rows={3} columns={4} />
                    ) : coiDisclosures.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="p-0">
                          <EmptyState icon={<ShieldCheck className="size-7" />} title="No disclosures yet" />
                        </TableCell>
                      </TableRow>
                    ) : (
                      coiDisclosures.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.description}</TableCell>
                          <TableCell>{c.mitigation_measures || "—"}</TableCell>
                          <TableCell>
                            {canManage ? (
                              <Select value={c.status} onValueChange={(v) => handleCoiStatusChange(c.id, v)}>
                                <SelectTrigger className="h-8 w-40">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(COI_STATUS_LABELS).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant="outline">{COI_STATUS_LABELS[c.status]}</Badge>
                            )}
                          </TableCell>
                          <TableCell>{c.disclosed_on}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </>
          )}

          {section === "misconduct" && (
            <>
              {canManage && (
                <Card className="mb-6 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-navy">Log a Misconduct Case</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <FieldLabel required>Subject Name</FieldLabel>
                      <Input
                        aria-invalid={attemptedMisconduct && !misconductForm.subject_name.trim()}
                        value={misconductForm.subject_name}
                        onChange={(e) => setMisconductForm((f) => ({ ...f, subject_name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <FieldLabel required>Case Type</FieldLabel>
                      <Select
                        value={misconductForm.case_type}
                        onValueChange={(v) => setMisconductForm((f) => ({ ...f, case_type: v }))}
                      >
                        <SelectTrigger aria-invalid={attemptedMisconduct && !misconductForm.case_type}>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(CASE_TYPE_LABELS) as MisconductCaseType[]).map((c) => (
                            <SelectItem key={c} value={c}>
                              {CASE_TYPE_LABELS[c]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <FieldLabel required>Referred To</FieldLabel>
                      <Input
                        aria-invalid={attemptedMisconduct && !misconductForm.referred_to.trim()}
                        value={misconductForm.referred_to}
                        onChange={(e) => setMisconductForm((f) => ({ ...f, referred_to: e.target.value }))}
                        placeholder="e.g. Dean, Research Chairperson"
                      />
                    </div>
                    <div>
                      <FieldLabel required>Date Reported</FieldLabel>
                      <Input
                        aria-invalid={attemptedMisconduct && !misconductForm.reported_on}
                        type="date"
                        value={misconductForm.reported_on}
                        onChange={(e) => setMisconductForm((f) => ({ ...f, reported_on: e.target.value }))}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <FieldLabel>Remarks</FieldLabel>
                      <Input
                        value={misconductForm.remarks}
                        onChange={(e) => setMisconductForm((f) => ({ ...f, remarks: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button size="sm" onClick={handleAddMisconductCase} disabled={isSavingMisconduct}>
                      <Plus className="size-4" />
                      {isSavingMisconduct ? "Logging..." : "Log Case"}
                    </Button>
                  </div>
                </Card>
              )}

              <Card className="overflow-hidden p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/60 hover:bg-secondary/60">
                      <TableHead>Subject</TableHead>
                      <TableHead>Case Type</TableHead>
                      <TableHead>Referred To</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reported On</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingSection ? (
                      <TableSkeletonRows rows={3} columns={5} />
                    ) : misconductCases.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="p-0">
                          <EmptyState icon={<ShieldCheck className="size-7" />} title="No cases logged yet" />
                        </TableCell>
                      </TableRow>
                    ) : (
                      misconductCases.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.subject_name || `User #${c.subject}`}</TableCell>
                          <TableCell>{CASE_TYPE_LABELS[c.case_type]}</TableCell>
                          <TableCell>{c.referred_to}</TableCell>
                          <TableCell>
                            {canManage ? (
                              <Select value={c.status} onValueChange={(v) => handleMisconductStatusChange(c.id, v)}>
                                <SelectTrigger className="h-8 w-44">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(MISCONDUCT_STATUS_LABELS).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant="outline">{MISCONDUCT_STATUS_LABELS[c.status]}</Badge>
                            )}
                          </TableCell>
                          <TableCell>{c.reported_on}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function CompliancePage() {
  return (
    <ProtectedRoute>
      <AppShell title="Ethics, Integrity, and Compliance">
        <ComplianceContent />
      </AppShell>
    </ProtectedRoute>
  );
}
