Bugfix: Request the file id when checking for duplicate names in Save As

Save As listed the destination folder asking only for names, so the resources
it produced carried no file id and any downstream handling keyed on the id
worked against undefined. The listing now requests the id alongside the name.

https://github.com/cernbox/web
