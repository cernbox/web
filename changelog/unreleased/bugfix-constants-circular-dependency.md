Bugfix: Avoid a circular workspace dependency for shared constants

Two file-extension constants were defined in web-pkg and imported by
web-client, which already depends on web-pkg, closing a dependency cycle
between the two packages. They now live in web-client, where they are used,
and web-pkg re-exports them so existing importers are unaffected.

https://github.com/cernbox/web
