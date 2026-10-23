import { useEffect, type ReactNode } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { editorValue, safeHtml, toEditorHtml } from "../../lib/richText";

// Client 2026-10-23: proposal sections are typed or pasted (e.g. from Word) as rich text. Only what the backend keeps is
// offered: no code blocks, rules or images.
const EXTENSIONS = [
  StarterKit.configure({ heading: { levels: [2, 3] }, code: false, codeBlock: false, horizontalRule: false, link: { openOnClick: false } }),
  TableKit.configure({ table: { resizable: false } }),
];

function ToolButton({ label, title, active, disabled, onClick }: { label: ReactNode; title: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="min-w-7 h-7 px-1.5 rounded text-xs font-semibold disabled:opacity-40"
      style={{ background: active ? "#e0f2fe" : "transparent", color: active ? "#0369a1" : "#475569" }}
    >
      {label}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const chain = () => editor.chain().focus();
  const inTable = editor.isActive("table");
  const sep = <span className="w-px h-5 mx-1" style={{ background: "#e2e8f0" }} />;
  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1 border-b" style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}>
      <ToolButton label={<b>B</b>} title="Bold" active={editor.isActive("bold")} onClick={() => chain().toggleBold().run()} />
      <ToolButton label={<i>I</i>} title="Italic" active={editor.isActive("italic")} onClick={() => chain().toggleItalic().run()} />
      <ToolButton label={<u>U</u>} title="Underline" active={editor.isActive("underline")} onClick={() => chain().toggleUnderline().run()} />
      <ToolButton label={<s>S</s>} title="Strikethrough" active={editor.isActive("strike")} onClick={() => chain().toggleStrike().run()} />
      {sep}
      <ToolButton label="H2" title="Heading" active={editor.isActive("heading", { level: 2 })} onClick={() => chain().toggleHeading({ level: 2 }).run()} />
      <ToolButton label="H3" title="Subheading" active={editor.isActive("heading", { level: 3 })} onClick={() => chain().toggleHeading({ level: 3 }).run()} />
      <ToolButton label="• List" title="Bulleted list" active={editor.isActive("bulletList")} onClick={() => chain().toggleBulletList().run()} />
      <ToolButton label="1. List" title="Numbered list" active={editor.isActive("orderedList")} onClick={() => chain().toggleOrderedList().run()} />
      <ToolButton label="❝" title="Quote" active={editor.isActive("blockquote")} onClick={() => chain().toggleBlockquote().run()} />
      {sep}
      <ToolButton label="▦ Table" title="Insert table" disabled={inTable} onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
      {inTable && (
        <>
          <ToolButton label="+ Row" title="Add row below" onClick={() => chain().addRowAfter().run()} />
          <ToolButton label="+ Col" title="Add column right" onClick={() => chain().addColumnAfter().run()} />
          <ToolButton label="− Row" title="Delete row" onClick={() => chain().deleteRow().run()} />
          <ToolButton label="− Col" title="Delete column" onClick={() => chain().deleteColumn().run()} />
          <ToolButton label="✕ Table" title="Delete table" onClick={() => chain().deleteTable().run()} />
        </>
      )}
      {sep}
      <ToolButton label="↶" title="Undo" disabled={!editor.can().undo()} onClick={() => chain().undo().run()} />
      <ToolButton label="↷" title="Redo" disabled={!editor.can().redo()} onClick={() => chain().redo().run()} />
    </div>
  );
}

export function RichTextEditor({ value, onChange, placeholder, ariaLabel }: { value: string; onChange: (html: string) => void; placeholder?: string; ariaLabel: string }) {
  const editor = useEditor({
    extensions: EXTENSIONS,
    content: toEditorHtml(value),
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: { class: "rich-text min-h-32 px-3 py-2 text-sm outline-none", "aria-label": ariaLabel, role: "textbox", "aria-multiline": "true" },
      transformPastedHTML: (html) => safeHtml(html),
    },
    onUpdate: ({ editor: e }) => onChange(editorValue(e.getHTML())),
  });

  // A value set from outside (draft restore, Edit Registration load) replaces the content without a change event.
  useEffect(() => {
    if (editor && editorValue(editor.getHTML()) !== value && toEditorHtml(value) !== editor.getHTML()) {
      editor.commands.setContent(toEditorHtml(value), { emitUpdate: false });
    }
  }, [editor, value]);

  return (
    <div className="rounded-lg border overflow-hidden focus-within:border-[#0891b2]" style={{ borderColor: "#e2e8f0", background: "white" }}>
      {editor && <Toolbar editor={editor} />}
      <div className="relative">
        {editor?.isEmpty && placeholder && (
          <p className="absolute left-3 top-2 text-sm pointer-events-none" style={{ color: "#94a3b8" }}>{placeholder}</p>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

/** A saved section (rich or older plain text) for reading. */
export function RichTextView({ value, className }: { value: string; className?: string }) {
  return <div className={`rich-text ${className ?? ""}`} dangerouslySetInnerHTML={{ __html: safeHtml(value) }} />;
}
