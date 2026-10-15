Enhancement: Launch remote webapps via the served launcher

We've switched the "Open remotely" action to the ScienceMesh served launcher.
The action opens a new tab and submits the file id to
`/sciencemesh/webapp-launch` in a form POST. Reva exchanges the share secret
and answers with a page that posts the access token straight to the app, so
the app token never reaches the web client or a URL. This needs a Reva that
serves `/sciencemesh/webapp-launch`.

https://github.com/cernbox/web/pull/283
