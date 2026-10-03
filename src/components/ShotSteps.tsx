import { ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { ShotRoll } from "../game-core/gameSession";
import { DiceStep, DiceStepKind } from "../game-core/fireRules";
import { UnitType } from "../game-core/unit";
import { Faction } from "../types/faction";
import { describeTarget } from "../labels";
import { unitSprite } from "./UnitComponent";
import SandbagsIcon from "./SandbagsIcon";
import GameIcon from "./GameIcon";
import { BarbedWireIcon } from "./BarbedWire";

interface ShotStepsProps {
  shot: ShotRoll;
  /** The firing unit's type, drawn for the base dice */
  unitType: UnitType;
  faction: Faction;
  /** The target's hex (a thumbnail of the board art), drawn for the terrain step */
  targetHex?: ReactNode;
}

/** The step's kind; shots saved before the steps had kinds are read from their label */
const stepKind = (step: DiceStep): DiceStepKind | undefined => {
  if (step.kind) return step.kind;
  if (step.label.startsWith("Base:")) return "base";
  if (step.label.startsWith("Objetivo en")) return "terrain";
  if (step.label.startsWith("Sacos terreros")) return "sandbags";
  if (step.label.startsWith("Carta ")) return "card";
  if (step.label === "Choque") return "collision";
  return undefined;
};

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
  const enemy: Faction = faction === "Allies" ? "Axis" : "Allies";
  const { target } = shot;

  const icon = (step: DiceStep): ReactNode => {
    switch (stepKind(step)) {
      case "base":
        return <Box component="img" src={unitSprite(faction, unitType)} alt="" sx={{ width: 28, height: 28 }} />;
      case "terrain":
        return (
          targetHex ?? (
            <Typography component="span" variant="caption">
              {step.label}
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
              {step.label.replace(/^Carta /, "")}
            </Typography>
          </>
        );
      case "collision":
        return <CloseAssaultIcon />;
      case "wire":
        return <BarbedWireIcon size={34} />;
      default:
        // Saved before the steps had kinds
        // An older step that isn't any of these
        return (
          <Typography component="span" variant="caption">
            {step.label}
          </Typography>
        );
    }
  };

  const label = [...shot.steps.map((step) => `${step.label} ${signed(step.dice)}`), describeTarget(target)].join(" · ");

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
              color: stepKind(step) === "base" ? "text.primary" : step.dice < 0 ? "error.main" : "success.main",
            }}
          >
            {stepKind(step) === "base" ? step.dice : signed(step.dice)}
          </Typography>
        </Pill>
      ))}
      <Typography component="span" aria-hidden sx={{ color: "text.secondary", px: 0.25 }}>
        ➜
      </Typography>
      <Pill testId="shot-target">
        <Box component="img" src={unitSprite(enemy, target.unitType)} alt="" sx={{ width: 28, height: 28 }} />
        {target.closeAssault ? <CloseAssaultIcon /> : <GameIcon name="fire" size={20} />}
        <Typography component="span" variant="caption" sx={{ fontWeight: 600 }}>
          {target.closeAssault ? "asalto" : "distancia"}
        </Typography>
      </Pill>
    </Stack>
  );
}

export default ShotSteps;
