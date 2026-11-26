"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { ArrowUpIcon, SquareIcon } from "lucide-react";

import { getEditorMarkdown } from "@/lib/editor/extensions";
import { extractCodeBlocks } from "@/lib/editor/code-blocks";
import { validateFiles, type AttachedFile } from "@/lib/files/validate";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AttachButton } from "@/components/prompt/attach-button";
import { EditorToolbar } from "@/components/prompt/editor-toolbar";
import { FileChip } from "@/components/prompt/file-chip";
import { PromptEditor } from "@/components/prompt/prompt-editor";
import { PromptErrors } from "@/components/prompt/prompt-errors";

export interface PromptSubmission {
  markdown: string;
  files: AttachedFile[];
}

interface PromptInputProps {
  /** True until the chat's first message is sent: files can only be attached then. */
  isFirstMessage: boolean;
  /** A response is being generated. */
  busy: boolean;
  /** Why sending is not possible right now (e.g. model still loading). */
  sendBlockedReason?: string;
  onSubmit: (submission: PromptSubmission) => void;
  onStop: () => void;
  /** Model selector, rendered in the bottom bar. */
  modelSelector?: ReactNode;
}

export const MISSING_CODE_ERROR =
  "Add the student's code first: attach their file(s) or paste the code into a code block.";

export function PromptInput({ isFirstMessage, busy, sendBlockedReason, onSubmit, onStop, modelSelector }: PromptInputProps) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const isEmpty = useEditorState({ editor, selector: ({ editor: e }) => e?.isEmpty ?? true }) ?? true;

  const attachedFiles = useMemo(() => (isFirstMessage ? files : []), [isFirstMessage, files]);

  const addFiles = useCallback(
    async (picked: File[]) => {
      const result = await validateFiles(picked, files);
      setFiles((current) => [...current, ...result.accepted]);
      setErrors(result.errors);
    },
    [files],
  );

  const submit = useCallback(() => {
    if (!editor || busy) return;
    const markdown = getEditorMarkdown(editor);
    if (isFirstMessage) {
      if (!attachedFiles.length && !extractCodeBlocks(markdown).length) {
        setErrors([MISSING_CODE_ERROR]);
        return;
      }
    } else if (!markdown) {
      return;
    }
    if (sendBlockedReason) {
      setErrors([sendBlockedReason]);
      return;
    }
    onSubmit({ markdown, files: attachedFiles });
    editor.commands.clearContent(true);
    setFiles([]);
    setErrors([]);
  }, [editor, busy, sendBlockedReason, isFirstMessage, attachedFiles, onSubmit]);

  const canSend = !busy && (!isEmpty || attachedFiles.length > 0);

  return (
    <div className="mx-auto w-full max-w-3xl px-3 pb-3 sm:px-4 sm:pb-4">
      <PromptErrors errors={errors} onDismiss={() => setErrors([])} />
      <div className="rounded-xl border bg-background shadow-sm focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30">
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pt-3" aria-label="Attached files">
            {attachedFiles.map((file) => (
              <FileChip
                key={file.name}
                name={file.name}
                size={file.size}
                onRemove={() => setFiles((current) => current.filter((f) => f.name !== file.name))}
              />
            ))}
          </div>
        )}
        <PromptEditor
          key={isFirstMessage ? "first" : "follow-up"}
          autoFocus={!isFirstMessage}
          placeholder={
            isFirstMessage
              ? "Paste the student's code in a code block (```) or attach files, then say what to check…"
              : "Ask a follow-up or correct the result…"
          }
          onSubmit={submit}
          onReady={setEditor}
        />
        <div className="flex flex-wrap items-center gap-1 border-t px-2 py-1.5">
          <AttachButton
            disabledReason={isFirstMessage ? undefined : "Files can only be added at the start of a chat."}
            onFiles={addFiles}
          />
          {editor && <EditorToolbar editor={editor} />}
          <div className="ml-auto flex items-center gap-1">
            {modelSelector}
            {busy ? (
              <Button type="button" size="icon-sm" aria-label="Stop generating" onClick={onStop}>
                <SquareIcon className="size-3 fill-current" />
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button type="button" size="icon-sm" aria-label="Send" onClick={submit} disabled={!canSend}>
                    <ArrowUpIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Send (Enter) · New line (Shift+Enter)</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
