/**
 * Checks whether `path` is `prefix` itself or lies below it, comparing whole `/`-separated
 * segments. Prevents string-prefix false positives like `eos` matching `eos-archive/x`
 * or `eos/project/c/cern` matching `eos/project/c/cernbox/x`.
 *
 * Both arguments must use the same leading-slash convention.
 */
export const isSegmentPrefix = (path: string, prefix: string): boolean => {
  if (!path || !prefix) {
    return false
  }

  const pathSegments = path.split('/')
  const prefixSegments = prefix.split('/')

  if (pathSegments.length < prefixSegments.length) {
    return false
  }

  return prefixSegments.every((segment, i) => segment === pathSegments[i])
}
