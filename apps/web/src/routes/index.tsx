import { createFileRoute } from "@tanstack/react-router";
import { getWorkspace } from "../server/functions.ts";
import { searchSchema } from "../search.ts";
import { Chat } from "../ui/Chat.tsx";

/** Chat & Advisor page: the conversation (blueprint §11.1 conversation workspace). */
export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search: s }) => ({ clearance: s.clearance, scenario: s.scenario }),
  loader: ({ deps }) => getWorkspace({ data: { clearance: deps.clearance, scenario: deps.scenario } }),
  component: ChatRoute,
});

function ChatRoute() {
  return <Chat view={Route.useLoaderData()} search={Route.useSearch()} />;
}
