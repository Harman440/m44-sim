import { Fragment, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MobileStepper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import GameIcon, { GameIconName } from "./GameIcon";
import { HOUSE_RULES, HouseRule, HouseRuleGroupId, TUTORIAL, TutorialStepId } from "../data/ruleBook";
import { TurnPhase } from "../types/gameManager";
import { defineMessages, useMessages, useTr } from "../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    title: "Reglamento",
    tabs: "Partes del reglamento",
    tutorial: "Cómo se juega",
    houseRules: "Reglas de la casa",
    phases: { card: "Carta", orders: "Órdenes", movement: "Movimiento", battle: "Batalla", final: "Final" },
    turnPhases: "Fases del turno",
    stepOf: (step: number, steps: number) => `Paso ${step} de ${steps}`,
    back: "Atrás",
    next: "Siguiente",
    toHouseRules: "Reglas de la casa",
    close: "Cerrar",
    houseRulesIntro:
      "Se juega con el reglamento oficial de Memoir '44 (Days of Wonder) salvo lo que sigue. Cada regla dice qué " +
      "manda el reglamento oficial y cómo se juega con la app.",
    jumpTo: "Ir a",
    official: "Reglamento oficial",
    house: "En esta partida",
    newRule: "Regla nueva",
    notImplemented: "Sin implementar en la app",
  },
  en: {
    title: "Rule book",
    tabs: "Parts of the rule book",
    tutorial: "How to play",
    houseRules: "House rules",
    phases: { card: "Card", orders: "Orders", movement: "Movement", battle: "Battle", final: "Final" },
    turnPhases: "Turn phases",
    stepOf: (step: number, steps: number) => `Step ${step} of ${steps}`,
    back: "Back",
    next: "Next",
    toHouseRules: "House rules",
    close: "Close",
    houseRulesIntro:
      "The game follows the official Memoir '44 rules (Days of Wonder) except for what's below. Each rule says " +
      "what the official rules say and how it's played with the app.",
    jumpTo: "Go to",
    official: "Official rules",
    house: "In this game",
    newRule: "New rule",
    notImplemented: "Not in the app yet",
  },
});

type RuleBookTab = "tutorial" | "houseRules";

const STEP_ICONS: Record<TutorialStepId, GameIconName> = {
  setup: "map",
  turn: "endTurn",
  card: "cards",
  orders: "history",
  movement: "tank",
  battle: "fire",
  final: "coins",
  tips: "ruleBook",
};

const GROUP_ICONS: Record<HouseRuleGroupId, GameIconName> = {
  simultaneous: "endTurn",
  dice: "dice",
  terrain: "map",
  commandCards: "cards",
  supplies: "coins",
  optional: "settings",
};

/** The phases of a turn, in the order they're played */
const PHASES: { phase: TurnPhase; label: keyof (typeof TEXT)["es"]["phases"] }[] = [
  { phase: TurnPhase.PICK_CARDS, label: "card" },
  { phase: TurnPhase.ORDER_UNITS, label: "orders" },
  { phase: TurnPhase.MOVEMENT, label: "movement" },
  { phase: TurnPhase.BATTLE, label: "battle" },
  { phase: TurnPhase.END_OF_TURN, label: "final" },
];

/** The row of turn phases, with the one a tutorial page is about picked out */
function PhaseTrack({ current }: { current?: TurnPhase }) {
  const t = useMessages(TEXT);
  return (
    <Box
      component="ol"
      aria-label={t.turnPhases}
      sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75, listStyle: "none", m: 0, p: 0 }}
    >
      {PHASES.map(({ phase, label }, i) => (
        <Fragment key={phase}>
          {i > 0 && (
            <Box component="li" aria-hidden sx={{ color: "text.secondary" }}>
              →
            </Box>
          )}
          <Box component="li" aria-current={phase === current ? "step" : undefined}>
            <Chip
              label={t.phases[label]}
              color={phase === current ? "primary" : "default"}
              variant={phase === current ? "filled" : "outlined"}
              size="small"
            />
          </Box>
        </Fragment>
      ))}
    </Box>
  );
}

/** One page of the tutorial */
function TutorialPage({ index }: { index: number }) {
  const t = useMessages(TEXT);
  const tr = useTr();
  const step = TUTORIAL[index]!;
  const icon = STEP_ICONS[step.id];
  return (
    <Stack sx={{ gap: 2 }}>
      {(step.phase !== undefined || step.id === "turn") && <PhaseTrack current={step.phase} />}
      <Box sx={{ display: "grid", gap: 3, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "144px minmax(0, 1fr)" } }}>
        {/* A large tile beside the text when there's room, a small icon by the title when there isn't */}
        <Box
          aria-hidden
          sx={{
            display: { xs: "none", sm: "grid" },
            placeItems: "center",
            aspectRatio: "1",
            border: 3,
            borderColor: "primary.main",
            borderRadius: "50%",
            color: "primary.main",
          }}
        >
          <GameIcon name={icon} size={80} />
        </Box>
        <Stack sx={{ gap: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Box sx={{ color: "primary.main", display: { xs: "flex", sm: "none" }, flex: "none" }}>
              <GameIcon name={icon} size={48} />
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t.stepOf(index + 1, TUTORIAL.length)}
              </Typography>
              <Typography variant="h5" component="h3">
                {tr(step.title)}
              </Typography>
            </Box>
          </Box>
          <Box component="ul" sx={{ m: 0, pl: 3, display: "grid", gap: 1.5 }}>
            {step.points.map((point) => (
              <Typography key={point.en} component="li" variant="body1">
                {tr(point)}
              </Typography>
            ))}
          </Box>
        </Stack>
      </Box>
    </Stack>
  );
}

/** A house rule: the official rule beside how it's played here */
function HouseRuleItem({ rule }: { rule: HouseRule }) {
  const t = useMessages(TEXT);
  const tr = useTr();
  const label = { variant: "overline", sx: { display: "block", lineHeight: 1.6 } } as const;
  return (
    <Box
      component="article"
      aria-label={tr(rule.title)}
      sx={{ borderLeft: 4, borderColor: rule.notImplemented ? "warning.main" : "primary.main", pl: 1.5, py: 0.5 }}
    >
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, mb: 0.5 }}>
        <Typography variant="subtitle1" component="h4" sx={{ fontWeight: 700 }}>
          {tr(rule.title)}
        </Typography>
        {!rule.official && <Chip label={t.newRule} size="small" color="primary" variant="outlined" />}
        {rule.notImplemented && <Chip label={t.notImplemented} size="small" color="warning" />}
      </Box>
      <Box sx={{ display: "grid", gap: { xs: 1, sm: 2 }, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" } }}>
        {rule.official && (
          <Box>
            <Typography {...label} color="text.secondary">
              {t.official}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {tr(rule.official)}
            </Typography>
          </Box>
        )}
        <Box sx={{ gridColumn: rule.official ? undefined : "1 / -1" }}>
          <Typography {...label} color="primary">
            {t.house}
          </Typography>
          <Typography variant="body2">{tr(rule.house)}</Typography>
        </Box>
      </Box>
    </Box>
  );
}

/** The house rules, grouped, with a row of chips to jump to each group */
function HouseRules() {
  const t = useMessages(TEXT);
  const tr = useTr();
  const groups = useRef(new Map<HouseRuleGroupId, HTMLElement>());
  return (
    <Stack sx={{ gap: 3 }}>
      <Typography variant="body1">{t.houseRulesIntro}</Typography>
      <Box component="nav" aria-label={t.jumpTo} sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {HOUSE_RULES.map((group) => (
          <Chip
            key={group.id}
            icon={<GameIcon name={GROUP_ICONS[group.id]} />}
            label={tr(group.title)}
            onClick={() => groups.current.get(group.id)?.scrollIntoView?.({ behavior: "smooth", block: "start" })}
            sx={{ minHeight: 48, px: 0.5, "& .MuiChip-icon": { color: "inherit" } }}
          />
        ))}
      </Box>
      {HOUSE_RULES.map((group) => (
        <Stack
          key={group.id}
          component="section"
          aria-label={tr(group.title)}
          ref={(el: HTMLElement | null) => {
            if (el) groups.current.set(group.id, el);
            else groups.current.delete(group.id);
          }}
          sx={{ gap: 2, scrollMarginTop: 8 }}
        >
          <Typography
            variant="h6"
            component="h3"
            sx={{ display: "flex", alignItems: "center", gap: 1, borderBottom: 1, borderColor: "divider", pb: 0.5 }}
          >
            <GameIcon name={GROUP_ICONS[group.id]} size={28} />
            {tr(group.title)}
          </Typography>
          {group.rules.map((rule) => (
            <HouseRuleItem key={rule.title.en} rule={rule} />
          ))}
        </Stack>
      ))}
    </Stack>
  );
}

interface RuleBookDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The rule book, from the menu and the game's "Menú": a tutorial on playing a
 * turn with the app, and the house rules next to the official ones.
 */
function RuleBookDialog({ open, onClose }: RuleBookDialogProps) {
  const t = useMessages(TEXT);
  const [tab, setTab] = useState<RuleBookTab>("tutorial");
  const [step, setStep] = useState(0);
  const content = useRef<HTMLDivElement>(null);
  const lastStep = step === TUTORIAL.length - 1;

  // Each page and tab starts at the top
  useEffect(() => {
    if (content.current) content.current.scrollTop = 0;
  }, [tab, step]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      scroll="paper"
      aria-labelledby="rule-book-title"
      // The same height on every tutorial page, so the buttons don't jump about; the house rules take all there is
      slotProps={{ paper: { sx: { height: tab === "tutorial" ? "min(640px, calc(100% - 64px))" : "calc(100% - 64px)" } } }}
    >
      <DialogTitle id="rule-book-title" sx={{ display: "flex", alignItems: "center", gap: 1, pb: 0 }}>
        <GameIcon name="ruleBook" size={32} />
        {t.title}
      </DialogTitle>
      <Tabs
        value={tab}
        onChange={(_, value: RuleBookTab) => setTab(value)}
        aria-label={t.tabs}
        variant="fullWidth"
        sx={{ px: { xs: 1, sm: 2 }, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab value="tutorial" label={t.tutorial} id="rule-book-tab-tutorial" aria-controls="rule-book-panel" />
        <Tab value="houseRules" label={t.houseRules} id="rule-book-tab-houseRules" aria-controls="rule-book-panel" />
      </Tabs>
      <DialogContent ref={content} id="rule-book-panel" role="tabpanel" aria-labelledby={`rule-book-tab-${tab}`}>
        {tab === "tutorial" ? <TutorialPage index={step} /> : <HouseRules />}
      </DialogContent>
      <DialogActions sx={{ gap: 1, flexWrap: "wrap" }}>
        {tab === "tutorial" && (
          <MobileStepper
            variant="dots"
            steps={TUTORIAL.length}
            activeStep={step}
            position="static"
            sx={{ flexGrow: 1, bgcolor: "transparent", p: 0 }}
            backButton={
              <Button variant="text" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
                {t.back}
              </Button>
            }
            nextButton={
              lastStep ? (
                <Button variant="text" onClick={() => setTab("houseRules")}>
                  {t.toHouseRules}
                </Button>
              ) : (
                <Button variant="text" onClick={() => setStep((s) => s + 1)}>
                  {t.next}
                </Button>
              )
            }
          />
        )}
        <Button variant="outlined" onClick={onClose} startIcon={<GameIcon name="cancel" />} sx={{ ml: "auto" }}>
          {t.close}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default RuleBookDialog;
