import type { ReactNode } from "react";
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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { LOOKS, LOOK_IDS, Look } from "../looks/looks";
import { useSettings } from "../settings";
import { LANGS, LANG_NAMES, isLang } from "../i18n/lang";
import { defineMessages, useMessages, useTr } from "../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    title: "Ajustes",
    language: "Idioma",
    look: "Estilo",
    sampleTitle: "ASALTO GENERAL",
    sampleText: "Da órdenes a 6 unidades.",
    sampleButton: "DISPARAR",
    sampleStamp: "DISPARÓ",
    sound: "Sonido",
    soundEffects: "Efectos de sonido (dados, cartas, sellos)",
    done: "Listo",
  },
  en: {
    title: "Settings",
    language: "Language",
    look: "Style",
    sampleTitle: "GENERAL ADVANCE",
    sampleText: "Order 6 units.",
    sampleButton: "FIRE",
    sampleStamp: "FIRED",
    sound: "Sound",
    soundEffects: "Sound effects (dice, cards, stamps)",
    done: "Done",
  },
});

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  /** More settings shown after the device's own, e.g. the menu's rules for the next game */
  children?: ReactNode;
}

/** A small painted sample of a look: its panel, ink, button and stamp colours in its fonts */
function LookSample({ look }: { look: Look }) {
  const { colors, fonts, radius, border } = look;
  const t = useMessages(TEXT);
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
        <Box sx={{ fontFamily: fonts.display, fontSize: 18, lineHeight: 1.1 }}>{t.sampleTitle}</Box>
        <Box sx={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted }}>{t.sampleText}</Box>
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
            {t.sampleButton}
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
            {t.sampleStamp}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

/** Per-device settings: the language and the visual look (applied straight away) and sound */
function SettingsDialog({ open, onClose, children }: SettingsDialogProps) {
  const { settings, updateSettings } = useSettings();
  const t = useMessages(TEXT);
  const tr = useTr();

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t.title}</DialogTitle>
      <DialogContent>
        <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
          {t.language}
        </Typography>
        <ToggleButtonGroup
          exclusive
          value={settings.language}
          onChange={(_, language: unknown) => isLang(language) && updateSettings({ language })}
          aria-label={t.language}
          sx={{ mb: 3 }}
        >
          {LANGS.map((lang) => (
            <ToggleButton key={lang} value={lang} lang={lang} sx={{ minHeight: 48, px: 3 }}>
              {LANG_NAMES[lang]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
          {t.look}
        </Typography>
        <Box
          role="radiogroup"
          aria-label={t.look}
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
                  {tr(look.name)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {tr(look.description)}
                </Typography>
              </ButtonBase>
            );
          })}
        </Box>

        <Typography variant="h6" component="h3" sx={{ mt: 3, mb: 1 }}>
          {t.sound}
        </Typography>
        <FormControlLabel
          control={
            <Switch checked={settings.sound} onChange={(e) => updateSettings({ sound: e.target.checked })} />
          }
          label={t.soundEffects}
          sx={{ minHeight: 48 }}
        />
        {children}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t.done}</Button>
      </DialogActions>
    </Dialog>
  );
}

export default SettingsDialog;
