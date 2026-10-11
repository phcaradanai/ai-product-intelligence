import type { ReactNode } from "react";
import { HeadContent, Outlet, Scripts, createRootRoute, useRouterState } from "@tanstack/react-router";
import "@fontsource-variable/noto-sans-thai";
import "../styles.css";

/** Applies the saved theme before first paint (no flash). Key matches THEME_KEY in ui/Shell.tsx. */
const THEME_SCRIPT = `try{var t=localStorage.getItem("advisor-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Advisor Workspace · AI Product Intelligence Advisor" },
      { name: "color-scheme", content: "light dark" },
    ],
    scripts: [{ children: THEME_SCRIPT }],
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
    // The pre-paint script may set data-theme before hydration, hence suppressHydrationWarning.
    <html lang={lang} suppressHydrationWarning>
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
