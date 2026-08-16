Bugfix: Derive resource paths from the WebDAV base path

Resource paths were reconstructed by dropping a fixed number of leading
segments from the WebDAV href, which only holds while the WebDAV base has the
depth that heuristic assumes. Deployments serving WebDAV from a different base,
such as a per-user files endpoint, produced truncated or over-long paths.
Listings now pass the base path they were issued against, and the path is
derived by removing it. The old heuristic is kept as a fallback for callers
that cannot supply a base.

https://github.com/cernbox/web
