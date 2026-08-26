import type { ReactNode } from "react"

// Item banks and the tutor both write light markdown. Nothing rendered it, so
// students read `*(Apply it.)*` and `**proximity**` with the asterisks intact —
// in both check forms and in every tutor reply.
//
// Deliberately tiny: **strong** and *em* only, no links, no HTML, no library.
// The input is our own item bank and our own model output, and the output is
// React nodes rather than dangerouslySetInnerHTML, so there is nothing to inject.
// If a stem ever needs more than emphasis, that is a reason to reconsider the
// item, not to grow this.

const TOKEN = /(\*\*[^*]+\*\*|\*[^*\n]+\*)/g

export function inlineMarkdown(text: string): ReactNode[] {
  if (!text) return []
  return text.split(TOKEN).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    return part
  })
}
