Change: Size the sidebar with flex sizing instead of a fixed width

The sidebar was pinned to a fixed 440px, so on narrow viewports it kept its
full width and pushed the file list out of view instead of giving way. It now
participates in the flex layout, treating 440px as a maximum rather than a
fixed size.

https://github.com/cernbox/web
