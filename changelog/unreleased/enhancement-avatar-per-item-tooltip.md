Enhancement: Allow a per-item tooltip in OcAvatars

The tooltip summarising a group of avatars was always built from the display
names, so callers that wanted to show something more specific per entry, such
as an account name next to the display name, could not. Each avatar may now
carry its own tooltip text, falling back to the display name.

https://github.com/cernbox/web
