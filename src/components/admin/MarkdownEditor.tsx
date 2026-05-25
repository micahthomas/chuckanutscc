import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Marked } from "marked";

const marked = new Marked({ gfm: true, breaks: false });

interface Props {
  /** Form field name — a real <textarea> with this name is rendered so form submit works. */
  name: string;
  /** Initial value (from DB). */
  defaultValue?: string | null;
  /** Visible label above the editor. */
  label: string;
  /** Optional hint text under the label. */
  hint?: string;
  /** Textarea rows when in edit mode (sets min height). */
  rows?: number;
}

type Mode = "split" | "write" | "preview";

/**
 * Drop-in replacement for a plain markdown <textarea>. Renders:
 *   - A small toolbar that wraps the selection in common markdown syntax
 *   - The textarea (left) + live preview (right) side by side
 *   - On narrow screens collapses to a tabbed write/preview pair
 *
 * The hidden form contract is preserved — the textarea still carries `name`,
 * so the surrounding <form> submits the markdown source exactly as before.
 */
export default function MarkdownEditor({
  name,
  defaultValue,
  label,
  hint,
  rows = 12,
}: Props) {
  const inputId = useId();
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(defaultValue ?? "");
  const [mode, setMode] = useState<Mode>("split");

  // On small screens default to "write" so the textarea isn't cramped.
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      setMode("write");
    }
  }, []);

  const html = useMemo(() => marked.parse(value || "", { async: false }) as string, [value]);

  function wrapSelection(before: string, after = before, placeholder = "") {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.slice(start, end);
    const insertText = selected || placeholder;
    const next = ta.value.slice(0, start) + before + insertText + after + ta.value.slice(end);
    setValue(next);
    // Restore focus + selection after React updates.
    requestAnimationFrame(() => {
      ta.focus();
      const cursor = start + before.length;
      ta.setSelectionRange(cursor, cursor + insertText.length);
    });
  }

  function prefixLines(prefix: string) {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    // Expand to full lines.
    const lineStart = ta.value.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = ta.value.indexOf("\n", end);
    const sliceEnd = lineEnd === -1 ? ta.value.length : lineEnd;
    const block = ta.value.slice(lineStart, sliceEnd);
    const lines = block.length === 0 ? [""] : block.split("\n");
    const prefixed = lines.map((l) => (l.startsWith(prefix) ? l : prefix + l)).join("\n");
    const next = ta.value.slice(0, lineStart) + prefixed + ta.value.slice(sliceEnd);
    setValue(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(lineStart, lineStart + prefixed.length);
    });
  }

  function insertLink() {
    const url = window.prompt("Link URL");
    if (!url) return;
    wrapSelection("[", `](${url})`, "link text");
  }

  return (
    <div className="block">
      <div className="flex items-baseline justify-between mb-1 gap-2 flex-wrap">
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
        <div className="flex items-center gap-1 text-xs">
          {(["split", "write", "preview"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-2 py-1 rounded border ${
                mode === m
                  ? "bg-brand-700 text-white border-brand-700"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {m === "split" ? "Side-by-side" : m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {hint && <p className="text-xs text-slate-400 mb-2">{hint}</p>}

      <div className="border border-slate-300 rounded overflow-hidden bg-white">
        {mode !== "preview" && (
          <Toolbar
            onBold={() => wrapSelection("**", "**", "bold")}
            onItalic={() => wrapSelection("*", "*", "italic")}
            onH1={() => prefixLines("# ")}
            onH2={() => prefixLines("## ")}
            onList={() => prefixLines("- ")}
            onNumberedList={() => prefixLines("1. ")}
            onQuote={() => prefixLines("> ")}
            onCode={() => wrapSelection("`", "`", "code")}
            onLink={insertLink}
          />
        )}

        <div
          className={
            mode === "split"
              ? "grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200"
              : "block"
          }
        >
          {mode !== "preview" && (
            <textarea
              ref={taRef}
              id={inputId}
              name={name}
              rows={rows}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="block w-full px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-brand-500/40 bg-white"
              spellCheck={true}
            />
          )}
          {/* When previewing alone, keep the textarea around so the form still submits. */}
          {mode === "preview" && (
            <input type="hidden" name={name} value={value} />
          )}

          {(mode === "split" || mode === "preview") && (
            <div className="px-4 py-3 text-sm bg-slate-50 overflow-auto" style={{ minHeight: rows * 24 }}>
              {value.trim() === "" ? (
                <p className="text-slate-400 italic">Preview will appear here.</p>
              ) : (
                <div className="md-preview" dangerouslySetInnerHTML={{ __html: html }} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

interface ToolbarProps {
  onBold: () => void;
  onItalic: () => void;
  onH1: () => void;
  onH2: () => void;
  onList: () => void;
  onNumberedList: () => void;
  onQuote: () => void;
  onCode: () => void;
  onLink: () => void;
}

function Toolbar(p: ToolbarProps) {
  const btn = "px-2 py-1 text-xs hover:bg-slate-100 rounded";
  return (
    <div className="flex items-center gap-0.5 px-2 py-1 border-b border-slate-200 bg-slate-50 text-slate-700 flex-wrap">
      <button type="button" onClick={p.onBold} className={`${btn} font-bold`} title="Bold (wrap **)">B</button>
      <button type="button" onClick={p.onItalic} className={`${btn} italic`} title="Italic (wrap *)">I</button>
      <span className="w-px h-4 bg-slate-300 mx-1" />
      <button type="button" onClick={p.onH1} className={btn} title="Heading 1">H1</button>
      <button type="button" onClick={p.onH2} className={btn} title="Heading 2">H2</button>
      <span className="w-px h-4 bg-slate-300 mx-1" />
      <button type="button" onClick={p.onList} className={btn} title="Bulleted list">• List</button>
      <button type="button" onClick={p.onNumberedList} className={btn} title="Numbered list">1. List</button>
      <button type="button" onClick={p.onQuote} className={btn} title="Block quote">❝ Quote</button>
      <span className="w-px h-4 bg-slate-300 mx-1" />
      <button type="button" onClick={p.onLink} className={btn} title="Insert link">🔗 Link</button>
      <button type="button" onClick={p.onCode} className={btn} title="Inline code"><code>{`</>`}</code></button>
    </div>
  );
}
