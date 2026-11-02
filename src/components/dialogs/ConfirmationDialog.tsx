import * as React from "react";
import {
  NeonConfirmModal,
  type NeonConfirmModalProps,
  type NeonConfirmType,
} from "../ui/NeonConfirmModal";

export type { NeonConfirmType };

export interface ConfirmationDialogProps extends NeonConfirmModalProps {}

/**
 * ConfirmationDialog:
 * Wrapper kanonis untuk NeonConfirmModal agar seluruh dialog konfirmasi
 * di aplikasi (hapus soal, reset password, hapus ruang ujian, dsb.)
 * otomatis menggunakan tema dan standar visual Neon UI.
 */
export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = (props) => {
  return <NeonConfirmModal {...props} />;
};

export default ConfirmationDialog;
