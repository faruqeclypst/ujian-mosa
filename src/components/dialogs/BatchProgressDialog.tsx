import React from "react";
import { NeonProgressModal, type BatchProgressState, type NeonProgressModalProps } from "../ui/NeonProgressModal";

export type { BatchProgressState };

export interface BatchProgressDialogProps extends NeonProgressModalProps {}

export const BatchProgressDialog: React.FC<BatchProgressDialogProps> = (props) => {
  return <NeonProgressModal {...props} />;
};

export default BatchProgressDialog;
