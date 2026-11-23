/** Kinds of reference files kept per model/year (shared by server and client code). */
export const FILE_KINDS: Record<string, string> = {
  manual: "Manual",
  parts_list: "Parts list",
  exploded_view: "Exploded view",
  setup_sheet: "Setup sheet (PDF copy)",
  other: "Other",
};
