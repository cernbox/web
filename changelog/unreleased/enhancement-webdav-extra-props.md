Enhancement: Expose the registered extra props on the WebDAV client

Callers could register additional WebDAV properties to be collected into
resource.extraProps, but had no way to read back which ones were registered,
so code that builds resources could not tell which extra props to expect. The
client now exposes them.

https://github.com/cernbox/web
