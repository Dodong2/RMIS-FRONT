import { useEffect, useState } from "react";
import { Archive, FileText, Plus, Download } from "lucide-react";
import { documentApi } from "../lib/documentApi";
import { researchApi } from "../lib/researchApi";
import { errorMessage } from "../lib/errorMessage";
import type { DocumentStage, DocumentType, ProjectDocument } from "../types/document";
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
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const TYPE_LABELS: Record<DocumentType, string> = {
  toe: "Terms of Engagement",
  lib: "Line-Item Budget",
  work_plan: "Work Plan",
  midterm_report: "Midterm Report",
  terminal_report: "Terminal Report",
  accomplishment_report: "Accomplishment Report",
  thesis: "Thesis",
  dissertation: "Dissertation",
  dataset: "Research Dataset",
  manuscript: "Manuscript",
  other: "Other",
};

const STAGE_LABELS: Record<Exclude<DocumentStage, "">, string> = {
  inception: "Inception",
  midterm: "Midterm",
  terminal: "Terminal",
  post_completion: "Post-Completion",
};

const formatSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function DocumentsContent() {
  const { user } = useAuth();
  const canManage = !!user?.role && MANAGE_ROLE_CODES.includes(user.role.code);

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [studies, setStudies] = useState<Study[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [currentOnly, setCurrentOnly] = useState(true);

  const [uploadForm, setUploadForm] = useState({ study: "", document_type: "", stage: "" });
  const [file, setFile] = useState<File | null>(null);
  const [attemptedUpload, setAttemptedUpload] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [archivingId, setArchivingId] = useState<number | null>(null);

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

  const loadDocuments = async (projectId: number, onlyCurrent: boolean) => {
    setIsLoadingDocuments(true);
    try {
      setDocuments(await documentApi.getDocuments({ project: projectId, current_only: onlyCurrent }));
    } catch {
      notify.error("Could not load documents for this project.");
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  const handleSelectProject = async (value: string) => {
    setSelectedProject(value);
    setUploadForm({ study: "", document_type: "", stage: "" });
    setFile(null);
    setAttemptedUpload(false);
    try {
      setStudies(await researchApi.getStudies(Number(value)));
    } catch {
      setStudies([]);
    }
    await loadDocuments(Number(value), currentOnly);
  };

  const handleToggleCurrentOnly = async (onlyCurrent: boolean) => {
    setCurrentOnly(onlyCurrent);
    if (selectedProject) await loadDocuments(Number(selectedProject), onlyCurrent);
  };

  const handleUpload = async () => {
    setAttemptedUpload(true);
    if (!uploadForm.document_type || !file) {
      notify.error("Document type and a file are required.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      notify.error("File exceeds the 25MB limit.");
      return;
    }
    setIsUploading(true);
    try {
      await documentApi.uploadDocument({
        project: Number(selectedProject),
        study: uploadForm.study ? Number(uploadForm.study) : null,
        document_type: uploadForm.document_type as DocumentType,
        stage: (uploadForm.stage as DocumentStage) || undefined,
        file,
      });
      setAttemptedUpload(false);
      notify.success("Document uploaded.");
      setUploadForm({ study: "", document_type: "", stage: "" });
      setFile(null);
      await loadDocuments(Number(selectedProject), currentOnly);
    } catch (err) {
      notify.error(errorMessage(err, "Could not upload this document."));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (doc: ProjectDocument) => {
    setDownloadingId(doc.id);
    try {
      const full = await documentApi.getDocument(doc.id);
      if (full.download_url) window.open(full.download_url, "_blank", "noopener");
    } catch (err) {
      notify.error(errorMessage(err, "Could not get a download link for this document."));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleArchive = async (doc: ProjectDocument) => {
    setArchivingId(doc.id);
    try {
      const updated = await documentApi.archiveDocument(doc.id);
      setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      notify.success("Document archived.");
    } catch (err) {
      notify.error(errorMessage(err, "Could not archive this document."));
    } finally {
      setArchivingId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Versioned project records — TOE, work plans, reports, thesis/dissertation files, datasets. Retained for 10 years, never hard-deleted."
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
          icon={<FileText className="size-7" />}
          title="Select a project"
          description="Choose a project above to view or upload its documents."
        />
      ) : (
        <>
          <Card className="mb-6 p-4">
            <h3 className="mb-3 text-sm font-semibold text-navy">Upload a Document</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <FieldLabel>Study (optional)</FieldLabel>
                <Select
                  value={uploadForm.study}
                  onValueChange={(v) => setUploadForm((f) => ({ ...f, study: v }))}
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
                  value={uploadForm.document_type}
                  onValueChange={(v) => setUploadForm((f) => ({ ...f, document_type: v }))}
                >
                  <SelectTrigger aria-invalid={attemptedUpload && !uploadForm.document_type}>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_LABELS) as DocumentType[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <FieldLabel>Stage (optional)</FieldLabel>
                <Select value={uploadForm.stage} onValueChange={(v) => setUploadForm((f) => ({ ...f, stage: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="No stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STAGE_LABELS) as Exclude<DocumentStage, "">[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {STAGE_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <FieldLabel required>File</FieldLabel>
                <Input
                  aria-invalid={attemptedUpload && !file}
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button size="sm" onClick={handleUpload} disabled={isUploading}>
                <Plus className="size-4" />
                {isUploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
              <h3 className="text-sm font-semibold text-navy">Documents</h3>
              <div className="w-44">
                <Select
                  value={currentOnly ? "current" : "all"}
                  onValueChange={(v) => handleToggleCurrentOnly(v === "current")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Current versions only</SelectItem>
                    <SelectItem value="all">All versions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/60 hover:bg-secondary/60">
                  <TableHead>File</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingDocuments ? (
                  <TableSkeletonRows rows={3} columns={7} />
                ) : documents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="p-0">
                      <EmptyState icon={<FileText className="size-7" />} title="No documents uploaded yet" />
                    </TableCell>
                  </TableRow>
                ) : (
                  documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.file_name}</TableCell>
                      <TableCell>{TYPE_LABELS[doc.document_type]}</TableCell>
                      <TableCell>{doc.stage ? STAGE_LABELS[doc.stage] : "—"}</TableCell>
                      <TableCell>
                        v{doc.version_number}
                        {doc.is_current && (
                          <Badge variant="outline" className="ml-2">
                            Current
                          </Badge>
                        )}
                        {doc.is_archived && (
                          <Badge variant="outline" className="ml-2 text-destructive">
                            Archived
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatSize(doc.file_size)}</TableCell>
                      <TableCell>{new Date(doc.uploaded_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(doc)}
                            disabled={downloadingId === doc.id}
                          >
                            <Download className="size-4" />
                            {downloadingId === doc.id ? "..." : "Download"}
                          </Button>
                          {canManage && !doc.is_archived && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleArchive(doc)}
                              disabled={archivingId === doc.id}
                            >
                              <Archive className="size-4" />
                              Archive
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Documents">
        <DocumentsContent />
      </AppShell>
    </ProtectedRoute>
  );
}
