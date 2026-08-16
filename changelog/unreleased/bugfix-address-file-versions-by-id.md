Bugfix: Address file versions by the resource id

Reading and restoring a file version addressed the version through the id of
the parent folder, which is only correct while the resource sits directly in
the folder the caller happened to have loaded. Versions of a shared file, or
of a file reached through a listing that does not carry its parent, resolved
to the wrong location or failed outright. Both paths now use the resource's
own id, and reading file contents accepts an explicit version.

https://github.com/cernbox/web
