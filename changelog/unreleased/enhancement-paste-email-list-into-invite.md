Enhancement: Allow pasting a list of email addresses into the invite field

Pasting a block of email addresses into the invite search treated the whole
paste as one literal search term, which matched nothing. A paste that looks
like a list of addresses - comma, semicolon or newline separated, with or
without display names around them - is now recognised, each address is looked
up, and the matching users are selected. Addresses that match no user are
reported.

https://github.com/cernbox/web
