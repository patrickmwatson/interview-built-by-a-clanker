import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter, createHashHistory } from "@tanstack/react-router";
import { AuthProvider } from "~/lib/auth";
import { queryClient } from "~/lib/queryClient";
import { routeTree } from "./routeTree.gen";
import "./app.css";

const router = createRouter({
  routeTree,
  // Hosted build (VITE_HASH_ROUTER=1) lives under a static subpath, so use hash URLs.
  history: import.meta.env.VITE_HASH_ROUTER ? createHashHistory() : undefined,
  context: { queryClient },
  defaultPreloadStaleTime: 0,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
