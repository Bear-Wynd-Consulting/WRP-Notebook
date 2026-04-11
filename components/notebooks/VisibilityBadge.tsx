import type { Visibility } from "@/app/generated/prisma/client";

const LABELS: Record<Visibility, string> = {
  PRIVATE: "Private",
  INTERNAL: "Internal",
  PUBLIC: "Public",
};

const COLORS: Record<Visibility, { bg: string; text: string }> = {
  PRIVATE: { bg: "#E3D3F5", text: "#4F2683" },
  INTERNAL: { bg: "#2C1650", text: "#E3D3F5" },
  PUBLIC: { bg: "#2E7D32", text: "#ffffff" },
};

interface Props {
  visibility: Visibility;
}

export function VisibilityBadge({ visibility }: Props) {
  const colors = COLORS[visibility];
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-medium shrink-0"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {LABELS[visibility]}
    </span>
  );
}
