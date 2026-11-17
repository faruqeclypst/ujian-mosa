import React from "react";
import type { QuestionFormValues } from "./types";
import { MultipleChoiceEditor } from "./MultipleChoiceEditor";
import { TrueFalseEditor } from "./TrueFalseEditor";
import { MatrixEditor } from "./MatrixEditor";
import { ClassificationEditor } from "./ClassificationEditor";
import { ClozeEditor } from "./ClozeEditor";
import { MatchingEditor } from "./MatchingEditor";
import { ShortAnswerEditor } from "./ShortAnswerEditor";
import { SequenceEditor } from "./SequenceEditor";
import { HotspotEditor } from "./HotspotEditor";

export interface QuestionTypeDispatcherProps {
  formValues: QuestionFormValues;
  setFormValues: React.Dispatch<React.SetStateAction<any>>;
  choiceFiles?: Record<string, File | null>;
  setChoiceFiles?: React.Dispatch<React.SetStateAction<any>>;
  hotspotFile?: File | null;
  setHotspotFile?: React.Dispatch<React.SetStateAction<any>>;
  onPickChoiceImage?: (letter: string) => void;
  onPickHotspotImage?: () => void;
  onUploadHotspotImage?: () => void;
  showPreview?: boolean;
  quillModules?: any;
  quillFormats?: any;
  selectedQuestionId?: string;
}

export const QuestionTypeDispatcher: React.FC<QuestionTypeDispatcherProps> = ({
  formValues,
  setFormValues,
  choiceFiles = {},
  setChoiceFiles,
  hotspotFile = null,
  setHotspotFile,
  onPickChoiceImage = () => {},
  onPickHotspotImage = () => {},
  onUploadHotspotImage,
  showPreview = false,
  quillModules,
  quillFormats,
  selectedQuestionId,
}) => {
  const type = formValues.type;

  // Multiple Choice / Complex Multiple Choice
  if (type === "pilihan_ganda" || type === "pilihan_ganda_kompleks") {
    return (
      <MultipleChoiceEditor
        type={type}
        choices={formValues.choices}
        choiceFiles={choiceFiles}
        onChangeChoice={(letter, field, value) => {
          setFormValues((prev: any) => ({
            ...prev,
            choices: {
              ...prev.choices,
              [letter]: {
                ...prev.choices[letter],
                [field]: value,
              },
            },
          }));
        }}
        onReorderChoices={(newChoices) => {
          setFormValues((prev: any) => ({ ...prev, choices: newChoices }));
        }}
        onPickChoiceImage={onPickChoiceImage}
        onRemoveChoiceImage={(letter) => {
          setFormValues((prev: any) => ({
            ...prev,
            choices: {
              ...prev.choices,
              [letter]: {
                ...prev.choices[letter],
                imageUrl: "",
              },
            },
          }));
          if (setChoiceFiles) {
            setChoiceFiles((prev: any) => ({ ...prev, [letter]: null }));
          }
        }}
        showPreview={showPreview}
        quillModules={quillModules}
        quillFormats={quillFormats}
        selectedQuestionId={selectedQuestionId}
      />
    );
  }

  // True / False
  if (type === "benar_salah") {
    return (
      <TrueFalseEditor
        statements={formValues.statements || []}
        onChangeStatements={(statements) => {
          setFormValues((prev: any) => ({ ...prev, statements }));
        }}
      />
    );
  }

  // Matrix
  if (type === "matriks") {
    return (
      <MatrixEditor
        columns={formValues.matrixColumns || []}
        statements={formValues.matrixStatements || []}
        onChangeColumns={(matrixColumns) => {
          setFormValues((prev: any) => ({ ...prev, matrixColumns }));
        }}
        onChangeStatements={(matrixStatements) => {
          setFormValues((prev: any) => ({ ...prev, matrixStatements }));
        }}
      />
    );
  }

  // Classification
  if (type === "klasifikasi") {
    return (
      <ClassificationEditor
        categories={formValues.klasifikasiCategories || []}
        statements={formValues.klasifikasiStatements || []}
        shuffle={formValues.klasifikasiShuffle}
        onChangeCategories={(klasifikasiCategories) => {
          setFormValues((prev: any) => ({ ...prev, klasifikasiCategories }));
        }}
        onChangeStatements={(klasifikasiStatements) => {
          setFormValues((prev: any) => ({ ...prev, klasifikasiStatements }));
        }}
        onChangeShuffle={(klasifikasiShuffle) => {
          setFormValues((prev: any) => ({ ...prev, klasifikasiShuffle }));
        }}
      />
    );
  }

  // Cloze / Isian Rumpang
  if (type === "isian_rumpang") {
    return (
      <ClozeEditor
        text={formValues.isianRumpangText || ""}
        blanks={formValues.isianRumpangBlanks || []}
        onChangeText={(isianRumpangText) => {
          setFormValues((prev: any) => ({ ...prev, isianRumpangText }));
        }}
        onChangeBlanks={(isianRumpangBlanks) => {
          setFormValues((prev: any) => ({ ...prev, isianRumpangBlanks }));
        }}
      />
    );
  }

  // Matching / Menjodohkan
  if (type === "menjodohkan") {
    return (
      <MatchingEditor
        pairs={formValues.pairs || []}
        onChangePairs={(pairs) => {
          setFormValues((prev: any) => ({ ...prev, pairs }));
        }}
      />
    );
  }

  // Short Answer & Essay
  if (type === "isian_singkat" || type === "uraian") {
    return (
      <ShortAnswerEditor
        type={type}
        answerKey={formValues.answerKey || ""}
        onChangeAnswerKey={(answerKey) => {
          setFormValues((prev: any) => ({ ...prev, answerKey }));
        }}
      />
    );
  }

  // Ordering & Drag and Drop
  if (type === "urutkan" || type === "drag_drop") {
    return (
      <SequenceEditor
        type={type}
        items={formValues.items || []}
        onChangeItems={(items) => {
          setFormValues((prev: any) => ({ ...prev, items }));
        }}
      />
    );
  }

  // Hotspot
  if (type === "hotspot") {
    return (
      <HotspotEditor
        hotspotImageUrl={formValues.hotspotImageUrl}
        hotspotFile={hotspotFile}
        hotspotMode={formValues.hotspotMode}
        hotspotAreas={formValues.hotspotAreas || []}
        onPickImage={onPickHotspotImage}
        onUploadImage={onUploadHotspotImage}
        onRemoveImage={() => {
          if (setHotspotFile) setHotspotFile(null);
          setFormValues((prev: any) => ({ ...prev, hotspotImageUrl: "" }));
        }}
        onChangeMode={(hotspotMode) => {
          setFormValues((prev: any) => ({ ...prev, hotspotMode }));
        }}
        onChangeAreas={(hotspotAreas) => {
          setFormValues((prev: any) => ({ ...prev, hotspotAreas }));
        }}
      />
    );
  }

  return null;
};

export default QuestionTypeDispatcher;
