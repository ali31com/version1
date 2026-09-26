import { useSyncExternalStore } from "react";

// Minimal pathname router: the demo has three routes and no nesting.
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}

export function navigate(path: string, options: { replace?: boolean } = {}) {
  if (options.replace) window.history.replaceState(null, "", path);
  else window.history.pushState(null, "", path);
  listeners.forEach((l) => l());
}

export function useLocation(): { pathname: string; search: string } {
  const href = useSyncExternalStore(subscribe, () => window.location.pathname + window.location.search);
  const url = new URL(href, window.location.origin);
  return { pathname: url.pathname, search: url.search };
}

export type Route =
  | { name: "presenter" }
  | { name: "join"; code: string }
  | { name: "participant"; token: string }
  | { name: "notFound" };

export function matchRoute(pathname: string): Route {
  const join = pathname.match(/^\/join\/([a-z0-9]+)\/?$/i);
  if (join) return { name: "join", code: join[1].toLowerCase() };
  const personal = pathname.match(/^\/p\/([a-f0-9]+)\/?$/i);
  if (personal) return { name: "participant", token: personal[1] };
  if (pathname === "/" || pathname === "/presenter") return { name: "presenter" };
  return { name: "notFound" };
}
