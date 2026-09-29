# Local interfaces

No backend or external API. `window.foliageDiagnostics()` is a read-only state/counter snapshot for validation.

Preview query: `?preview=1`. Parent messages `{type:'wonderworks:play'}` and `{type:'wonderworks:pause'}` require matching origin and `event.source === parent`.

Google Fonts is a typography dependency; serif/sans-serif fallbacks keep the UI usable offline.
