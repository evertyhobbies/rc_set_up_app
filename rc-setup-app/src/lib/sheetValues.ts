/** "fieldId|corner" → value; the same setup_values the summary view uses */
export type SheetValues = Record<string, string>;
export const valueKey = (fieldId: string, corner: string | null) => `${fieldId}|${corner ?? ""}`;
