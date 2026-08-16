Enhancement: Support an inline attach target and single file mode in embed mode

Embed mode could only be driven through its own action bar. It now supports an
inline attach target for hosts that manage the selection themselves: the
action bar is hidden, folders cannot be selected, and the host can ask for the
current selection over postMessage. Single file embeds additionally suppress
the context menu, the rename action and the shared-with column, since none of
them apply to a single embedded file. The postMessage origin can be supplied
through a query parameter, and a picked file is reported with a signed
download URL when the backend supports URL signing.

https://github.com/cernbox/web
