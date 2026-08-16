Bugfix: Redirect to the right external app under path-based routing

Opening a file in an external app without naming the app resolved the target
from a fileId query parameter, which only exists when id-based routing is
enabled. With path-based routing there is no such parameter, so the redirect
always failed with "No file was specified to open". The app is now resolved
from the file extension in the route path in that mode, and the redirect
targets a path rather than a named route so the file location is carried over.

https://github.com/cernbox/web
