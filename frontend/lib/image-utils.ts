/**
 * Creates a placeholder image URL with the specified dimensions
 * This is useful for development and testing when actual images aren't available
 */
export function getPlaceholderImage(width: number, height: number, text?: string): string {
  // Use the Next.js built-in placeholder service
  const baseUrl = `/placeholder.svg`
  const params = new URLSearchParams()

  params.append("width", width.toString())
  params.append("height", height.toString())

  if (text) {
    params.append("text", text)
  }

  return `${baseUrl}?${params.toString()}`
}

/**
 * Safely gets an image URL, with a fallback to a placeholder if the original URL is invalid
 */
export function getSafeImageUrl(url: string | undefined | null, width = 300, height = 300, alt = "Image"): string {
  if (!url || url.trim() === "") {
    return getPlaceholderImage(width, height, alt)
  }

  // If it's already a placeholder or an absolute URL, return it as is
  if (url.startsWith("/placeholder") || url.startsWith("http")) {
    return url
  }

  // Ensure the URL starts with a slash for local images
  return url.startsWith("/") ? url : `/${url}`
}
