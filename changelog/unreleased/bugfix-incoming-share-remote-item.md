Bugfix: Take the path and private link of an incoming share from its remote item

An incoming share was always built with the path "/" and a private link
synthesised from the item id. Backends that report the share's real location
and a canonical web URL on the remote item had both discarded, so the share
resolved to the wrong path and its private link pointed at a generated URL
rather than the one the backend published. Both are now taken from the remote
item when present, falling back to the previous values otherwise.

https://github.com/cernbox/web
