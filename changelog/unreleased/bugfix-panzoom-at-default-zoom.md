Bugfix: Do not keep panzoom active at the default zoom level

The image preview kept its pan and zoom handler attached even when the image
was shown at its default zoom, so a drag could shift an image that had nothing
to pan, and the handler stayed registered across image changes. Panzoom is now
torn down when it is not needed and re-created when it is.

https://github.com/cernbox/web
