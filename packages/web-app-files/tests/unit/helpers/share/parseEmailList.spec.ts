import { isEmailListPaste, parseEmailList } from '../../../../src/helpers/share/parseEmailList'

describe('parseEmailList', () => {
  it('returns an empty array for text without an email', () => {
    expect(parseEmailList('just some text')).toEqual([])
  })

  it('extracts a single bare email address', () => {
    expect(parseEmailList('jane@example.com')).toEqual(['jane@example.com'])
  })

  it('extracts the address out of a "Name <email>" entry', () => {
    expect(parseEmailList('Jane Doe <jane@example.com>')).toEqual(['jane@example.com'])
  })

  it.each([
    ['comma separated', 'jane@example.com, john@example.com'],
    ['semicolon separated', 'jane@example.com; john@example.com'],
    ['newline separated', 'jane@example.com\njohn@example.com'],
    [
      'name + email, semicolon separated',
      'Jane Doe <jane@example.com>; John Doe <john@example.com>'
    ],
    ['mixed separators', 'Jane Doe <jane@example.com>,john@example.com ; jane2@example.com']
  ])('parses a list of emails (%s)', (_, text) => {
    expect(parseEmailList(text)).toEqual(
      expect.arrayContaining(['jane@example.com', 'john@example.com'])
    )
  })

  it('deduplicates case-insensitively while keeping the first occurrence', () => {
    expect(parseEmailList('Jane@example.com, jane@example.com')).toEqual(['Jane@example.com'])
  })
})

describe('isEmailListPaste', () => {
  it('is false when no emails were found', () => {
    expect(isEmailListPaste('some text', [])).toBe(false)
  })

  it('is false for a single, bare email that was typed as-is', () => {
    expect(isEmailListPaste('jane@example.com', ['jane@example.com'])).toBe(false)
  })

  it('is true for a single "Name <email>" entry', () => {
    expect(isEmailListPaste('Jane Doe <jane@example.com>', ['jane@example.com'])).toBe(true)
  })

  it('is true when multiple emails were found', () => {
    expect(
      isEmailListPaste('jane@example.com, john@example.com', [
        'jane@example.com',
        'john@example.com'
      ])
    ).toBe(true)
  })
})
