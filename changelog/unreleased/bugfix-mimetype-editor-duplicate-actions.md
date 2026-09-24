Bugfix: Offer each app once in the file actions

An app whose registrations overlapped on the same file was offered once per
matching registration: an app registering both the `txt` extension and the
`text` mimetype showed up twice for `notes.txt`, and one registering both
`text/plain` and `text` twice for any plain-text file. Each app is now offered
once, through its most specific match - file extension first, then exact
mimetype, then mimetype group - so the entry that may carry its own label is
the one shown.

https://github.com/cernbox/web
