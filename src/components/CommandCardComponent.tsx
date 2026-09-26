import CommandCard, { CommandCardType } from "../game-core/commandCard";
import { UnitType } from "../game-core/unit";
import { UNIT_LABELS } from "../labels";
import "./CommandCard.css";

interface CommandCardProps {
    cardData: CommandCard;
    onClick: (card: CommandCard) => void;
}

/** Sections (left, center, right) a card orders units in */
const SECTIONS: Record<CommandCardType, [boolean, boolean, boolean]> = {
    [CommandCardType.LEFT]: [true, false, false],
    [CommandCardType.CENTER]: [false, true, false],
    [CommandCardType.RIGHT]: [false, false, true],
    [CommandCardType.ALLSIDES]: [true, true, true],
    [CommandCardType.ALL]: [true, true, true],
    [CommandCardType.INFANTRY]: [true, true, true],
    [CommandCardType.TANK]: [true, true, true],
    [CommandCardType.ARTILLERY]: [true, true, true],
};

/** Tactic cards order one unit type anywhere */
const TACTIC_UNIT: Partial<Record<CommandCardType, UnitType>> = {
    [CommandCardType.INFANTRY]: UnitType.INFANTRY,
    [CommandCardType.TANK]: UnitType.TANK,
    [CommandCardType.ARTILLERY]: UnitType.ARTILLERY,
};

const SECTION_NAMES = ["Izquierda", "Centro", "Derecha"];

/** The board's three sections, with the ones this card orders filled in */
function FlankDiagram({ type }: { type: CommandCardType }) {
    const active = SECTIONS[type];
    const label = SECTION_NAMES.filter((_, i) => active[i]).join(", ");
    return (
        <svg className="command-card__flanks" viewBox="0 0 120 28" role="img" aria-label={`Secciones: ${label}`}>
            {active.map((on, i) => (
                <rect
                    key={i}
                    x={1 + i * 40}
                    y={1}
                    width={38}
                    height={26}
                    className={on ? "command-card__flank command-card__flank--on" : "command-card__flank"}
                />
            ))}
        </svg>
    );
}

/** A command card, drawn like the game's: title band, sections diagram, order count */
function CommandCardComponent({ cardData, onClick }: CommandCardProps) {
    const tacticUnit = TACTIC_UNIT[cardData.type];
    return (
        <button
            type="button"
            className={`command-card command-card--${tacticUnit ? "tactic" : "section"}`}
            onClick={() => onClick(cardData)}
        >
            <span className="command-card__band">
                <h3 className="card-title">{cardData.name}</h3>
            </span>
            <span className="command-card__body">
                <FlankDiagram type={cardData.type} />
                {tacticUnit && <span className="command-card__unit">Solo {UNIT_LABELS[tacticUnit].toLowerCase()}</span>}
                <span className="command-card__orders">
                    <span className="command-card__count">{cardData.maxTotalOrders}</span>
                    <span>{cardData.maxTotalOrders === 1 ? "orden" : "órdenes"}</span>
                </span>
                <span className="card-description">{cardData.description}</span>
            </span>
        </button>
    );
}

export default CommandCardComponent;
