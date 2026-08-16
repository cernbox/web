Enhancement: Build for Firefox extended support releases

Firefox ESR fell outside the configured browser targets, so the emitted bundle
could contain syntax those releases do not implement. It has been added to the
browserslist targets.

https://github.com/cernbox/web
