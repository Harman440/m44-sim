import { Button, Snackbar } from "@mui/material";
import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * Service worker messages: once the app is cached it works offline, and when
 * a new version is deployed the player chooses when to reload. The game in
 * progress is saved, so updating resumes it.
 */
function UpdatePrompt() {
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
        message="Lista para jugar sin conexión"
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
      <Snackbar
        open={needRefresh}
        message="Nueva versión disponible. La partida en curso se conserva."
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        action={
          <>
            <Button variant="text" onClick={() => setNeedRefresh(false)}>
              Más tarde
            </Button>
            <Button onClick={() => updateServiceWorker(true)}>Actualizar</Button>
          </>
        }
      />
    </>
  );
}

export default UpdatePrompt;
