import { ReactNode, useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton } from "@mui/material";
import GameIcon from "./GameIcon";

interface InfoButtonProps {
  /** What the information is about: the dialog's title and the button's name */
  title: string;
  children: ReactNode;
  /** Shown as a text button with this label (e.g. "Instrucciones") instead of a bare "i" */
  label?: string;
}

/** The circled "i" */
function InfoGlyph({ size = 26 }: { size?: number }) {
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        display: "grid",
        placeItems: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        border: "2px solid currentColor",
        fontFamily: "Georgia, serif",
        fontStyle: "italic",
        fontWeight: 700,
        fontSize: size * 0.6,
        lineHeight: 1,
        flex: "none",
      }}
    >
      i
    </Box>
  );
}

/** An "i" button beside a heading: the explanation opens in a dialog instead of filling the screen */
function InfoButton({ title, children, label }: InfoButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {label ? (
        <Button variant="text" color="inherit" onClick={() => setOpen(true)} startIcon={<InfoGlyph size={22} />}>
          {label}
        </Button>
      ) : (
        <IconButton onClick={() => setOpen(true)} aria-label={`Información: ${title}`} sx={{ width: 48, height: 48, flex: "none" }}>
          <InfoGlyph />
        </IconButton>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>{children}</DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setOpen(false)} startIcon={<GameIcon name="cancel" />}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default InfoButton;
