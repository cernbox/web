Bugfix: Fall back to a resource's storage id when matching its space

Space matching read only the resource's spaceId, so resources that carry a
storageId instead - anything built from a listing that does not report a space
id - matched no space at all and resolved against whichever space happened to
be open. The storage id is now used as a fallback.

https://github.com/cernbox/web
