export type FileKind =
  | "folder"
  | "video"
  | "image"
  | "doc"
  | "sheet"
  | "slide"
  | "pdf"
  | "audio"
  | "archive"
  | "code"
  | "other";

const VIDEO = ["mp4", "mkv", "mov", "avi", "webm", "m4v", "flv", "wmv"];
const IMAGE = ["jpg", "jpeg", "png", "gif", "webp", "heic", "bmp", "svg", "avif"];
const DOC = ["doc", "docx", "rtf", "txt", "md", "odt"];
const SHEET = ["xls", "xlsx", "csv", "numbers", "ods"];
const SLIDE = ["ppt", "pptx", "key", "odp"];
const AUDIO = ["mp3", "flac", "wav", "aac", "m4a", "ogg", "opus"];
const ARCHIVE = ["zip", "rar", "7z", "tar", "gz", "xz", "bz2", "iso"];
const CODE = ["js", "ts", "tsx", "jsx", "rs", "go", "py", "json", "toml", "yaml", "yml", "sh", "css", "html", "xml"];

export function extensionOf(name: string): string {
  const index = name.lastIndexOf(".");
  return index > 0 ? name.slice(index + 1).toLowerCase() : "";
}

export function kindOf(name: string, isDir = false): FileKind {
  if (isDir) return "folder";
  const ext = extensionOf(name);
  if (VIDEO.includes(ext)) return "video";
  if (IMAGE.includes(ext)) return "image";
  if (SHEET.includes(ext)) return "sheet";
  if (SLIDE.includes(ext)) return "slide";
  if (ext === "pdf") return "pdf";
  if (AUDIO.includes(ext)) return "audio";
  if (ARCHIVE.includes(ext)) return "archive";
  if (CODE.includes(ext)) return "code";
  if (DOC.includes(ext)) return "doc";
  return "other";
}

export const KIND_LABEL: Record<FileKind, string> = {
  folder: "文件夹",
  video: "视频",
  image: "图片",
  doc: "文档",
  sheet: "表格",
  slide: "演示文稿",
  pdf: "PDF",
  audio: "音频",
  archive: "压缩包",
  code: "代码",
  other: "文件",
};
