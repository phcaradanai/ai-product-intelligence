import { createFileRoute } from "@tanstack/react-router";
import { getWorkspace } from "../server/functions.ts";
import { searchSchema } from "../search.ts";
import { Dashboard } from "../ui/Dashboard.tsx";

/** Product dashboard: filters, product cards, focus panel and decisions (blueprint §11.1 evidence + decision). */
export const Route = createFileRoute("/dashboard")({
  validateSearch: searchSchema,
  loaderDeps: ({ search: s }) => ({ clearance: s.clearance, scenario: s.scenario }),
  loader: ({ deps }) => getWorkspace({ data: { clearance: deps.clearance, scenario: deps.scenario } }),
  component: DashboardRoute,
});

function DashboardRoute() {
  return <Dashboard view={Route.useLoaderData()} search={Route.useSearch()} />;
}
