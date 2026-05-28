import { Component, useEffect, useId, useState, type ReactNode } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown as cmMarkdown } from "@codemirror/lang-markdown";
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  linkPlugin,
  linkDialogPlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  codeBlockPlugin,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  CreateLink,
  ListsToggle,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";

interface Props {
  /** Form field name — a hidden input with this name carries the markdown source. */
  name: string;
  /** Initial value (from DB). */
  defaultValue?: string | null;
  /** Visible label above the editor. */
  label: string;
  /** Optional hint text under the label. */
  hint?: string;
  /** Minimum rows of vertical space the editor body should occupy. */
  rows?: number;
}

/**
 * Drop-in markdown editor for admin forms. Renders MDXEditor (Lexical-based,
 * rich toolbar) and falls back to a CodeMirror markdown editor inside an
 * error boundary if MDXEditor crashes during render. A plain hidden input
 * always carries the markdown source so the surrounding <form> submits it
 * regardless of which editor view is active.
 */
export default function MarkdownEditor({
  name,
  defaultValue,
  label,
  hint,
  rows = 12,
}: Props) {
  const inputId = useId();
  const initial = defaultValue ?? "";
  const [value, setValue] = useState(initial);
  const [mounted, setMounted] = useState(false);

  // Defer the rich editor until after hydration. Both MDXEditor (Lexical)
  // and CodeMirror touch the DOM at construction, so server-rendering them
  // explodes. Showing a plain textarea pre-mount avoids a flash of nothing.
  useEffect(() => setMounted(true), []);

  const minHeight = `${rows * 1.6}rem`;

  return (
    <div className="block">
      <div className="flex items-baseline justify-between mb-1 gap-2 flex-wrap">
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      </div>
      {hint && <p className="text-xs text-slate-400 mb-2">{hint}</p>}

      <input id={inputId} type="hidden" name={name} value={value} />

      <div className="border border-slate-300 rounded overflow-hidden bg-white" style={{ minHeight }}>
        {mounted ? (
          <EditorErrorBoundary
            fallback={
              <CodeMirrorView value={value} onChange={setValue} minHeight={minHeight} />
            }
          >
            <MdxEditorView initial={initial} value={value} onChange={setValue} minHeight={minHeight} />
          </EditorErrorBoundary>
        ) : (
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={rows}
            className="block w-full px-3 py-2 text-sm font-mono resize-y focus:outline-none bg-white"
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MDXEditor — the primary view.
// ---------------------------------------------------------------------------

function MdxEditorView({
  initial,
  value,
  onChange,
  minHeight,
}: {
  initial: string;
  /** Currently-committed value (used to detect external resets, not bound). */
  value: string;
  onChange: (v: string) => void;
  minHeight: string;
}) {
  // MDXEditor takes `markdown` as the initial source and tracks its own
  // internal state thereafter — we only push back to React via onChange.
  // We deliberately don't re-feed `value`, since MDXEditor is uncontrolled.
  void value;
  return (
    <div className="mdx-editor-shell" style={{ minHeight }}>
      <MDXEditor
        markdown={initial}
        onChange={onChange}
        contentEditableClassName="md-preview px-4 py-3 outline-none min-h-[8rem] text-sm"
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          linkPlugin(),
          linkDialogPlugin(),
          thematicBreakPlugin(),
          codeBlockPlugin(),
          markdownShortcutPlugin(),
          toolbarPlugin({
            toolbarContents: () => (
              <>
                <UndoRedo />
                <BlockTypeSelect />
                <BoldItalicUnderlineToggles />
                <ListsToggle />
                <CreateLink />
              </>
            ),
          }),
        ]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// CodeMirror — the fallback view.
// ---------------------------------------------------------------------------

function CodeMirrorView({
  value,
  onChange,
  minHeight,
}: {
  value: string;
  onChange: (v: string) => void;
  minHeight: string;
}) {
  return (
    <div className="text-sm" style={{ minHeight }}>
      <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-xs px-3 py-1.5">
        Rich editor failed to load — using plain markdown. Form save still works.
      </div>
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={[cmMarkdown()]}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: false,
        }}
        style={{ fontSize: "0.85rem" }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error boundary
// ---------------------------------------------------------------------------

class EditorErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    // Surface to the console so officers can paste it into a bug report.
    // The fallback takes over so the form is still usable.

    console.error("MDXEditor crashed, falling back to CodeMirror:", error);
  }

  render(): ReactNode {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
