import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getWorkspace } from "../server/functions.ts";
import { Workspace } from "../ui/Workspace.tsx";

/** URL state: language, demo clearance (never defaults to full access), demo approval permission, selected SKU. */
const search = z.object({
  lang: z.enum(["th", "en"]).catch("th"),
  clearance: z.enum(["internal", "confidential"]).catch("internal"),
  approve: z.boolean().catch(false),
  sku: z.string().max(128).optional().catch(undefined),
});

export const Route = createFileRoute("/")({
  validateSearch: search,
  loaderDeps: ({ search: s }) => ({ clearance: s.clearance }),
  loader: ({ deps }) => getWorkspace({ data: { clearance: deps.clearance } }),
  component: WorkspaceRoute,
});

function WorkspaceRoute() {
  const view = Route.useLoaderData();
  const s = Route.useSearch();
  return <Workspace view={view} search={s} />;
}
