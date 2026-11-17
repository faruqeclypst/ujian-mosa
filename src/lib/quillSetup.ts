import { Quill } from "react-quill";
// @ts-ignore
import ImageResize from "quill-image-resize-module-react";
import "react-quill/dist/quill.snow.css";

// 1. Register ImageResize Module
(Quill as any).register("modules/imageResize", ImageResize);

// 2. Allow width/height attributes on images (untuk ImageResize module)
const ImageBlot = (Quill as any).import("formats/image") as any;
if (ImageBlot) {
  ImageBlot.sanitize = (url: string) => url; // allow all URLs
}

const BaseImageFormat = (Quill as any).import("formats/image") as any;
const ImageFormatAttributesList = ["alt", "height", "width", "style", "class"];

class CustomImageFormat extends BaseImageFormat {
  static formats(domNode: HTMLElement) {
    return ImageFormatAttributesList.reduce((formats: any, attribute) => {
      if (domNode.hasAttribute(attribute)) {
        formats[attribute] = domNode.getAttribute(attribute);
      }
      return formats;
    }, {});
  }
  format(name: string, value: string) {
    if (ImageFormatAttributesList.indexOf(name) > -1) {
      if (value) {
        this.domNode.setAttribute(name, value);
      } else {
        this.domNode.removeAttribute(name);
      }
    } else {
      super.format(name, value);
    }
  }
}
(Quill as any).register(CustomImageFormat, true);

// 3. REGISTER TABLE EMBED (preserve tables from Word copy-paste as non-editable blocks)
const BlockEmbed = (Quill as any).import("blots/block/embed") as any;

class TableEmbed extends BlockEmbed {
  static blotName = "tableEmbed";
  static tagName = "div";
  static className = "ql-table-embed";

  static create(value: string) {
    const node = super.create() as HTMLElement;
    node.innerHTML = value;
    node.setAttribute("contenteditable", "false");
    node.style.margin = "0.75rem 0";
    node.style.overflowX = "auto";
    return node;
  }

  static value(node: HTMLElement) {
    return node.innerHTML;
  }
}
(Quill as any).register(TableEmbed);

// 4. REGISTER CUSTOM FORMATS (only line-height, NOT margin-left/text-indent)
const Parchment = (Quill as any).import("parchment") as any;
const LineHeightStyle = new Parchment.Attributor.Style("line-height", "line-height", {
  scope: Parchment.Scope.BLOCK,
});
(Quill as any).register(LineHeightStyle, true);

// Allow standard CSS styles that might come from Word/Mammoth
const AlignStyle = (Quill as any).import("attributors/style/align") as any;
(Quill as any).register(AlignStyle, true);

const BackgroundStyle = (Quill as any).import("attributors/style/background") as any;
(Quill as any).register(BackgroundStyle, true);

const ColorStyle = (Quill as any).import("attributors/style/color") as any;
(Quill as any).register(ColorStyle, true);

/**
 * Wrap raw <table> tags in the ql-table-embed div so Quill can handle them.
 */
export const wrapTablesForQuill = (html: string): string => {
  if (!html || !html.includes("<table")) return html;
  if (html.includes("ql-table-embed")) return html;
  let cleaned = html;
  cleaned = cleaned.replace(/<(table|tr|td|th|thead|tbody|col|colgroup)([^>]*?)\s+(style|width|height)="[^"]*"/gi, "<$1$2");
  cleaned = cleaned.replace(/<(table|tr|td|th|thead|tbody|col|colgroup)([^>]*?)\s+(style|width|height)="[^"]*"/gi, "<$1$2");
  cleaned = cleaned.replace(/<(table|tr|td|th|thead|tbody|col|colgroup)([^>]*?)\s+(style|width|height)="[^"]*"/gi, "<$1$2");
  cleaned = cleaned.replace(/<colgroup[\s\S]*?<\/colgroup>/gi, "");
  return cleaned.replace(/(<table[\s\S]*?<\/table>)/gi, '<div class="ql-table-embed" contenteditable="false">$1</div>');
};

/**
 * Unwrap ql-table-embed back to raw <table> for clean storage.
 */
export const unwrapTablesForStorage = (html: string): string => {
  if (!html || !html.includes("ql-table-embed")) return html;
  return html.replace(/<div class="ql-table-embed"[^>]*>([\s\S]*?)<\/div>/gi, "$1");
};

// FORMATS WHITELIST (Penting agar Quill tidak menghapus tag/style kustom)
export const quillFormats = [
  "header", "font", "size",
  "bold", "italic", "underline", "strike", "blockquote",
  "script",
  "list", "bullet", "indent",
  "link", "image", "video", "formula",
  "color", "background",
  "align", "code-block",
  "line-height",
  "tableEmbed",
  "width", "height", "style", "alt", "class",
];

// FORMATS WHITELIST KHUSUS PILIHAN JAWABAN (Opsi A, B, C, D, E)
export const quillFormatsChoice = [
  "bold",
  "list",
  "formula",
  "image",
  "tableEmbed",
  "width", "height", "style", "alt", "class",
];

export { Quill };
export default Quill;
