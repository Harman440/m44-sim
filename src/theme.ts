// src/theme.ts
import { createTheme } from "@mui/material/styles";

// Dark theme; the primary orange matches the order arrows on the board
const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#e65c00" },
    secondary: { main: "#6b7d3a" }, // olive drab
    background: { default: "#1a1a1a", paper: "#242424" },
    text: { primary: "#e5e7eb", secondary: "#9ca3af" },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      defaultProps: { variant: "contained", disableElevation: true },
    },
  },
});

export default theme;
