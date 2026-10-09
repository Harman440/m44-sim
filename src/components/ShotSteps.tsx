import { ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { ShotRoll } from "../game-core/gameSession";
import { DiceStep } from "../game-core/fireRules";
import { UnitType } from "../game-core/unit";
import { Faction } from "../types/faction";
import { defineMessages, useLabels, useMessages, useTr } from "../i18n/useI18n";
import { unitSprite } from "./UnitComponent";
import SandbagsIcon from "./SandbagsIcon";
import GameIcon from "./GameIcon";
import { TargetSprites } from "./TargetKindPicker";
import { BarbedWireIcon } from "./BarbedWire";

interface ShotStepsProps {
  shot: ShotRoll;
  /** The firing unit's type, drawn for the base dice */
  unitType: UnitType;
  faction: Faction;
  /** The target's hex (a thumbnail of the board art), drawn for the terrain step */
  targetHex?: ReactNode;
}

const TEXT = defineMessages({
  es: {
    closeAssault: "asalto",
    atRange: "distancia",
  },
  en: {
    closeAssault: "assault",
    atRange: "range",
  },
});

const signed = (dice: number) => (dice > 0 ? `+${dice}` : `−${-dice}`);

/** Two crossed swords: a close assault */
function CloseAssaultIcon() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden="true" style={{ flex: "none" }}>
      <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none">
        <path d="M4 4 L16 16 M13.5 18.5 L18.5 13.5 M17 17 L20 20" />
        <path d="M20 4 L8 16 M5.5 13.5 L10.5 18.5 M7 17 L4 20" />
      </g>
    </svg>
  );
}

function Pill({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <Box
      component="span"
      data-testid={testId}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        minHeight: 36,
        px: 1,
        border: "1px solid var(--m44-border)",
        borderRadius: 999,
        bgcolor: "var(--m44-paper-alt)",
      }}
    >
      {children}
    </Box>
  );
}

/**
 * How a shot's dice were worked out, as icons: the firing unit and its base
 * dice, then each change (the target's hex, sandbags, cards, a collision),
 * then who it was fired at and whether it was a close assault.
 */
function ShotSteps({ shot, unitType, faction, targetHex }: ShotStepsProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  const enemy: Faction = faction === "Allies" ? "Axis" : "Allies";
  const { target } = shot;

  const icon = (step: DiceStep): ReactNode => {
    switch (step.kind) {
      case "base":
        return <Box component="img" src={unitSprite(faction, unitType)} alt="" sx={{ width: 28, height: 28 }} />;
      case "terrain":
        return (
          targetHex ?? (
            <Typography component="span" variant="caption">
              {tr(step.label)}
            </Typography>
          )
        );
      case "sandbags":
        return <SandbagsIcon size={26} />;
      case "card":
        return (
          <>
            <GameIcon name="cards" size={20} />
            <Typography component="span" variant="caption" sx={{ fontWeight: 600 }}>
              {/* Shots saved before steps named their card show the whole label */}
              {tr(step.card ?? step.label)}
            </Typography>
          </>
        );
      case "collision":
        return <CloseAssaultIcon />;
      case "wire":
        return <BarbedWireIcon size={34} />;
      case "fromTown":
        return <GameIcon name="town" size={26} />;
      default:
        // A step with no kind
        return (
          <Typography component="span" variant="caption">
            {tr(step.label)}
          </Typography>
        );
    }
  };

  const label = [...shot.steps.map((step) => `${tr(step.label)} ${signed(step.dice)}`), labels.describeTarget(target)].join(" · ");

  return (
    <Stack
      direction="row"
      role="img"
      aria-label={label}
      data-testid="shot-steps"
      sx={{ flexWrap: "wrap", alignItems: "center", gap: 0.75 }}
    >
      {shot.steps.map((step, i) => (
        <Pill key={i}>
          {icon(step)}
          <Typography
            component="span"
            sx={{
              fontWeight: 700,
              color: step.kind === "base" ? "text.primary" : step.dice < 0 ? "error.main" : "success.main",
            }}
          >
            {step.kind === "base" ? step.dice : signed(step.dice)}
          </Typography>
        </Pill>
      ))}
      <Typography component="span" aria-hidden sx={{ color: "text.secondary", px: 0.25 }}>
        ➜
      </Typography>
      <Pill testId="shot-target">
        <TargetSprites infantry={target.infantry} enemy={enemy} size={28} />
        {target.closeAssault ? <CloseAssaultIcon /> : <GameIcon name="fire" size={20} />}
        <Typography component="span" variant="caption" sx={{ fontWeight: 600 }}>
          {target.closeAssault ? t.closeAssault : t.atRange}
        </Typography>
      </Pill>
    </Stack>
  );
}

export default ShotSteps;
