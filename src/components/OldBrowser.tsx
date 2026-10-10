import { Button, Stack, Typography } from "@mui/material";
import { defineMessages, useMessages } from "../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    title: "Este navegador es demasiado antiguo",
    needs:
      "La app necesita Safari 16.2 o posterior, o un Chrome, Firefox o Edge reciente. " +
      "Con este navegador la partida se cortaría a medias.",
    iPad:
      "En un iPad o un iPhone: actualiza el sistema en Ajustes › General › Actualización de software. " +
      "Todos los navegadores del iPad usan el motor de Safari, así que instalar Chrome no sirve.",
    mac:
      "En un Mac: actualiza en Ajustes del Sistema › General › Actualización de software " +
      "(en un macOS antiguo, Preferencias del Sistema › Actualización de software). " +
      "Si el Mac ya no recibe actualizaciones de Safari, instala Firefox.",
    tryAnyway: "Probar de todos modos",
  },
  en: {
    title: "This browser is too old",
    needs:
      "The app needs Safari 16.2 or later, or a recent Chrome, Firefox or Edge. " +
      "In this browser the game would break off partway.",
    iPad:
      "On an iPad or iPhone: update the system in Settings › General › Software Update. " +
      "Every browser on an iPad uses Safari's engine, so installing Chrome won't help.",
    mac:
      "On a Mac: update in System Settings › General › Software Update " +
      "(on an older macOS, System Preferences › Software Update). " +
      "If the Mac no longer gets Safari updates, install Firefox.",
    tryAnyway: "Try anyway",
  },
});

/** Shown instead of the menu on a browser the app can't run on (browserSupport.ts): what to do about it */
function OldBrowser({ onTryAnyway }: { onTryAnyway: () => void }) {
  const t = useMessages(TEXT);
  return (
    <Stack component="main" spacing={2} sx={{ maxWidth: 560, mx: "auto", px: 2, py: 4 }}>
      <Typography variant="h4" component="h1">
        {t.title}
      </Typography>
      <Typography>{t.needs}</Typography>
      <Typography>{t.iPad}</Typography>
      <Typography>{t.mac}</Typography>
      <Button variant="text" onClick={onTryAnyway} sx={{ alignSelf: "flex-start" }}>
        {t.tryAnyway}
      </Button>
    </Stack>
  );
}

export default OldBrowser;
