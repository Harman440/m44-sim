import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import CommandCard from "../game-core/commandCard";
import commandCards from "../data/commandCards";

interface DeckVisualizerDialogProps {
  open: boolean;
  onClose: () => void;
}

function DeckVisualizerDialog({ open, onClose }: DeckVisualizerDialogProps) {
  // Group cards by unique name and count how many of each
  const cardMap = new Map<string, { card: CommandCard; count: number }>();

  commandCards.forEach((card) => {
    const existing = cardMap.get(card.name);
    if (existing) {
      existing.count += 1;
    } else {
      cardMap.set(card.name, { card, count: 1 });
    }
  });

  // Separate section cards and tactic cards
  const sectionCards: Array<{ card: CommandCard; count: number }> = [];
  const tacticCards: Array<{ card: CommandCard; count: number }> = [];

  cardMap.forEach(({ card, count }) => {
    if (card.tactic) {
      tacticCards.push({ card, count });
    } else {
      sectionCards.push({ card, count });
    }
  });

  // Sort alphabetically
  sectionCards.sort((a, b) => a.card.name.localeCompare(b.card.name));
  tacticCards.sort((a, b) => a.card.name.localeCompare(b.card.name));

  const totalCards = commandCards.length;
  const totalSectionCards = sectionCards.reduce((sum, { count }) => sum + count, 0);
  const totalTacticCards = tacticCards.reduce((sum, { count }) => sum + count, 0);

  const CardRow = ({ card, count }: { card: CommandCard; count: number }) => (
    <TableRow hover>
      <TableCell>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {card.name}
        </Typography>
      </TableCell>
      <TableCell align="center">
        <Chip label={count} size="small" variant="outlined" />
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {card.description}
        </Typography>
      </TableCell>
    </TableRow>
  );

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" scroll="paper">
      <DialogTitle>Mazo de cartas de mando</DialogTitle>
      <DialogContent dividers>
        <Stack sx={{ gap: 3 }}>
          {/* Summary stats */}
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Chip label={`Total: ${totalCards}`} color="primary" />
            <Chip label={`Cartas de sección: ${totalSectionCards}`} variant="outlined" />
            <Chip label={`Cartas de táctica: ${totalTacticCards}`} variant="outlined" />
          </Box>

          {/* Section cards */}
          <Paper variant="outlined">
            <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
              <Typography variant="h6" component="h3">
                Cartas de sección ({totalSectionCards})
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Cartas que ordenan unidades en un flanco específico o en toda la zona
              </Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: "action.hover" }}>
                    <TableCell>Nombre</TableCell>
                    <TableCell align="center" sx={{ width: 60 }}>
                      Copias
                    </TableCell>
                    <TableCell>Descripción</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sectionCards.map(({ card, count }) => (
                    <CardRow key={card.id} card={card} count={count} />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* Tactic cards */}
          <Paper variant="outlined">
            <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
              <Typography variant="h6" component="h3">
                Cartas de táctica ({totalTacticCards})
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Cartas especiales con capacidades únicas
              </Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: "action.hover" }}>
                    <TableCell>Nombre</TableCell>
                    <TableCell align="center" sx={{ width: 60 }}>
                      Copias
                    </TableCell>
                    <TableCell>Descripción</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tacticCards.map(({ card, count }) => (
                    <CardRow key={card.id} card={card} count={count} />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

export default DeckVisualizerDialog;
