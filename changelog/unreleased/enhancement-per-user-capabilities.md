Enhancement: Read per-user capabilities from OCS

Capabilities were only read instance-wide, so behaviour that a backend enables
for some accounts and not others could not be reflected in the UI. The client
can now fetch the capabilities reported for a specific user from the OCS v1
user endpoint, and they are merged into the capability store alongside the
instance-wide ones.

https://github.com/cernbox/web
