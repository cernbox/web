Enhancement: Gate remote webapp actions by protocol

We've limited the "Open remotely" action to received shares that carry a
webapp name, instead of every OCM storage resource. The action posts the file
id to ScienceMesh open-in-app and submits the returned access token to the
app in a form POST, never in the URL.

https://github.com/cernbox/web/pull/276
