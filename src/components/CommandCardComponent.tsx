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

/** The big number on the card and its word: orders, "Todas" or none */
function orderCount(card: CommandCard): { count: string; unit: string } {
    if (card.closeAssaultOnly || card.orders === 0) return { count: "0", unit: "órdenes" };
    if (card.orders === "all") return { count: "Todas", unit: "las unidades" };
    return { count: String(card.orders), unit: card.orders === 1 ? "orden" : "órdenes" };
}

/** Short tags for the card's special rules; the description has the details */
function ruleTags(card: CommandCard): string[] {
    const tags: string[] = [];
    if (card.unitTypes) tags.push(`Solo ${card.unitTypes.map((type) => UNIT_LABELS[type].toLowerCase()).join(", ")}`);
    if (card.choosesSection) tags.push("Sección a elegir");
    if (card.perSection !== null) tags.push(`${card.perSection} por sección`);
    if (card.paidInCoins) tags.push("Cuesta monedas");
    if (card.onTheMove > 0) tags.push(`+${card.onTheMove} en movimiento`);
    if (card.noMove) tags.push("Sin mover");
    if (card.closeAssaultOnly) tags.push("Asalto cercano");
    if (card.drawChoice > 1) tags.push(`Roba ${card.drawChoice}, elige 1`);
    if (card.endOfTurnReward) tags.push(`${card.endOfTurnReward.coins} monedas + carta de combate`);
    return tags;
}

/** A command card, drawn like the game's: title band, sections diagram, order count */
function CommandCardComponent({ cardData, onClick }: CommandCardProps) {
    const { count, unit } = orderCount(cardData);
    const Root = onClick ? "button" : "div";
    return (
        <Root
            {...(onClick ? { type: "button", onClick: () => onClick(cardData) } : {})}
            className={`command-card command-card--${cardData.tactic ? "tactic" : "section"}${onClick ? "" : " command-card--static"}`}
        >
            <span className="command-card__band">
                <h3 className="card-title">{cardData.name}</h3>
            </span>
            <span className="command-card__body">
                <FlankDiagram card={cardData} />
                {ruleTags(cardData).length > 0 && (
                    <span className="command-card__tags">
                        {ruleTags(cardData).map((tag) => (
                            <span key={tag} className="command-card__unit">{tag}</span>
                        ))}
                    </span>
                )}
                <span className="command-card__orders">
                    <span className={`command-card__count${/^\d+$/.test(count) ? "" : " command-card__count--word"}`}>
                        {count}
                    </span>
                    <span>{unit}</span>
                </span>
                <span className="card-description">{cardData.description}</span>
            </span>
        </Root>
    );
}

export default CommandCardComponent;
