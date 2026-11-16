import { useId, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";

export type PickerProject = { id: number; project_code: string; title: string };

/** Client Task 67: project dropdown as a scrolling list, NTP on top and the (often long) title under it. */
export function ProjectPicker({ projects, value, onChange, id, ariaLabel = "Project" }: {
  projects: PickerProject[];
  value: string;
  onChange: (id: string) => void;
  id?: string;
  ariaLabel?: string;
}) {
  const listId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const selected = projects.find((p) => String(p.id) === value);
  const q = query.trim().toLowerCase();
  const matches = projects.filter((p) => !q || `${p.project_code} ${p.title}`.toLowerCase().includes(q));

  const show = () => {
    setQuery("");
    setActive(Math.max(0, projects.findIndex((p) => String(p.id) === value)));
    setOpen(true);
    setTimeout(() => searchRef.current?.focus());
  };
  const choose = (p: PickerProject | undefined) => {
    if (!p) return;
    onChange(String(p.id));
    setOpen(false);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (matches.length ? (i + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(matches[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
  };

  return (
    <div className="relative" onBlur={onBlur}>
      <button
        type="button"
        id={id}
        aria-label={selected ? `${ariaLabel}: ${selected.project_code} ${selected.title}` : ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : show())}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left outline-none transition-all focus:border-[#0891b2]"
        style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}
      >
        <ProjectLines project={selected} />
        <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "#64748b" }} aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-xl shadow-lg overflow-hidden" style={{ background: "white", border: "1px solid #e2e8f0" }}>
          <input
            ref={searchRef}
            className="w-full px-3 py-2 text-sm outline-none border-b"
            style={{ borderColor: "#e2e8f0", color: "#334155" }}
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={matches[active] ? `${listId}-${matches[active].id}` : undefined}
            aria-label={`Search ${ariaLabel.toLowerCase()} by NTP or title`}
            placeholder="Search NTP or title"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKey}
          />
          <ul id={listId} role="listbox" aria-label={ariaLabel} className="max-h-64 overflow-y-auto">
            {matches.map((p, i) => (
              <li
                key={p.id}
                id={`${listId}-${p.id}`}
                role="option"
                aria-selected={String(p.id) === value}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(p);
                }}
                className="px-3 py-2 cursor-pointer border-b last:border-b-0"
                style={{ borderColor: "#f1f5f9", background: i === active ? "#f0f9ff" : String(p.id) === value ? "#e0f2fe" : undefined }}
              >
                <ProjectLines project={p} />
              </li>
            ))}
            {matches.length === 0 && <li className="px-3 py-2 text-xs" style={{ color: "#94a3b8" }}>No matching project.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function ProjectLines({ project }: { project?: PickerProject }) {
  if (!project) return <span className="flex-1 text-sm" style={{ color: "#94a3b8" }}>Select a project</span>;
  return (
    <span className="flex-1 min-w-0">
      <span className="block text-xs font-bold font-mono" style={{ color: "#0d2a5e" }}>{project.project_code}</span>
      <span className="block text-xs leading-snug break-words" style={{ color: "#475569" }}>{project.title}</span>
    </span>
  );
}
