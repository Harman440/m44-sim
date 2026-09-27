import CommandCard, { SECTIONS } from "../game-core/commandCard";
import { UNIT_LABELS } from "../labels";
import "./CommandCard.css";

interface CommandCardProps {
    cardData: CommandCard;
    /** Without it the card is only shown, not a button */
    onClick?: (card: CommandCard) => void;
}

const SECTION_NAMES = ["Izquierda", "Centro", "Derecha"];

/** The board's three sections, with the ones this card orders filled in (all of them when the player picks one) */
function FlankDiagram({ card }: { card: CommandCard }) {
    const active = SECTIONS.map((section) => card.sections === "chosen" || card.sections.includes(section));
    const label = card.choosesSection
        ? "una a elegir"
        : SECTION_NAMES.filter((_, i) => active[i]).join(", ");
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
    // Tactic cards order some unit types anywhere
    const tacticUnits = cardData.unitTypes?.map((type) => UNIT_LABELS[type].toLowerCase()).join(", ");
    const orders = cardData.orders;
    const Root = onClick ? "button" : "div";
    return (
        <Root
            {...(onClick ? { type: "button", onClick: () => onClick(cardData) } : {})}
            className={`command-card command-card--${tacticUnits ? "tactic" : "section"}${onClick ? "" : " command-card--static"}`}
        >
            <span className="command-card__band">
                <h3 className="card-title">{cardData.name}</h3>
            </span>
            <span className="command-card__body">
                <FlankDiagram card={cardData} />
                {tacticUnits && <span className="command-card__unit">Solo {tacticUnits}</span>}
                <span className="command-card__orders">
                    <span className="command-card__count">{orders === "all" ? "Todas" : orders}</span>
                    <span>{orders === 1 ? "orden" : "órdenes"}</span>
                </span>
                <span className="card-description">{cardData.description}</span>
            </span>
        </Root>
    );
}

export default CommandCardComponent;
