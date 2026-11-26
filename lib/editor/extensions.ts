import { Extension, ReactNodeViewRenderer, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Markdown } from "@tiptap/markdown";
import { Placeholder } from "@tiptap/extensions";

import { lowlight } from "@/lib/editor/lowlight";
import { CodeBlockView } from "@/components/prompt/code-block-view";

export const SUBMIT_EVENT = "hw:submit";

/**
 * Enter sends (dispatches `SUBMIT_EVENT`); Shift+Enter starts a new line (new list item / paragraph).
 * Inside a code block Enter is left to the code block (newline); Shift+Enter also inserts a newline.
 */
const SubmitOnEnter = Extension.create({
  name: "submitOnEnter",
  priority: 1000,
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        if (editor.isActive("codeBlock")) return false;
        editor.view.dom.dispatchEvent(new CustomEvent(SUBMIT_EVENT));
        return true;
      },
      "Shift-Enter": ({ editor }) => {
        if (editor.isActive("codeBlock")) return editor.commands.newlineInCode();
        return editor.commands.first(({ commands }) => [
          () => commands.splitListItem("listItem"),
          () => commands.splitBlock(),
        ]);
      },
    };
  },
});

/** Editor extensions. Enter dispatches `SUBMIT_EVENT` on the editor DOM element. */
export function createEditorExtensions(options: { placeholder: string }) {
  return [
    StarterKit.configure({
      // Basic formatting only: headings, bold, italic, lists, inline code, code blocks.
      heading: { levels: [1, 2, 3] },
      codeBlock: false,
      blockquote: false,
      strike: false,
      underline: false,
      link: false,
      horizontalRule: false,
    }),
    CodeBlockLowlight.extend({
      addNodeView() {
        return ReactNodeViewRenderer(CodeBlockView);
      },
    }).configure({
      lowlight,
      enableTabIndentation: true,
      tabSize: 2,
      // Keep the teacher inside the block while pasting/typing code; exit with arrow keys or triple Enter.
      exitOnTripleEnter: true,
    }),
    Markdown.configure({ indentation: { style: "space", size: 2 } }),
    Placeholder.configure({ placeholder: options.placeholder }),
    SubmitOnEnter,
  ];
}

/** Editor content as Markdown (code blocks become fenced blocks with their language). */
export function getEditorMarkdown(editor: Editor): string {
  return editor.getMarkdown().trim();
}
