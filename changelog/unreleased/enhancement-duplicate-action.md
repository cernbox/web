Enhancement: Add a duplicate action for files and folders

Duplicating a resource meant copying it and pasting it back into the same
folder by hand. A duplicate action has been added that reuses the existing
transfer machinery, resolving the copy's name against the entries already in
the folder.

Pasting has also been tightened: a paste that would place a folder inside its
own subtree is now refused rather than attempted, and cutting and pasting
within the same folder is treated as a no-op instead of an error.

https://github.com/cernbox/web
