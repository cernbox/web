Enhancement: Re-authenticate in place when the session expires

An expired session redirected to the login page, discarding whatever the user
had open. A modal is now shown instead, offering to reconnect through a popup
that restores the session in the same tab, and navigation is blocked while it
is up so the app cannot act on requests that are about to fail. Other tabs
pick the restored session up through a storage event.

Where cross-origin isolation severs the popup's reference to its opener, the
popup reports completion over a BroadcastChannel instead, with a short grace
period so a successful login is not mistaken for a blocked popup.

The access denied page now also distinguishes a failed sign-in from simply not
being signed in, and its logo links home.

https://github.com/cernbox/web
