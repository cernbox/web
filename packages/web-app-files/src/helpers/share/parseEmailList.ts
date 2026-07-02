// matches bare "user@example.com" as well as the address portion of "Name <user@example.com>",
// regardless of how entries are separated (comma, semicolon, newline, whitespace, ...)
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

/**
 * Extracts unique email addresses out of a pasted block of text, e.g.
 * "Jane Doe <jane@example.com>; John Doe <john@example.com>".
 */
export const parseEmailList = (text: string): string[] => {
  const matches = text.match(EMAIL_PATTERN) ?? []
  const seen = new Set<string>()
  const emails: string[] = []

  for (const match of matches) {
    const key = match.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      emails.push(match)
    }
  }

  return emails
}

/**
 * Whether the given search query should be treated as a pasted list of email addresses
 * rather than a single, freeform search term the user is typing.
 */
export const isEmailListPaste = (query: string, emails: string[]): boolean => {
  if (emails.length === 0) {
    return false
  }

  return emails.length > 1 || emails[0].toLowerCase() !== query.trim().toLowerCase()
}
