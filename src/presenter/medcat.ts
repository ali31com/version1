import { ANNOTATION_CATEGORIES } from "../../convex/lib/contracts";

type Category = (typeof ANNOTATION_CATEGORIES)[number];

// One tint per MedCAT category, shared by the note spans and the legend.
export const CATEGORY_TINT: Record<Category, string> = {
  disorder: "bg-rose-200",
  procedure: "bg-sky-200",
  "body structure": "bg-violet-200",
  finding: "bg-amber-200",
  substance: "bg-emerald-200",
  device: "bg-lime-200",
};
