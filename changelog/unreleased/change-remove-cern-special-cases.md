Change: Remove the CERN special cases from the generic code base

Web carried a handful of branches that only ever applied to the CERN
deployment, and which CERNBox itself no longer relies on. Opening a file
link, a context menu action or an editor switched between a new tab and the
same tab depending on the cernFeatures option, the copy action refused to
operate above the home or project root when runningOnEos was set, and the
invite panel merged an extra help section describing an account-prefix
search syntax. All of them have been removed, so the behaviour is now the
same for every deployment.

The grouping settings plumbing has been removed as well. It was threaded
from a CERN-only composable through the shares views, the shares section and
the resource table, but no table component ever declared the prop, so the
whole chain was inert.

https://github.com/cernbox/web
