Change: Split the overloaded isRunningOnEos option

The isRunningOnEos option gated two unrelated things: whether the OIDC token
is exchanged for a backend token during sign-in, and whether the "Notify via
mail" entry is offered on a collaborator share. It has been renamed to
useRevaToken, which is what the sign-in path actually asks about, and the
share menu entry now reads the existing runningOnEos deployment option
instead.

https://github.com/cernbox/web
