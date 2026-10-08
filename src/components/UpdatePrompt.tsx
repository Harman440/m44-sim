import { Button, Snackbar } from "@mui/material";
import { useRegisterSW } from "virtual:pwa-register/react";
import { defineMessages, useMessages } from "../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    offlineReady: "Lista para jugar sin conexión",
    needRefresh: "Nueva versión disponible. La partida en curso se conserva.",
    later: "Más tarde",
    update: "Actualizar",
  },
  en: {
    offlineReady: "Ready to play offline",
    needRefresh: "New version available. The game in progress is kept.",
    later: "Later",
    update: "Update",
  },
});

/**
 * Service worker messages: once the app is cached it works offline, and when
 * a new version is deployed the player chooses when to reload. The game in
 * progress is saved, so updating resumes it.
 */
function UpdatePrompt() {
  const t = useMessages(TEXT);
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  return (
    <>
      <Snackbar
        open={offlineReady}
        autoHideDuration={4000}
        onClose={() => setOfflineReady(false)}
        message={t.offlineReady}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
      <Snackbar
        open={needRefresh}
        message={t.needRefresh}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        action={
          <>
            <Button variant="text" onClick={() => setNeedRefresh(false)}>
              {t.later}
            </Button>
            <Button onClick={() => updateServiceWorker(true)}>{t.update}</Button>
          </>
        }
      />
    </>
  );
}

export default UpdatePrompt;
