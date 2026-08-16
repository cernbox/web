Enhancement: Make the file picker modal reusable

The file picker modal was written for a single caller: it took an application
and opened the picked file in that app's editor itself. Anything else needing
a file picker had to duplicate it. It now reports the picked resource through
a callback and accepts an optional list of allowed file types, so callers
decide what happens with the selection.

https://github.com/cernbox/web
