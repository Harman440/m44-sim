import CommandCard from "../game-core/commandCard";
import { Faction } from "../types/faction";
import { UNIT_LABELS } from "../labels";
import { SectionCardArt, TacticCardArt, isSectionCard } from "./CardArt";
import "./CommandCard.css";

interface CommandCardProps {
    cardData: CommandCard;
    /** Without it the card is only shown, not a button */
    onClick?: (card: CommandCard) => void;
    /** Whose unit tokens the art shows */
    faction?: Faction;
}

/** A title longer than this goes on two lines, smaller */
const LONG_TITLE = 12;

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
 * A command card, drawn like the game's: its title over a painting. A section
 * card shows its sections and order counts as arrows on a piece of board; a
 * tactic card a few words of what it does. Its full text is in its details
 * (CardDetails), shown when it is tapped.
 */
function CommandCardComponent({ cardData, onClick, faction = "Allies" }: CommandCardProps) {
    const section = isSectionCard(cardData);
    const Root = onClick ? "button" : "div";
    return (
        <Root
            {...(onClick ? { type: "button", onClick: () => onClick(cardData), "aria-label": cardData.name } : {})}
            className={`game-card command-card command-card--${section ? "section" : "tactic"}${onClick ? "" : " command-card--static"}`}
        >
            <span className="game-card__face">
                <span className="command-card__band">
                    <h3 className={`card-title${cardData.title.length > LONG_TITLE ? " card-title--long" : ""}`} lang="es">
                        {cardData.title}
                    </h3>
                </span>
                <span className="command-card__art">
                    {section ? <SectionCardArt card={cardData} faction={faction} /> : <TacticCardArt card={cardData} />}
                </span>
            </span>
        </Root>
    );
}

export default CommandCardComponent;
