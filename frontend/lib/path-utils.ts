/**
 * Normalizes file paths to use forward slashes regardless of platform
 * This helps ensure consistent paths between Windows and Unix-like systems
 */
export function normalizePath(path: string): string {
  // Replace backslashes with forward slashes
  return path.replace(/\\/g, "/")
}

/**
 * Creates a URL-friendly path by ensuring it starts with a forward slash
 * and normalizing all path separators
 */
export function createUrlPath(path: string): string {
  const normalized = normalizePath(path)
  return normalized.startsWith("/") ? normalized : `/${normalized}`
}

/**
 * Joins path segments together with forward slashes
 * Works like path.join() but always uses forward slashes
 */
export function joinPaths(...paths: string[]): string {
  return normalizePath(paths.join("/").replace(/\/+/g, "/"))
}

/**
 * Gets the base URL for the application
 * Uses NEXT_PUBLIC_BASE_URL from environment variables if available
 * Falls back to http://localhost:3000 in development
 */
export function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin
  }

  return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
}

/**
 * Creates an absolute URL by combining the base URL with a path
 */
export function createAbsoluteUrl(path: string): string {
  return `${getBaseUrl()}${createUrlPath(path)}`
}
