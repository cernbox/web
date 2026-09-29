Enhancement: Propagate webapp name to share children

We've set the received webapp name on the share root, the current folder, and
its children when browsing a received OCM share, including nested folders. A
missing, duplicate, or failed lookup clears the name, and the folder listing
still loads.

https://github.com/cernbox/web/pull/275
