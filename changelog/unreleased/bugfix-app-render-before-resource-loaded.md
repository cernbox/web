Bugfix: Do not render an app before its file context exists

Apps that load their own resource start with the loading flag already false,
so the app slot rendered before the drive resolver had produced a file
context. Since resolving a space is asynchronous, the app mounted against an
empty context and rendered blank or threw. The wrapper now also waits for the
context itself, and the document title tolerates it being absent.

https://github.com/cernbox/web
