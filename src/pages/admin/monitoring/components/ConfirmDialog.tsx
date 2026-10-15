import React from "react";
import { ConfirmationDialog } from "../../../components/dialogs/ConfirmationDialog";

export interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  description: string;
  type: "success" | "danger" | "warning" | "info";
  confirmLabel: string;
  requireWord?: string;
  onConfirm: () => void | Promise<void>;
}

interface ConfirmDialogProps {
  dialog: ConfirmDialogState;
  setDialog: React.Dispatch<React.SetStateAction<ConfirmDialogState>>;
}

/**
 * Wrapper untuk ConfirmationDialog generik.
 * Diekstrak dari MonitoringPage untuk kerapian kode.
 */
export const ConfirmDialog = ({ dialog, setDialog }: ConfirmDialogProps) => {
  return (
    <ConfirmationDialog
      isOpen={dialog.isOpen}
      onClose={() => setDialog(prev => ({ ...prev, isOpen: false }))}
      onConfirm={async () => {
        await dialog.onConfirm();
        setDialog(prev => ({ ...prev, isOpen: false }));
      }}
      title={dialog.title}
      description={dialog.description}
      type={dialog.type}
      confirmLabel={dialog.confirmLabel}
      requireWord={dialog.requireWord}
    />
  );
};
