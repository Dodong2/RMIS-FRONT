import { useEffect, useState } from "react";
import { Award, BookOpen, Lightbulb, Palette, Plus } from "lucide-react";
import { outputsApi } from "../lib/outputsApi";
import { researchApi } from "../lib/researchApi";
import { errorMessage } from "../lib/errorMessage";
import type {
  CreativeWorkRecord,
  IndexingTier,
  IPRecord,
  IPStatus,
  IPType,
  PublicationRecord,
  PublicationType,
  SenseRankedPublisher,
} from "../types/outputs";
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
const REPORT_ROLE_CODES = ["system_admin", "riuh", "project_leader", "study_leader"];
const CREATIVE_WORK_ROLE_CODES = [...REPORT_ROLE_CODES, "project_staff"];

const PUBLICATION_TYPE_LABELS: Record<PublicationType, string> = {
  journal_article: "Journal Article",
  book: "Book",
  book_chapter: "Book Chapter",
  conference_proceeding: "Conference Proceeding",
  instructional_material: "Instructional Material",
};

const INDEXING_LABELS: Record<Exclude<IndexingTier, "">, string> = {
  isi: "ISI-indexed",
  scopus: "Scopus-indexed",
  lspu_refereed: "LSPU Refereed Journal",
  non_indexed: "Not Indexed",
};

const IP_TYPE_LABELS: Record<IPType, string> = {
  patent: "Patent",
  utility_model: "Utility Model",
  industrial_design: "Industrial Design",
  trademark: "Trademark",
};

const IP_STATUS_LABELS: Record<IPStatus, string> = {
  disclosed: "Disclosed",
  filed: "Filed",
  registered: "Registered",
  adopted: "Adopted by Community",
};

const SECTIONS = [
  { key: "publications", label: "Publications" },
  { key: "ip", label: "IP Records" },
  { key: "creative", label: "Creative Works" },
  { key: "sense", label: "SENSE Publishers" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

const today = () => new Date().toLocaleDateString("en-CA");

const peso = (amount: string) => `₱${Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="size-4 rounded border-input"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function OutputsContent() {
  const { user } = useAuth();
  const canManageSense = !!user?.role && MANAGE_ROLE_CODES.includes(user.role.code);
  const canReport = !!user?.role && REPORT_ROLE_CODES.includes(user.role.code);
  const canCreativeWork = !!user?.role && CREATIVE_WORK_ROLE_CODES.includes(user.role.code);

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [studies, setStudies] = useState<Study[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [section, setSection] = useState<SectionKey>("publications");
  const [isLoadingSection, setIsLoadingSection] = useState(false);

  const [publications, setPublications] = useState<PublicationRecord[]>([]);
  const [ipRecords, setIpRecords] = useState<IPRecord[]>([]);
  const [creativeWorks, setCreativeWorks] = useState<CreativeWorkRecord[]>([]);
  const [sensePublishers, setSensePublishers] = useState<SenseRankedPublisher[]>([]);

  const emptyPubForm = {
    study: "",
    title: "",
    publication_type: "",
    indexing_tier: "",
    impact_factor: "",
    h_index: "",
    sense_publisher: "",
    has_isbn: false,
    is_lspu_published: false,
    is_thesis_derived: false,
    is_supervised_approved_thesis: false,
    publisher_name: "",
    doi_or_isbn: "",
    published_on: today(),
  };
  const [pubForm, setPubForm] = useState(emptyPubForm);
  const [attemptedPub, setAttemptedPub] = useState(false);
  const [isSavingPub, setIsSavingPub] = useState(false);

  const emptyIpForm = {
    study: "",
    title: "",
    ip_type: "",
    co_creators: "",
    trl: "",
    is_commercialization_intended: false,
    is_adopted_by_community: false,
    adoption_moa_reference: "",
    registration_number: "",
    registered_on: "",
  };
  const [ipForm, setIpForm] = useState(emptyIpForm);
  const [attemptedIp, setAttemptedIp] = useState(false);
  const [isSavingIp, setIsSavingIp] = useState(false);

  const emptyCreativeForm = {
    title: "",
    work_type: "",
    description: "",
    date_created: today(),
    rights_holder: "",
  };
  const [creativeForm, setCreativeForm] = useState(emptyCreativeForm);
  const [attemptedCreative, setAttemptedCreative] = useState(false);
  const [isSavingCreative, setIsSavingCreative] = useState(false);

  const [senseName, setSenseName] = useState("");
  const [isSavingSense, setIsSavingSense] = useState(false);

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
      try {
        setSensePublishers(await outputsApi.getSensePublishers());
      } catch {
        notify.error("Could not load the SENSE-ranked publisher list.");
      }
    })();
  }, []);

  const loadSection = async (projectId: number, key: SectionKey) => {
    if (key === "sense") return;
    setIsLoadingSection(true);
    try {
      if (key === "publications") setPublications(await outputsApi.getPublications({ project: projectId }));
      if (key === "ip") setIpRecords(await outputsApi.getIPRecords({ project: projectId }));
      if (key === "creative") setCreativeWorks(await outputsApi.getCreativeWorks({ project: projectId }));
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

  const handleAddPublication = async () => {
    setAttemptedPub(true);
    if (!user || !pubForm.title.trim() || !pubForm.publication_type || !pubForm.published_on) {
      notify.error("Title, publication type, and date published are required.");
      return;
    }
    setIsSavingPub(true);
    try {
      await outputsApi.createPublication({
        project: Number(selectedProject),
        study: pubForm.study ? Number(pubForm.study) : null,
        lead_author: user.pk,
        title: pubForm.title.trim(),
        publication_type: pubForm.publication_type as PublicationType,
        indexing_tier: (pubForm.indexing_tier as IndexingTier) || undefined,
        impact_factor: pubForm.impact_factor || undefined,
        h_index: pubForm.h_index || undefined,
        sense_publisher: pubForm.sense_publisher ? Number(pubForm.sense_publisher) : null,
        has_isbn: pubForm.has_isbn,
        is_lspu_published: pubForm.is_lspu_published,
        is_thesis_derived: pubForm.is_thesis_derived,
        is_supervised_approved_thesis: pubForm.is_supervised_approved_thesis,
        publisher_name: pubForm.publisher_name || undefined,
        doi_or_isbn: pubForm.doi_or_isbn || undefined,
        published_on: pubForm.published_on,
      });
      setAttemptedPub(false);
      notify.success("Publication recorded.");
      setPubForm(emptyPubForm);
      await loadSection(Number(selectedProject), "publications");
    } catch (err) {
      notify.error(errorMessage(err, "Could not record this publication."));
    } finally {
      setIsSavingPub(false);
    }
  };

  const handleAddIpRecord = async () => {
    setAttemptedIp(true);
    if (!user || !ipForm.title.trim() || !ipForm.ip_type) {
      notify.error("Title and IP type are required.");
      return;
    }
    setIsSavingIp(true);
    try {
      await outputsApi.createIPRecord({
        project: Number(selectedProject),
        study: ipForm.study ? Number(ipForm.study) : null,
        creator: user.pk,
        co_creators: ipForm.co_creators || undefined,
        title: ipForm.title.trim(),
        ip_type: ipForm.ip_type as IPType,
        trl: ipForm.trl ? Number(ipForm.trl) : undefined,
        is_commercialization_intended: ipForm.is_commercialization_intended,
        is_adopted_by_community: ipForm.is_adopted_by_community,
        adoption_moa_reference: ipForm.adoption_moa_reference || undefined,
        registration_number: ipForm.registration_number || undefined,
        registered_on: ipForm.registered_on || undefined,
      });
      setAttemptedIp(false);
      notify.success("IP record logged.");
      setIpForm(emptyIpForm);
      await loadSection(Number(selectedProject), "ip");
    } catch (err) {
      notify.error(errorMessage(err, "Could not log this IP record."));
    } finally {
      setIsSavingIp(false);
    }
  };

  const handleIpStatusChange = async (id: number, status: string) => {
    try {
      const updated = await outputsApi.updateIPRecord(id, { status: status as IPStatus });
      setIpRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err) {
      notify.error(errorMessage(err, "Could not update the status."));
    }
  };

  const handleToggleClaimed = async (record: IPRecord) => {
    try {
      const updated = await outputsApi.updateIPRecord(record.id, { incentive_claimed: !record.incentive_claimed });
      setIpRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err) {
      notify.error(errorMessage(err, "Could not update the claimed flag."));
    }
  };

  const handleAddCreativeWork = async () => {
    setAttemptedCreative(true);
    if (!user || !creativeForm.title.trim() || !creativeForm.work_type.trim() || !creativeForm.date_created) {
      notify.error("Title, work type, and date created are required.");
      return;
    }
    setIsSavingCreative(true);
    try {
      await outputsApi.createCreativeWork({
        project: selectedProject ? Number(selectedProject) : null,
        creator: user.pk,
        title: creativeForm.title.trim(),
        work_type: creativeForm.work_type.trim(),
        description: creativeForm.description || undefined,
        date_created: creativeForm.date_created,
        rights_holder: creativeForm.rights_holder || undefined,
      });
      setAttemptedCreative(false);
      notify.success("Creative work logged.");
      setCreativeForm(emptyCreativeForm);
      await loadSection(Number(selectedProject), "creative");
    } catch (err) {
      notify.error(errorMessage(err, "Could not log this creative work."));
    } finally {
      setIsSavingCreative(false);
    }
  };

  const handleToggleRegistered = async (work: CreativeWorkRecord) => {
    try {
      const updated = await outputsApi.updateCreativeWork(work.id, { is_registered: !work.is_registered });
      setCreativeWorks((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
    } catch (err) {
      notify.error(errorMessage(err, "Could not update the registration status."));
    }
  };

  const handleAddSensePublisher = async () => {
    if (!senseName.trim()) {
      notify.error("Publisher name is required.");
      return;
    }
    setIsSavingSense(true);
    try {
      await outputsApi.createSensePublisher(senseName.trim());
      notify.success("Publisher added.");
      setSenseName("");
      setSensePublishers(await outputsApi.getSensePublishers());
    } catch (err) {
      notify.error(errorMessage(err, "Could not add this publisher."));
    } finally {
      setIsSavingSense(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Research Output and IP Tracking"
        description="Publications, patents/IP, and creative works — with R&D incentive eligibility computed per the Manual's Article V."
      />

      <Card className="mb-6 p-4">
        <FieldLabel required={section !== "sense" && section !== "creative"}>Project</FieldLabel>
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

      {section !== "sense" && !selectedProject ? (
        <EmptyState
          icon={<BookOpen className="size-7" />}
          title="Select a project"
          description="Choose a project above to view or log its research outputs."
        />
      ) : (
        <>
          {section === "publications" && (
            <>
              {canReport && (
                <Card className="mb-6 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-navy">Record a Publication</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <FieldLabel>Study (optional)</FieldLabel>
                      <Select value={pubForm.study} onValueChange={(v) => setPubForm((f) => ({ ...f, study: v }))}>
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
                      <FieldLabel required>Publication Type</FieldLabel>
                      <Select
                        value={pubForm.publication_type}
                        onValueChange={(v) => setPubForm((f) => ({ ...f, publication_type: v }))}
                      >
                        <SelectTrigger aria-invalid={attemptedPub && !pubForm.publication_type}>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(PUBLICATION_TYPE_LABELS) as PublicationType[]).map((t) => (
                            <SelectItem key={t} value={t}>
                              {PUBLICATION_TYPE_LABELS[t]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <FieldLabel required>Date Published</FieldLabel>
                      <Input
                        aria-invalid={attemptedPub && !pubForm.published_on}
                        type="date"
                        value={pubForm.published_on}
                        onChange={(e) => setPubForm((f) => ({ ...f, published_on: e.target.value }))}
                      />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-3">
                      <FieldLabel required>Title</FieldLabel>
                      <Input
                        aria-invalid={attemptedPub && !pubForm.title.trim()}
                        value={pubForm.title}
                        onChange={(e) => setPubForm((f) => ({ ...f, title: e.target.value }))}
                      />
                    </div>
                    <div>
                      <FieldLabel>Indexing Tier (journal articles)</FieldLabel>
                      <Select
                        value={pubForm.indexing_tier}
                        onValueChange={(v) => setPubForm((f) => ({ ...f, indexing_tier: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Not applicable" />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(INDEXING_LABELS) as Exclude<IndexingTier, "">[]).map((t) => (
                            <SelectItem key={t} value={t}>
                              {INDEXING_LABELS[t]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <FieldLabel>Impact Factor (ISI)</FieldLabel>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={pubForm.impact_factor}
                        onChange={(e) => setPubForm((f) => ({ ...f, impact_factor: e.target.value }))}
                      />
                    </div>
                    <div>
                      <FieldLabel>H-Index (Scopus)</FieldLabel>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={pubForm.h_index}
                        onChange={(e) => setPubForm((f) => ({ ...f, h_index: e.target.value }))}
                      />
                    </div>
                    <div>
                      <FieldLabel>SENSE-Ranked Publisher (books)</FieldLabel>
                      <Select
                        value={pubForm.sense_publisher}
                        onValueChange={(v) => setPubForm((f) => ({ ...f, sense_publisher: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Not applicable" />
                        </SelectTrigger>
                        <SelectContent>
                          {sensePublishers.length === 0 && <EmptyOption message="No publishers listed yet" />}
                          {sensePublishers.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <FieldLabel>Publisher Name</FieldLabel>
                      <Input
                        value={pubForm.publisher_name}
                        onChange={(e) => setPubForm((f) => ({ ...f, publisher_name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <FieldLabel>DOI / ISBN</FieldLabel>
                      <Input
                        value={pubForm.doi_or_isbn}
                        onChange={(e) => setPubForm((f) => ({ ...f, doi_or_isbn: e.target.value }))}
                      />
                    </div>
                    <div className="flex flex-col justify-center gap-2 sm:col-span-2 lg:col-span-3 lg:flex-row lg:flex-wrap lg:gap-6">
                      <Checkbox
                        label="Has ISBN"
                        checked={pubForm.has_isbn}
                        onChange={(v) => setPubForm((f) => ({ ...f, has_isbn: v }))}
                      />
                      <Checkbox
                        label="LSPU-Published"
                        checked={pubForm.is_lspu_published}
                        onChange={(v) => setPubForm((f) => ({ ...f, is_lspu_published: v }))}
                      />
                      <Checkbox
                        label="Thesis-Derived"
                        checked={pubForm.is_thesis_derived}
                        onChange={(v) => setPubForm((f) => ({ ...f, is_thesis_derived: v }))}
                      />
                      <Checkbox
                        label="Supervised & Approved Thesis"
                        checked={pubForm.is_supervised_approved_thesis}
                        onChange={(v) => setPubForm((f) => ({ ...f, is_supervised_approved_thesis: v }))}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button size="sm" onClick={handleAddPublication} disabled={isSavingPub}>
                      <Plus className="size-4" />
                      {isSavingPub ? "Recording..." : "Record Publication"}
                    </Button>
                  </div>
                </Card>
              )}

              <Card className="overflow-hidden p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/60 hover:bg-secondary/60">
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Indexing</TableHead>
                      <TableHead>Published</TableHead>
                      <TableHead>Estimated Incentive</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingSection ? (
                      <TableSkeletonRows rows={3} columns={5} />
                    ) : publications.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="p-0">
                          <EmptyState icon={<BookOpen className="size-7" />} title="No publications recorded yet" />
                        </TableCell>
                      </TableRow>
                    ) : (
                      publications.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.title}</TableCell>
                          <TableCell>{PUBLICATION_TYPE_LABELS[p.publication_type]}</TableCell>
                          <TableCell>{p.indexing_tier ? INDEXING_LABELS[p.indexing_tier] : "—"}</TableCell>
                          <TableCell>{p.published_on}</TableCell>
                          <TableCell>
                            {p.estimated_incentive ? (
                              <Badge variant="outline">{peso(p.estimated_incentive)}</Badge>
                            ) : (
                              <span className="text-muted-foreground">Not eligible</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </>
          )}

          {section === "ip" && (
            <>
              {canReport && (
                <Card className="mb-6 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-navy">Log an IP Record</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <FieldLabel>Study (optional)</FieldLabel>
                      <Select value={ipForm.study} onValueChange={(v) => setIpForm((f) => ({ ...f, study: v }))}>
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
                      <FieldLabel required>IP Type</FieldLabel>
                      <Select value={ipForm.ip_type} onValueChange={(v) => setIpForm((f) => ({ ...f, ip_type: v }))}>
                        <SelectTrigger aria-invalid={attemptedIp && !ipForm.ip_type}>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(IP_TYPE_LABELS) as IPType[]).map((t) => (
                            <SelectItem key={t} value={t}>
                              {IP_TYPE_LABELS[t]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <FieldLabel>TRL (1-9)</FieldLabel>
                      <Input
                        type="number"
                        min="1"
                        max="9"
                        value={ipForm.trl}
                        onChange={(e) => setIpForm((f) => ({ ...f, trl: e.target.value }))}
                      />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-3">
                      <FieldLabel required>Title</FieldLabel>
                      <Input
                        aria-invalid={attemptedIp && !ipForm.title.trim()}
                        value={ipForm.title}
                        onChange={(e) => setIpForm((f) => ({ ...f, title: e.target.value }))}
                      />
                    </div>
                    <div>
                      <FieldLabel>Co-Creators</FieldLabel>
                      <Input
                        value={ipForm.co_creators}
                        onChange={(e) => setIpForm((f) => ({ ...f, co_creators: e.target.value }))}
                        placeholder="Comma-separated names"
                      />
                    </div>
                    <div>
                      <FieldLabel>Registration Number</FieldLabel>
                      <Input
                        value={ipForm.registration_number}
                        onChange={(e) => setIpForm((f) => ({ ...f, registration_number: e.target.value }))}
                      />
                    </div>
                    <div>
                      <FieldLabel>Date Registered</FieldLabel>
                      <Input
                        type="date"
                        value={ipForm.registered_on}
                        onChange={(e) => setIpForm((f) => ({ ...f, registered_on: e.target.value }))}
                      />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-3">
                      <FieldLabel>Adoption MOA Reference</FieldLabel>
                      <Input
                        value={ipForm.adoption_moa_reference}
                        onChange={(e) => setIpForm((f) => ({ ...f, adoption_moa_reference: e.target.value }))}
                      />
                    </div>
                    <div className="flex flex-col justify-center gap-2 sm:col-span-2 lg:col-span-3 lg:flex-row lg:flex-wrap lg:gap-6">
                      <Checkbox
                        label="Commercialization Intended"
                        checked={ipForm.is_commercialization_intended}
                        onChange={(v) => setIpForm((f) => ({ ...f, is_commercialization_intended: v }))}
                      />
                      <Checkbox
                        label="Adopted by a Recipient Community"
                        checked={ipForm.is_adopted_by_community}
                        onChange={(v) => setIpForm((f) => ({ ...f, is_adopted_by_community: v }))}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button size="sm" onClick={handleAddIpRecord} disabled={isSavingIp}>
                      <Plus className="size-4" />
                      {isSavingIp ? "Logging..." : "Log IP Record"}
                    </Button>
                  </div>
                </Card>
              )}

              <Card className="overflow-hidden p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/60 hover:bg-secondary/60">
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>TRL</TableHead>
                      <TableHead>Incentive Eligible</TableHead>
                      {canReport && <TableHead className="text-right">Claimed</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingSection ? (
                      <TableSkeletonRows rows={3} columns={canReport ? 6 : 5} />
                    ) : ipRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={canReport ? 6 : 5} className="p-0">
                          <EmptyState icon={<Lightbulb className="size-7" />} title="No IP records logged yet" />
                        </TableCell>
                      </TableRow>
                    ) : (
                      ipRecords.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.title}</TableCell>
                          <TableCell>{IP_TYPE_LABELS[r.ip_type]}</TableCell>
                          <TableCell>
                            {canReport ? (
                              <Select value={r.status} onValueChange={(v) => handleIpStatusChange(r.id, v)}>
                                <SelectTrigger className="h-8 w-40">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(IP_STATUS_LABELS).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant="outline">{IP_STATUS_LABELS[r.status]}</Badge>
                            )}
                          </TableCell>
                          <TableCell>{r.trl ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={r.incentive_eligible ? "" : "text-muted-foreground"}>
                              {r.incentive_eligible ? "Eligible" : "Not eligible"}
                            </Badge>
                          </TableCell>
                          {canReport && (
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleToggleClaimed(r)}
                                disabled={!r.incentive_eligible && !r.incentive_claimed}
                              >
                                {r.incentive_claimed ? "Claimed" : "Mark Claimed"}
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </>
          )}

          {section === "creative" && (
            <>
              {canCreativeWork && (
                <Card className="mb-6 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-navy">Log a Creative Work</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <FieldLabel required>Title</FieldLabel>
                      <Input
                        aria-invalid={attemptedCreative && !creativeForm.title.trim()}
                        value={creativeForm.title}
                        onChange={(e) => setCreativeForm((f) => ({ ...f, title: e.target.value }))}
                      />
                    </div>
                    <div>
                      <FieldLabel required>Work Type</FieldLabel>
                      <Input
                        aria-invalid={attemptedCreative && !creativeForm.work_type.trim()}
                        value={creativeForm.work_type}
                        onChange={(e) => setCreativeForm((f) => ({ ...f, work_type: e.target.value }))}
                        placeholder="e.g. digital art, literary work, software"
                      />
                    </div>
                    <div>
                      <FieldLabel required>Date Created</FieldLabel>
                      <Input
                        aria-invalid={attemptedCreative && !creativeForm.date_created}
                        type="date"
                        value={creativeForm.date_created}
                        onChange={(e) => setCreativeForm((f) => ({ ...f, date_created: e.target.value }))}
                      />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-2">
                      <FieldLabel>Description</FieldLabel>
                      <Input
                        value={creativeForm.description}
                        onChange={(e) => setCreativeForm((f) => ({ ...f, description: e.target.value }))}
                      />
                    </div>
                    <div>
                      <FieldLabel>Rights Holder</FieldLabel>
                      <Input
                        value={creativeForm.rights_holder}
                        onChange={(e) => setCreativeForm((f) => ({ ...f, rights_holder: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button size="sm" onClick={handleAddCreativeWork} disabled={isSavingCreative}>
                      <Plus className="size-4" />
                      {isSavingCreative ? "Logging..." : "Log Creative Work"}
                    </Button>
                  </div>
                </Card>
              )}

              <Card className="overflow-hidden p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/60 hover:bg-secondary/60">
                      <TableHead>Title</TableHead>
                      <TableHead>Work Type</TableHead>
                      <TableHead>Date Created</TableHead>
                      <TableHead>Rights Holder</TableHead>
                      <TableHead>Registered</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingSection ? (
                      <TableSkeletonRows rows={3} columns={5} />
                    ) : creativeWorks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="p-0">
                          <EmptyState icon={<Palette className="size-7" />} title="No creative works logged yet" />
                        </TableCell>
                      </TableRow>
                    ) : (
                      creativeWorks.map((w) => (
                        <TableRow key={w.id}>
                          <TableCell className="font-medium">{w.title}</TableCell>
                          <TableCell>{w.work_type}</TableCell>
                          <TableCell>{w.date_created}</TableCell>
                          <TableCell>{w.rights_holder || "—"}</TableCell>
                          <TableCell>
                            {canCreativeWork ? (
                              <Button size="sm" variant="outline" onClick={() => handleToggleRegistered(w)}>
                                {w.is_registered ? "Registered" : "Mark Registered"}
                              </Button>
                            ) : (
                              <Badge variant="outline">{w.is_registered ? "Registered" : "Unregistered"}</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </>
          )}

          {section === "sense" && (
            <>
              {canManageSense && (
                <Card className="mb-6 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-navy">Add a SENSE-Ranked Publisher</h3>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1">
                      <FieldLabel required>Publisher Name</FieldLabel>
                      <Input value={senseName} onChange={(e) => setSenseName(e.target.value)} />
                    </div>
                    <Button size="sm" onClick={handleAddSensePublisher} disabled={isSavingSense}>
                      <Plus className="size-4" />
                      {isSavingSense ? "Adding..." : "Add Publisher"}
                    </Button>
                  </div>
                </Card>
              )}

              <Card className="overflow-hidden p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/60 hover:bg-secondary/60">
                      <TableHead>Publisher</TableHead>
                      <TableHead>Added</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sensePublishers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="p-0">
                          <EmptyState
                            icon={<Award className="size-7" />}
                            title="No publishers listed yet"
                            description="RIUH maintains this list per the Manual's Appendix Q."
                          />
                        </TableCell>
                      </TableRow>
                    ) : (
                      sensePublishers.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell>{new Date(p.created_at).toLocaleDateString()}</TableCell>
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

export default function OutputsPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Research Outputs">
        <OutputsContent />
      </AppShell>
    </ProtectedRoute>
  );
}
