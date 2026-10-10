import type { ReactNode } from "react";
import { HeadContent, Outlet, Scripts, createRootRoute, useRouterState } from "@tanstack/react-router";
import "@fontsource/anuphan/400.css";
import "@fontsource/anuphan/500.css";
import "@fontsource/anuphan/600.css";
import "@fontsource/anuphan/700.css";
import "@fontsource/sarabun/400.css";
import "@fontsource/sarabun/500.css";
import "@fontsource/sarabun/600.css";
import "../styles.css";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Advisor Workspace · AI Product Intelligence Advisor" },
      { name: "color-scheme", content: "light" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: () => <p style={{ padding: 32 }}>404 · Not found</p>,
});

function RootComponent() {
  const lang = useRouterState({ select: (s) => (s.location.search as { lang?: string }).lang === "en" ? "en" : "th" });
  return (
    <RootDocument lang={lang}>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children, lang }: Readonly<{ children: ReactNode; lang: string }>) {
  return (
    <html lang={lang}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
