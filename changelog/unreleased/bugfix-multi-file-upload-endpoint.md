Bugfix: Build the upload endpoint per file when uploading several files

When more than one file was uploaded at once, each file's name was appended to
the endpoint built for the previous one, so the second and later uploads were
sent to a path containing every preceding file name. The per-file endpoint is
now derived from the folder endpoint each time.

https://github.com/cernbox/web
