Bugfix: Register a public link space before redirecting

Resolving a public link stored the space in the spaces store only after the
redirect handling, so a link carrying a redirect target returned early and
left the space unregistered. Resolving the same space again later then failed
with a "resource not found" error. The space is now stored before any early
return.

https://github.com/cernbox/web
