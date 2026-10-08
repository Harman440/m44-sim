import { ReactNode } from "react";
import { Box, Button, ButtonBase, Stack, Typography } from "@mui/material";
import BoardManager from "../game-core/BoardManager";
import { OrderSummary } from "../game-core/turnSummary";
import { CombatCard } from "../game-core/combatCard";
import type { CardAttack } from "../game-core/gameSession";
import { appliedFaces, readRoll } from "../game-core/rollResult";
import { Position } from "../types/scenario";
import { Faction } from "../types/faction";
import { defineMessages, useLabels, useMessages, useTr } from "../i18n/useI18n";
import OrderToken from "./OrderToken";
import GameIcon from "./GameIcon";
import HexThumbnail from "./HexThumbnail";
import SectionIcon from "./SectionIcon";
import Stamp from "./Stamp";

const TEXT = defineMessages({
  es: {
    extraOrder: "orden extra",
    tookGround: "tomó terreno",
    closeAssault: "asalto cercano",
    wire: "Alambrada",
    blocked: "Bloqueada",
    blockedResult: "Bloqueada por una carta del rival",
    fired: "Disparó",
    removed: "Eliminada",
    waits: "Espera",
    fire: "Disparar",
    noShot: "Sin disparo",
    fires: "Dispara",
    cantFire: "No dispara",
    removedWireResult: "Quitó la alambrada",
    removedWire: "quitó la alambrada",
    blockedShot: "bloqueado por el rival",
    collisionPrefix: "choque, ",
    firedResult: (results: string) => `Disparó: ${results}`,
    seeRoll: (unit: string) => `Ver tirada de ${unit}`,
    fireWith: (unit: string) => `Disparar con ${unit}`,
    title: "Orden de fuego",
    count: (toFire: number, fired: number, notFiring: number) =>
      `${toFire} por disparar · ${fired} ${fired === 1 ? "disparó" : "dispararon"} · ${notFiring} ${
        notFiring === 1 ? "no puede disparar" : "no pueden disparar"
      }`,
    collisions: "Choques",
    beforeAll: "antes que nada",
    wasCollision: "¿Ha habido un choque?",
    collisionDetail: "Una unidad movida contra una enemiga",
    rollCollision: "Tirar choque",
    attackPending: "Tira primero en cada casilla marcada",
    attackDone: "Ataques resueltos.",
    attackResult: (target: string, dice: number) => `${target}: ${dice} ${dice === 1 ? "dado" : "dados"}`,
    empty: "Vacía",
    hexN: (n: number) => `Casilla ${n}`,
    see: "Ver",
    dicePerHex: (n: number) => `${n} dados · `,
    roll: "Tirar",
    hexLabel: (done: boolean, n: number) => `${done ? "Ver" : "Tirar"} casilla ${n}`,
    closeAssaultTitle: "Asalto cercano",
    markYourUnits: "Marca tus unidades junto a una enemiga",
    closeAssaultDetail: "Dispararán en asalto cercano",
    mark: "Marcar",
    markUnits: "Marcar unidades",
    firesFirst: "Dispara primero",
    beforeAnyOther: "antes que cualquier otra unidad",
    unmoved: "Sin mover",
    moved: "Movidas",
    waitForUnmoved: "esperan a las sin mover",
    skipToMoved: "Pasar a las movidas",
  },
  en: {
    extraOrder: "extra order",
    tookGround: "took ground",
    closeAssault: "close assault",
    wire: "Barbed wire",
    blocked: "Blocked",
    blockedResult: "Blocked by an enemy card",
    fired: "Fired",
    removed: "Removed",
    waits: "Waits",
    fire: "Fire",
    noShot: "No shot",
    fires: "Fires",
    cantFire: "Can't fire",
    removedWireResult: "Removed the barbed wire",
    removedWire: "removed the barbed wire",
    blockedShot: "blocked by the enemy",
    collisionPrefix: "collision, ",
    firedResult: (results: string) => `Fired: ${results}`,
    seeRoll: (unit: string) => `See ${unit}'s roll`,
    fireWith: (unit: string) => `Fire with ${unit}`,
    title: "Firing order",
    count: (toFire: number, fired: number, notFiring: number) =>
      `${toFire} to fire · ${fired} fired · ${notFiring} can't fire`,
    collisions: "Collisions",
    beforeAll: "before anything else",
    wasCollision: "Was there a collision?",
    collisionDetail: "A moved unit against an enemy one",
    rollCollision: "Roll collision",
    attackPending: "Roll first on each marked hex",
    attackDone: "Attacks resolved.",
    attackResult: (target: string, dice: number) => `${target}: ${dice} ${dice === 1 ? "die" : "dice"}`,
    empty: "Empty",
    hexN: (n: number) => `Hex ${n}`,
    see: "See",
    dicePerHex: (n: number) => `${n} dice · `,
    roll: "Roll",
    hexLabel: (done: boolean, n: number) => `${done ? "See" : "Roll"} hex ${n}`,
    closeAssaultTitle: "Close assault",
    markYourUnits: "Mark your units next to an enemy one",
    closeAssaultDetail: "They'll fire in close assault",
    mark: "Mark",
    markUnits: "Mark units",
    firesFirst: "Fires first",
    beforeAnyOther: "before any other unit",
    unmoved: "Didn't move",
    moved: "Moved",
    waitForUnmoved: "they wait for the ones that didn't move",
    skipToMoved: "On to the moved units",
  },
});

/** An attack combat card (Cortina de Fuego…): rolled on each marked hex before any unit fires */
export interface CardAttackStep {
  card: CombatCard;
  markers: readonly Position[];
  attackOn: (marker: number) => CardAttack | null;
  pending: boolean;
  onOpen: (marker: number) => void;
}

interface FireOrderListProps {
  summaries: readonly OrderSummary[];
  board: BoardManager;
  /** The scenario's board art, for the hex thumbnails */
  image?: string;
  faction: Faction;
  /** Some unit moved: step 1 asks whether one collided with an enemy */
  onCollision?: () => void;
  attack?: CardAttackStep | null;
  /** A Close Assault card: mark the units adjacent to an enemy */
  onMarkCloseAssault?: () => void;
  /** Open the fire dialog for a unit: to fire, or to see its roll. Missing while the card attacks are pending */
  onFire?: (summary: OrderSummary) => void;
  /** Give up the unfired shots of the units that didn't move, so the moved units can fire */
  onSkipUnmoved?: () => void;
  /** Shown when no unit has an order */
  emptyText: string;
}

type Tone = "go" | "card" | "plain" | "dim";

const TONE_BORDER: Record<Tone, string> = {
  go: "var(--m44-move-fire)",
  card: "var(--m44-accent)",
  plain: "var(--m44-border)",
  dim: "var(--m44-border)",
};

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

interface RowProps {
  icon: ReactNode;
  title: ReactNode;
  /** Second line: where it is, or what it means */
  detail?: ReactNode;
  /** Third line: what it rolled */
  result?: ReactNode;
  status: ReactNode;
  tone: Tone;
  onClick?: () => void;
  label?: string;
  testId?: string;
}

/** One line of the fire order; tappable as a whole when it has something to do */
function Row({ icon, title, detail, result, status, tone, onClick, label, testId }: RowProps) {
  const sx = {
    width: "100%",
    minHeight: 56,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 1.5,
    px: 1.5,
    py: 0.75,
    boxSizing: "border-box",
    bgcolor: "var(--m44-paper)",
    border: "1px solid",
    borderColor: TONE_BORDER[tone],
    boxShadow: tone === "go" || tone === "card" ? `inset 3px 0 0 ${TONE_BORDER[tone]}` : "none",
    borderRadius: "var(--m44-radius)",
    color: "var(--m44-ink)",
    textAlign: "left",
    fontFamily: "var(--m44-font-body)",
    opacity: tone === "dim" ? 0.65 : 1,
  } as const;
  const content = (
    <>
      <Box sx={{ flex: "none", display: "flex" }}>{icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body1" component="span" sx={{ display: "block", fontWeight: 600 }}>
          {title}
        </Typography>
        {detail && (
          <Typography variant="body2" component="span" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
            {detail}
          </Typography>
        )}
        {result && (
          <Typography variant="body2" component="span" color="success.main" sx={{ display: "block" }}>
            {result}
          </Typography>
        )}
      </Box>
      <Box sx={{ flex: "none", display: "flex", alignItems: "center", gap: 1 }}>{status}</Box>
    </>
  );
  return (
    <Box component="li" data-testid={testId} sx={{ listStyle: "none" }}>
      {onClick ? (
        <ButtonBase
          onClick={onClick}
          aria-label={label}
          sx={{ ...sx, "&:focus-visible": { outline: "3px solid var(--m44-primary)", outlineOffset: 2 } }}
        >
          {content}
        </ButtonBase>
      ) : (
        <Box sx={sx}>{content}</Box>
      )}
    </Box>
  );
}

/** "Disparar ›": the row's action, in the colour of its tone */
const Action = ({ children, color }: { children: ReactNode; color: string }) => (
  <Typography variant="body2" component="span" sx={{ color, fontWeight: 700, whiteSpace: "nowrap" }}>
    {children} ›
  </Typography>
);

const StatusText = ({ children, color = "text.secondary" }: { children: ReactNode; color?: string }) => (
  <Typography variant="body2" component="span" sx={{ color, whiteSpace: "nowrap" }}>
    {children}
  </Typography>
);

/**
 * The battle in the order it's fought: collisions, an attack combat card, a
 * unit that fires first (Tras las líneas enemigas), the units that didn't
 * move, then the units that moved. Each unit shows its hex
 * and section; tapping it opens the fire dialog.
 */
function FireOrderList({
  summaries,
  board,
  image,
  faction,
  onCollision,
  attack,
  onMarkCloseAssault,
  onFire,
  onSkipUnmoved,
  emptyText,
}: FireOrderListProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  const toFire = summaries.filter((s) => s.shots.length === 0 && s.shotsLeft > 0).length;
  const fired = summaries.filter((s) => s.shots.length > 0).length;
  const notFiring = summaries.filter((s) => !s.canFire && !s.removed).length;
  const waiting = summaries.filter((s) => s.waiting).length;
  let step = 0;

  const where = (position: Position) => {
    const hex = board.getHex(position);
    if (!hex) return null;
    // Icons only: the hex's own art and the lit section say it without words
    return (
      <>
        <HexThumbnail
          board={board}
          position={position}
          image={image}
          faction={faction}
          size={34}
          label={capitalize(labels.terrain[hex.getType()])}
        />
        <SectionIcon side={hex.getSide()} label={labels.sectionsShort[hex.getSide()]} />
      </>
    );
  };

  const group = (title: string, hint: string | null, rows: ReactNode, testId: string, action?: ReactNode) => {
    step += 1;
    return (
      <Box component="section" data-testid={testId} sx={{ mt: 1.5 }}>
        <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 0.75, flexWrap: "wrap" }}>
          <Box
            component="span"
            aria-hidden="true"
            sx={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              bgcolor: "var(--m44-primary)",
              color: "var(--m44-on-primary)",
              display: "grid",
              placeItems: "center",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {step}
          </Box>
          <Typography variant="h6" component="h3" sx={{ fontSize: "1rem" }}>
            {title}
          </Typography>
          {hint && (
            <Typography variant="body2" color="text.secondary">
              {hint}
            </Typography>
          )}
          {action && <Box sx={{ ml: "auto" }}>{action}</Box>}
        </Stack>
        <Stack component="ol" sx={{ p: 0, m: 0, gap: 0.75 }}>
          {rows}
        </Stack>
      </Box>
    );
  };

  const unitRow = (summary: OrderSummary) => {
    const unit = labels.unitKind(summary.unitType, summary.elite);
    const hasShots = summary.shots.length > 0;
    const canFireNow = summary.shotsLeft > 0 && !summary.waiting && onFire !== undefined;
    const tags = [summary.extra && t.extraOrder, summary.tookGround && t.tookGround, summary.closeAssaultOnly && t.closeAssault]
      .filter(Boolean)
      .join(" · ");
    let status: ReactNode;
    const onlyWire = hasShots && summary.shots.every((shot) => shot.removedWire);
    const onlyBlocked = hasShots && summary.shots.every((shot) => shot.blocked);
    if (onlyWire) status = <Stamp angle={-7}>{t.wire}</Stamp>;
    else if (onlyBlocked) status = <Stamp angle={-7}>{t.blocked}</Stamp>;
    else if (hasShots) status = <Stamp angle={-7}>{t.fired}</Stamp>;
    else if (summary.removed) status = <StatusText>{t.removed}</StatusText>;
    else if (summary.waiting) status = <StatusText>{t.waits}</StatusText>;
    else if (canFireNow) status = <Action color="var(--m44-move-fire)">{t.fire}</Action>;
    else if (summary.skipped) status = <StatusText>{t.noShot}</StatusText>;
    else if (summary.canFire) status = <StatusText>{t.fires}</StatusText>;
    else status = <StatusText color="warning.main">{t.cantFire}</StatusText>;
    const opens = hasShots ? onFire !== undefined : canFireNow;

    return (
      <Row
        key={summary.index}
        testId="order-summary"
        icon={<OrderToken orderIndex={summary.index} unitType={summary.unitType} faction={faction} />}
        title={
          <>
            {unit}
            {tags && (
              <Typography component="span" variant="body2" color="text.secondary" sx={{ fontWeight: 400 }}>
                {" "}
                · {tags}
              </Typography>
            )}
          </>
        }
        // Where it is now: after taking ground, the hex it took
        detail={where(summary.firingFrom)}
        result={
          hasShots &&
          (onlyWire
            ? t.removedWireResult
            : onlyBlocked
            ? t.blockedResult
            : t.firedResult(
                summary.shots
                  .map((shot) =>
                    shot.removedWire
                      ? t.removedWire
                      : shot.blocked
                      ? t.blockedShot
                      : `${shot.collision ? t.collisionPrefix : ""}${labels.describeAppliedFaces(shot.faces, shot.kept)}${
                          shot.dice > 0 ? ` → ${labels.describeRoll(readRoll(appliedFaces(shot.faces, shot.kept), shot.target))}` : ""
                        }`
                  )
                  .join(" / ")
              ))
        }
        status={status}
        tone={canFireNow ? "go" : summary.removed || summary.waiting || (!summary.canFire && !hasShots) ? "dim" : "plain"}
        onClick={opens ? () => onFire!(summary) : undefined}
        label={hasShots ? t.seeRoll(unit) : t.fireWith(unit)}
      />
    );
  };

  const first = summaries.filter((s) => s.firesFirst);
  const unmoved = summaries.filter((s) => s.hold && !s.firesFirst);
  const moved = summaries.filter((s) => !s.hold && !s.firesFirst);

  return (
    <Box data-testid="fire-order-list">
      <Stack direction="row" sx={{ alignItems: "baseline", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
        <Typography variant="h6" component="h2">
          {t.title}
        </Typography>
        {summaries.length > 0 && (
          <Typography variant="body2" color="text.secondary" data-testid="fire-count">
            {t.count(toFire, fired, notFiring)}
          </Typography>
        )}
      </Stack>

      {onCollision &&
        group(
          t.collisions,
          t.beforeAll,
          <Row
            icon={<GameIcon name="battle" size={32} />}
            title={t.wasCollision}
            detail={t.collisionDetail}
            status={<Action color="var(--m44-primary)">{t.rollCollision}</Action>}
            tone="plain"
            onClick={onCollision}
            label={t.wasCollision}
          />,
          "step-collisions"
        )}

      {attack &&
        group(
          tr(attack.card.name),
          attack.pending ? t.attackPending : t.attackDone,
          attack.markers.map((position, i) => {
            const done = attack.attackOn(i);
            const result = done?.target
              ? t.attackResult(labels.target(done.target.infantry), done.faces.length)
              : done
                ? t.empty
                : null;
            return (
              <Row
                key={i}
                icon={<GameIcon name="fire" size={32} />}
                title={t.hexN(i + 1)}
                detail={where(position)}
                result={result}
                status={
                  done ? (
                    <Action color="var(--m44-primary)">{t.see}</Action>
                  ) : (
                    <Action color="var(--m44-move-fire)">
                      {attack.card.effect?.kind === "attack" ? t.dicePerHex(attack.card.effect.dicePerHex) : ""}
                      {t.roll}
                    </Action>
                  )
                }
                tone={done ? "plain" : "card"}
                onClick={() => attack.onOpen(i)}
                label={t.hexLabel(Boolean(done), i + 1)}
              />
            );
          }),
          "card-attacks"
        )}

      {onMarkCloseAssault &&
        group(
          t.closeAssaultTitle,
          null,
          <Row
            icon={<GameIcon name="battle" size={32} />}
            title={t.markYourUnits}
            detail={t.closeAssaultDetail}
            status={<Action color="var(--m44-primary)">{t.mark}</Action>}
            tone="card"
            onClick={onMarkCloseAssault}
            label={t.markUnits}
          />,
          "step-close-assault"
        )}

      {summaries.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          {emptyText}
        </Typography>
      ) : (
        <>
          {first.length > 0 && group(t.firesFirst, t.beforeAnyOther, first.map(unitRow), "group-first")}
          {unmoved.length > 0 && group(t.unmoved, null, unmoved.map(unitRow), "group-unmoved")}
          {moved.length > 0 &&
            group(
              t.moved,
              waiting > 0 ? t.waitForUnmoved : null,
              moved.map(unitRow),
              "group-moved",
              waiting > 0 && onSkipUnmoved ? (
                <Button variant="outlined" color="warning" size="small" onClick={onSkipUnmoved}>
                  {t.skipToMoved}
                </Button>
              ) : undefined
            )}
        </>
      )}
    </Box>
  );
}

export default FireOrderList;
