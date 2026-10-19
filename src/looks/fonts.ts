// looks/fonts.ts
// Bundled fonts (@fontsource), so they work offline at the table. The browser
// only downloads the files of the fonts the current look uses. Only the latin subset:
// it has every letter Spanish and English need, and the service worker keeps every
// file it's given, so the latin-ext ones would only take up room.
import "@fontsource/stardos-stencil/latin-400.css";
import "@fontsource/stardos-stencil/latin-700.css";
import "@fontsource/special-elite/latin-400.css";
import "@fontsource/black-ops-one/latin-400.css";
import "@fontsource/barlow-condensed/latin-500.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "@fontsource/allerta-stencil/latin-400.css";
import "@fontsource/ibm-plex-sans-condensed/latin-400.css";
import "@fontsource/ibm-plex-sans-condensed/latin-600.css";
