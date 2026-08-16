Enhancement: Enforce an expiration policy on read-write folder links

A public link that grants write access to a folder is the most exposed kind of
share, but nothing bounded how long it stayed valid. Such links now honour the
default and maximum expiration reported by the files_sharing public expire_date
capabilities: the default is applied when the link is created, the datepicker
refuses a date beyond the maximum, and removing the expiration is not offered.

Expired links are marked as such and can no longer be copied, so an expired
link cannot be handed out by mistake. Deployments can configure a short
explanation, shown once when such a link is created, through the
alertRwFolders option.

https://github.com/cernbox/web
