/**
 * Explicit route context types for dynamic API routes.
 * Used instead of the auto-generated RouteContext global (which requires a build).
 */

export type RouteCtx<T extends Record<string, string>> = {
  params: Promise<T>;
};
