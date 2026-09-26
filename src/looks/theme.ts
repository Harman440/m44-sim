// looks/theme.ts
import { createTheme, Theme } from "@mui/material/styles";
import { Look } from "./looks";
import "./fonts";

/** CSS variables for the custom CSS (board, command cards, dice, stamps) */
export const lookCssVariables = ({ colors, fonts, radius, border, shadow }: Look): Record<string, string> => ({
  "--m44-bg": colors.bg,
  "--m44-paper": colors.paper,
  "--m44-paper-alt": colors.paperAlt,
  "--m44-ink": colors.ink,
  "--m44-muted": colors.muted,
  "--m44-border": colors.border,
  "--m44-primary": colors.primary,
  "--m44-on-primary": colors.onPrimary,
  "--m44-accent": colors.accent,
  "--m44-on-accent": colors.onAccent,
  "--m44-move-fire": colors.moveAndFire,
  "--m44-move-only": colors.moveOnly,
  "--m44-die": colors.die,
  "--m44-font-display": fonts.display,
  "--m44-font-body": fonts.body,
  "--m44-radius": `${radius}px`,
  "--m44-border-width": `${border}px`,
  "--m44-shadow": shadow,
});

/** The MUI theme for a look; also sets the page texture and the --m44-* variables */
export function createLookTheme(look: Look): Theme {
  const { colors, fonts, radius, border, shadow } = look;
  const display = { fontFamily: fonts.display, fontWeight: 400, letterSpacing: "0.02em" };

  return createTheme({
    palette: {
      mode: look.mode,
      primary: { main: colors.primary, contrastText: colors.onPrimary },
      secondary: { main: colors.ink, contrastText: colors.paper },
      error: { main: colors.accent, contrastText: colors.onAccent },
      success: { main: colors.success, contrastText: look.mode === "dark" ? colors.bg : colors.paper },
      warning: { main: colors.warning, contrastText: look.mode === "dark" ? colors.bg : colors.paper },
      background: { default: colors.bg, paper: colors.paper },
      text: { primary: colors.ink, secondary: colors.muted },
      divider: colors.border,
    },
    shape: { borderRadius: radius },
    typography: {
      fontFamily: fonts.body,
      h1: display,
      h2: display,
      h3: display,
      h4: display,
      h5: display,
      h6: display,
      overline: { fontFamily: fonts.display, letterSpacing: "0.12em" },
      button: { fontFamily: fonts.display, fontWeight: 400, letterSpacing: "0.06em" },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ":root": lookCssVariables(look),
          body: {
            backgroundColor: colors.bg,
            backgroundImage: `url(${look.texture})`,
            backgroundSize: "512px",
            backgroundBlendMode: look.textureBlend,
          },
        },
      },
      MuiButton: {
        defaultProps: { variant: "contained", disableElevation: true },
        // Comfortable tap target on Android tablets
        styleOverrides: { root: { minHeight: 48 } },
      },
      MuiIconButton: {
        styleOverrides: { root: { minWidth: 48, minHeight: 48 } },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: "none" },
          outlined: { borderWidth: border, borderColor: colors.border, boxShadow: shadow },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { border: `${border}px solid ${colors.border}`, boxShadow: shadow },
        },
      },
      MuiChip: {
        styleOverrides: { root: { fontFamily: fonts.body, fontSize: "0.9rem" } },
      },
    },
  });
}
