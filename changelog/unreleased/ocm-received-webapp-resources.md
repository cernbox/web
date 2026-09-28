Enhancement: Carry received webapp name in resources

We've added `ocmWebApp.appName` to received OCM share resources, read from
`remoteItem["@ocm.webApp"]` on sharedWithMe. An empty name is kept, and a
missing or malformed descriptor leaves the property off.

https://github.com/cernbox/web/pull/274
