"use client";

import { DEFAULT_LOCAL_MODEL_ID, getLocalModel } from "@/lib/ai/models";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface OfflineModeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  /** Extra sentence, e.g. that the failed message is sent again. */
  detail?: string;
}

/** Confirms the one-time model download before Offline / Private mode is turned on. */
export function OfflineModeDialog({ open, onOpenChange, onConfirm, detail }: OfflineModeDialogProps) {
  const model = getLocalModel(DEFAULT_LOCAL_MODEL_ID);
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Turn on Offline mode?</AlertDialogTitle>
          <AlertDialogDescription>
            Offline mode runs {model?.name} in this browser, so the student&apos;s code never leaves this device. The first
            time, about {model?.sizeLabel.replace("~", "")} is downloaded (it is cached afterwards). Answers are slower and
            less accurate than in the cloud.{detail ? ` ${detail}` : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Download and turn on</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
