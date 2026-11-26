"use client";

import { useEffect, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";

import { createEditorExtensions, SUBMIT_EVENT } from "@/lib/editor/extensions";

interface PromptEditorProps {
  /** Fixed for the lifetime of the editor; remount (key) to change it. */
  placeholder: string;
  autoFocus?: boolean;
  disabled?: boolean;
  onSubmit: () => void;
  onReady: (editor: Editor) => void;
}

/** Tiptap prompt editor. Enter sends, Shift+Enter adds a line, Enter inside code blocks adds a line. */
export function PromptEditor({ placeholder, autoFocus, disabled, onSubmit, onReady }: PromptEditorProps) {
  const [extensions] = useState(() => createEditorExtensions({ placeholder }));

  const editor = useEditor({
    immediatelyRender: false,
    autofocus: autoFocus ? "end" : false,
    extensions,
    editorProps: {
      attributes: {
        "aria-label": "Prompt",
        "aria-multiline": "true",
        role: "textbox",
        class: "prose-hw tiptap-editor text-sm outline-none",
      },
    },
  });

  useEffect(() => {
    if (editor) onReady(editor);
  }, [editor, onReady]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const handler = () => onSubmit();
    dom.addEventListener(SUBMIT_EVENT, handler);
    return () => dom.removeEventListener(SUBMIT_EVENT, handler);
  }, [editor, onSubmit]);

  return (
    // The wrapper owns the padding/min-height so clicks on empty space never land on a
    // document-level position; they focus the end of the content instead.
    <div
      className="max-h-[40dvh] min-h-16 cursor-text overflow-y-auto px-3 py-2"
      onMouseDown={(event) => {
        if (editor && event.target === event.currentTarget) {
          event.preventDefault();
          editor.commands.focus("end");
        }
      }}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
