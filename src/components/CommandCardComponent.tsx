import CommandCard from "../game-core/commandCard";
import { Faction } from "../types/faction";
import { LABELS } from "../labels";
import type { Lang } from "../i18n/lang";
import { defineMessages, useLang, useTr } from "../i18n/useI18n";
import { SectionCardArt, TacticCardArt, isSectionCard } from "./CardArt";
import "./CommandCard.css";

const TEXT = defineMessages({
    es: {
        only: (types: string) => `Solo ${types}`,
        chosenSection: "Sección a elegir",
        perSection: (n: number) => `${n} por sección`,
        costsCoins: "Cuesta suministros",
        onTheMove: (n: number) => `+${n} en movimiento`,
        noMove: "Sin mover",
        closeAssault: "Asalto cercano",
        drawChoice: (n: number) => `Roba ${n}, elige 1`,
        reward: (coins: number) => `${coins} suministros + carta de combate`,
    },
    en: {
        only: (types: string) => `Only ${types}`,
        chosenSection: "Section of your choice",
        perSection: (n: number) => `${n} per section`,
        costsCoins: "Costs supplies",
        onTheMove: (n: number) => `+${n} on the move`,
        noMove: "No movement",
        closeAssault: "Close assault",
        drawChoice: (n: number) => `Draw ${n}, keep 1`,
        reward: (coins: number) => `${coins} supplies + combat card`,
    },
});

interface CommandCardProps {
    cardData: CommandCard;
    /** Without it the card is only shown, not a button */
    onClick?: (card: CommandCard) => void;
    /** Whose unit tokens the art shows */
    faction?: Faction;
}

/** A title longer than this, or with a word longer than LONG_WORD, goes on two lines, smaller */
const LONG_TITLE = 12;
const LONG_WORD = 10;

/** The length of a name's longest word: a word too long for the card's width would break in the middle */
export const longestWord = (name: string) => Math.max(...name.split(/\s+/).map((word) => word.length));

/** Short tags for the card's special rules, in the player's language; the description has the details */
export function ruleTags(card: CommandCard, lang: Lang): string[] {
    const t = TEXT[lang];
    const labels = LABELS[lang];
    const tags: string[] = [];
    if (card.unitTypes) tags.push(t.only(card.unitTypes.map((type) => labels.units[type].toLowerCase()).join(", ")));
    if (card.choosesSection) tags.push(t.chosenSection);
    if (card.perSection !== null) tags.push(t.perSection(card.perSection));
    if (card.paidInCoins) tags.push(t.costsCoins);
    if (card.onTheMove > 0) tags.push(t.onTheMove(card.onTheMove));
    if (card.noMove) tags.push(t.noMove);
    if (card.closeAssaultOnly) tags.push(t.closeAssault);
    if (card.drawChoice > 1) tags.push(t.drawChoice(card.drawChoice));
    if (card.endOfTurnReward) tags.push(t.reward(card.endOfTurnReward.coins));
    return tags;
}

/**
 * A command card, drawn like the game's: its title over a painting. A section
 * card shows its sections and order counts as arrows on a piece of board; a
 * tactic card a few words of what it does. Its full text is in its details
 * (CardDetails), shown when it is tapped.
 */
function CommandCardComponent({ cardData, onClick, faction = "Allies" }: CommandCardProps) {
    const lang = useLang();
    const tr = useTr();
    const section = isSectionCard(cardData);
    const title = tr(cardData.title);
    const Root = onClick ? "button" : "div";
    return (
        <Root
            {...(onClick ? { type: "button", onClick: () => onClick(cardData), "aria-label": tr(cardData.name) } : {})}
            className={`game-card command-card command-card--${section ? "section" : "tactic"}${onClick ? "" : " command-card--static"}`}
        >
            <span className="game-card__face">
                <span className="command-card__band">
                    <h3 className={`card-title${title.length > LONG_TITLE || longestWord(title) > LONG_WORD ? " card-title--long" : ""}`} lang={lang}>
                        {title}
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
