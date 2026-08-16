Enhancement: Load spaces per drive type on demand

Every space type was fetched eagerly during startup, so accounts with many
projects or accepted shares waited on requests they might never need before
the first view rendered. Spaces are now loaded per drive type when a route
first needs them, concurrent callers share a single request, and the store
tracks which types have been initialised so that "not loaded yet" is no longer
indistinguishable from "none exist".

https://github.com/cernbox/web
