import { isSegmentPrefix } from '../../../src/utils'

describe('isSegmentPrefix', () => {
  it.each([
    // exact match
    { path: 'eos', prefix: 'eos', expected: true },
    { path: 'eos/project/c/cernbox', prefix: 'eos/project/c/cernbox', expected: true },
    // descendant
    { path: 'eos/project/c/cernbox/x', prefix: 'eos', expected: true },
    { path: '/files/jdoe/eos/a/b', prefix: '/files/jdoe/eos', expected: true },
    // string prefix but not a segment prefix
    { path: 'eos-archive/x', prefix: 'eos', expected: false },
    { path: 'eos/project/c/cernbox/x', prefix: 'eos/project/c/cern', expected: false },
    { path: '/files/jdoe/eos-archive/x', prefix: '/files/jdoe/eos', expected: false },
    // prefix is deeper than path
    { path: 'eos', prefix: 'eos/project', expected: false },
    // unrelated
    { path: 'spaces/1/foo', prefix: 'eos', expected: false },
    // empty / missing
    { path: '', prefix: 'eos', expected: false },
    { path: 'eos', prefix: '', expected: false },
    { path: undefined as unknown as string, prefix: 'eos', expected: false },
    { path: 'eos', prefix: undefined as unknown as string, expected: false }
  ])('returns $expected for path "$path" and prefix "$prefix"', ({ path, prefix, expected }) => {
    expect(isSegmentPrefix(path, prefix)).toBe(expected)
  })
})
