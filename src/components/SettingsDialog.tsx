import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Switch,
  Typography,
} from "@mui/material";
import { LOOKS, LOOK_IDS, Look } from "../looks/looks";
import { useSettings } from "../settings";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

/** A small painted sample of a look: its panel, ink, button and stamp colours in its fonts */
function LookSample({ look }: { look: Look }) {
  const { colors, fonts, radius, border } = look;
  return (
    <Box
      aria-hidden
      sx={{
        width: "100%",
        p: 1.5,
        bgcolor: colors.bg,
        backgroundImage: `url(${look.texture})`,
        backgroundSize: "256px",
        backgroundBlendMode: look.textureBlend,
        borderRadius: `${radius}px`,
        textAlign: "left",
      }}
    >
      <Box
        sx={{
          bgcolor: colors.paper,
          color: colors.ink,
          border: `${border}px solid ${colors.border}`,
          borderRadius: `${radius}px`,
          p: 1.25,
          display: "flex",
          flexDirection: "column",
          gap: 0.75,
        }}
      >
        <Box sx={{ fontFamily: fonts.display, fontSize: 18, lineHeight: 1.1 }}>ASALTO GENERAL</Box>
        <Box sx={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted }}>Da órdenes a 6 unidades.</Box>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Box
            sx={{
              bgcolor: colors.primary,
              color: colors.onPrimary,
              fontFamily: fonts.display,
              fontSize: 13,
              px: 1.25,
              py: 0.5,
              borderRadius: `${Math.min(radius, 8)}px`,
            }}
          >
            DISPARAR
          </Box>
          <Box
            sx={{
              border: `2px solid ${colors.accent}`,
              color: colors.accent,
              fontFamily: fonts.display,
              fontSize: 12,
              px: 0.75,
              transform: "rotate(-6deg)",
            }}
          >
            DISPARÓ
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

/** Per-device settings: the visual look (applied straight away) and sound */
function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { settings, updateSettings } = useSettings();

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Ajustes</DialogTitle>
      <DialogContent>
        <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
          Estilo
        </Typography>
        <Box
          role="radiogroup"
          aria-label="Estilo"
          sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" } }}
        >
          {LOOK_IDS.map((id) => {
            const look = LOOKS[id];
            const selected = settings.look === id;
            return (
              <ButtonBase
                key={id}
                role="radio"
                aria-checked={selected}
                onClick={() => updateSettings({ look: id })}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  gap: 1,
                  p: 1,
                  borderRadius: 1,
                  border: "3px solid",
                  borderColor: selected ? "primary.main" : "transparent",
                  textAlign: "left",
                }}
              >
                <LookSample look={look} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {look.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {look.description}
                </Typography>
              </ButtonBase>
            );
          })}
        </Box>

        <Typography variant="h6" component="h3" sx={{ mt: 3, mb: 1 }}>
          Sonido
        </Typography>
        <FormControlLabel
          control={
            <Switch checked={settings.sound} onChange={(e) => updateSettings({ sound: e.target.checked })} />
          }
          label="Efectos de sonido (dados, cartas, sellos)"
          sx={{ minHeight: 48 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Listo</Button>
      </DialogActions>
    </Dialog>
  );
}

export default SettingsDialog;
