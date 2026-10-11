import { z } from "zod";

/**
 * URL state shared by the chat and dashboard pages: language, demo clearance (never defaults to
 * full access), demo approval permission, demo data set, selected SKU.
 */
export const searchSchema = z.object({
  lang: z.enum(["th", "en"]).catch("th"),
  clearance: z.enum(["internal", "confidential"]).catch("internal"),
  approve: z.boolean().catch(false),
  scenario: z.enum(["sample", "edge"]).catch("sample"),
  sku: z.string().max(128).optional().catch(undefined),
});

export type Search = z.infer<typeof searchSchema>;
