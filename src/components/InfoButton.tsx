import { ReactNode, useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton } from "@mui/material";
import GameIcon from "./GameIcon";

interface InfoButtonProps {
  /** What the information is about: the dialog's title and the button's name */
  title: string;
  children: ReactNode;
}

/** An "i" button beside a heading: the explanation opens in a dialog instead of filling the screen */
function InfoButton({ title, children }: InfoButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton onClick={() => setOpen(true)} aria-label={`Información: ${title}`} sx={{ width: 48, height: 48, flex: "none" }}>
        <Box
          component="span"
          aria-hidden
          sx={{
            display: "grid",
            placeItems: "center",
            width: 26,
            height: 26,
            borderRadius: "50%",
            border: "2px solid currentColor",
            fontFamily: "Georgia, serif",
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: 16,
            lineHeight: 1,
          }}
        >
          i
        </Box>
      </IconButton>
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
