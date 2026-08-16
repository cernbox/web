Bugfix: Make the graph request options optional

Several graph permission calls declared their request options parameter as
required while every existing caller omitted it, which only worked because the
parameter was untyped at the call site. The options now default to an empty
object, so callers can keep leaving them out and the ones that need to pass
headers can do so.

https://github.com/cernbox/web
