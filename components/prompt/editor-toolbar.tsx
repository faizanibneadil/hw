"use client";

import type { ComponentType } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import {
  BoldIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  SquareCodeIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ToolbarAction {
  label: string;
  shortcut?: string;
  icon: ComponentType<{ className?: string }>;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
}

const ACTIONS: ToolbarAction[] = [
  {
    label: "Heading 1",
    shortcut: "# ",
    icon: Heading1Icon,
    isActive: (e) => e.isActive("heading", { level: 1 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    label: "Heading 2",
    shortcut: "## ",
    icon: Heading2Icon,
    isActive: (e) => e.isActive("heading", { level: 2 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: "Heading 3",
    shortcut: "### ",
    icon: Heading3Icon,
    isActive: (e) => e.isActive("heading", { level: 3 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    label: "Bold",
    shortcut: "Ctrl+B",
    icon: BoldIcon,
    isActive: (e) => e.isActive("bold"),
    run: (e) => e.chain().focus().toggleBold().run(),
  },
  {
    label: "Italic",
    shortcut: "Ctrl+I",
    icon: ItalicIcon,
    isActive: (e) => e.isActive("italic"),
    run: (e) => e.chain().focus().toggleItalic().run(),
  },
  {
    label: "Bullet list",
    shortcut: "- ",
    icon: ListIcon,
    isActive: (e) => e.isActive("bulletList"),
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    label: "Numbered list",
    shortcut: "1. ",
    icon: ListOrderedIcon,
    isActive: (e) => e.isActive("orderedList"),
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    label: "Inline code",
    shortcut: "`code`",
    icon: CodeIcon,
    isActive: (e) => e.isActive("code"),
    run: (e) => e.chain().focus().toggleCode().run(),
  },
  {
    label: "Code block",
    shortcut: "```",
    icon: SquareCodeIcon,
    isActive: (e) => e.isActive("codeBlock"),
    run: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
];

export function EditorToolbar({ editor }: { editor: Editor }) {
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ACTIONS.map((action) => (e ? action.isActive(e) : false)),
  });

  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5">
      {ACTIONS.map((action, index) => (
        <Tooltip key={action.label}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={action.label}
              aria-pressed={active?.[index] ?? false}
              disabled={!editor.isEditable}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => action.run(editor)}
              className={cn("text-muted-foreground", active?.[index] && "bg-accent text-foreground")}
            >
              <action.icon className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {action.label}
            {action.shortcut && <span className="ml-1.5 opacity-60">{action.shortcut}</span>}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
