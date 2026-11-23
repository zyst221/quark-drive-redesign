import {
  Archive,
  File,
  FileAudio,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder,
  Presentation,
} from "lucide-react";
import { cn } from "../lib/utils";
import { kindOf, type FileKind } from "../lib/file-types";

const ICONS = {
  folder: Folder,
  video: FileVideo,
  image: FileImage,
  doc: FileText,
  sheet: FileSpreadsheet,
  slide: Presentation,
  pdf: FileText,
  audio: FileAudio,
  archive: Archive,
  code: FileCode2,
  other: File,
} as const;

export function FileTile({
  name,
  isDir,
  kind,
  size = 18,
  className,
}: {
  name?: string;
  isDir?: boolean;
  kind?: FileKind;
  size?: number;
  className?: string;
}) {
  const resolved = kind ?? kindOf(name ?? "", isDir);
  const Icon = ICONS[resolved];
  return (
    <span className={cn("qd-tile", `t-${resolved}`, className)}>
      <Icon size={size} strokeWidth={1.9} />
    </span>
  );
}
