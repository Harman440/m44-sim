import CommandCard from "../game-core/commandCard";
import { Faction } from "../types/faction";
import { UNIT_LABELS } from "../labels";
import { CommandCardArt } from "./CardArt";
import "./CommandCard.css";

interface CommandCardProps {
    cardData: CommandCard;
    /** Without it the card is only shown, not a button */
    onClick?: (card: CommandCard) => void;
    /** Whose unit tokens the art shows */
    faction?: Faction;
}

/** The big number on the card and its word: orders, "Todas" or none */
function orderCount(card: CommandCard): { count: string; unit: string } {
    if (card.closeAssaultOnly || card.orders === 0) return { count: "0", unit: "órdenes" };
    if (card.orders === "all") return { count: "Todas", unit: "las unidades" };
    return { count: String(card.orders), unit: card.orders === 1 ? "orden" : "órdenes" };
}

/** Short tags for the card's special rules; the description has the details */
export function ruleTags(card: CommandCard): string[] {
    const tags: string[] = [];
    if (card.unitTypes) tags.push(`Solo ${card.unitTypes.map((type) => UNIT_LABELS[type].toLowerCase()).join(", ")}`);
    if (card.choosesSection) tags.push("Sección a elegir");
    if (card.perSection !== null) tags.push(`${card.perSection} por sección`);
    if (card.paidInCoins) tags.push("Cuesta suministros");
    if (card.onTheMove > 0) tags.push(`+${card.onTheMove} en movimiento`);
    if (card.noMove) tags.push("Sin mover");
    if (card.closeAssaultOnly) tags.push("Asalto cercano");
    if (card.drawChoice > 1) tags.push(`Roba ${card.drawChoice}, elige 1`);
    if (card.endOfTurnReward) tags.push(`${card.endOfTurnReward.coins} suministros + carta de combate`);
    return tags;
}

/**
 * A command card, drawn like the game's: title band with the order count, and
 * art showing what it orders. Its text is in its details (CardDetails), shown
 * when it is tapped.
 */
function CommandCardComponent({ cardData, onClick, faction = "Allies" }: CommandCardProps) {
    const { count, unit } = orderCount(cardData);
    const Root = onClick ? "button" : "div";
    return (
        <Root
            {...(onClick ? { type: "button", onClick: () => onClick(cardData), "aria-label": cardData.name } : {})}
            className={`game-card command-card command-card--${cardData.tactic ? "tactic" : "section"}${onClick ? "" : " command-card--static"}`}
        >
            <span className="command-card__band">
                <h3 className="card-title" lang="es">{cardData.name}</h3>
                <span className="command-card__orders" aria-label={`${count} ${unit}`}>
                    <span className={`command-card__count${/^\d+$/.test(count) ? "" : " command-card__count--word"}`}>
                        {count}
                    </span>
                    <span className="command-card__orders-unit">{unit}</span>
                </span>
            </span>
            <span className="command-card__art">
                <CommandCardArt card={cardData} faction={faction} />
            </span>
        </Root>
    );
}

export default CommandCardComponent;
