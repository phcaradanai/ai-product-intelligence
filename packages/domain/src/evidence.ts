import type { SourceReference } from "./models.ts";

/**
 * Whether evidence was *published* inside [from, to). Returns null when the publication time is
 * unknown: a recent fetch of old content must never count as a new event (STEP 0 §15.2).
 */
export function publishedWithin(ref: SourceReference, from: string, to: string): boolean | null {
  if (ref.publishedAt === null) return null;
  const t = Date.parse(ref.publishedAt);
  return t >= Date.parse(from) && t < Date.parse(to);
}
