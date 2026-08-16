Enhancement: Add a suffix slot to OcTextInput

Inputs that need a trailing affix, such as a fixed domain next to a name or a
unit next to a number, had to be composed around the component with their own
markup and alignment. OcTextInput now renders a suffix slot inside the input
wrapper so the affix lines up with the field itself.

https://github.com/cernbox/web
