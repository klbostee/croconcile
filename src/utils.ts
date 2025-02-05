export function normalizeStructuredReference(
  structuredReference: string
): string {
  return structuredReference.replace(/\//g, "").replace(/\+/g, "");
}
