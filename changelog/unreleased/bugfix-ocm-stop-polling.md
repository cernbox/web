Bugfix: Stop polling for accepted federated connections

The federated connections view re-fetched the accepted user list every ten
seconds for as long as it was open, purely to highlight entries that had just
appeared. The highlight is computed once when the view loads, so the interval
produced a request every ten seconds without changing anything on screen. It
has been removed.

https://github.com/cernbox/web
