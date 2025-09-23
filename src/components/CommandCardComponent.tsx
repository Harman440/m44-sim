import CommandCard from "../game-core/commandCard";
import "./CommandCard.css";

interface CommandCardProps {
    cardData: CommandCard;
    onClick: (card: CommandCard) => void;
    variant?: 'default' | 'offensive' | 'defensive' | 'utility' | 'special';
}

function CommandCardComponent({
    cardData,
    onClick,
    variant = 'default'
}: CommandCardProps) {
    const handleCardClick = () => {
        onClick(cardData);
    };

    // You can determine the variant based on card properties
    const getCardVariant = () => {
        // Example logic - adjust based on your CommandCard structure
        if (cardData.type) {
            switch (cardData.type.toLowerCase()) {
                case 'attack':
                case 'offensive':
                    return 'offensive';
                case 'defense':
                case 'defensive':
                    return 'defensive';
                case 'utility':
                case 'support':
                    return 'utility';
                case 'special':
                case 'legendary':
                    return 'special';
                default:
                    return variant;
            }
        }
        return variant;
    };

    return (
        <div
            className={`command-card ${getCardVariant()}`}
            onClick={handleCardClick}
        >
            {/* Card Header */}
            <div className="card-header">
                <h3 className="card-title">{cardData.name}</h3>
                <div className="card-actions">
                    {cardData.maxTotalOrders} actions
                </div>
            </div>

            {/* Card Image */}
            <div className="card-image-container">
                {cardData.image ? (
                    <img
                        src={cardData.image}
                        alt={cardData.name}
                        className="card-image"
                        onError={(e) => {
                            // Fallback if image fails to load
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const placeholder = target.parentElement?.querySelector('.card-image-placeholder');
                            if (placeholder) {
                                (placeholder as HTMLElement).style.display = 'flex';
                            }
                        }}
                    />
                ) : null}
                <div
                    className="card-image-placeholder"
                    style={{ display: cardData.image ? 'none' : 'flex' }}
                >
                    ⚔️
                </div>
            </div>

            {/* Card Description */}
            <div className="card-description">
                {cardData.description || "A powerful command card that can change the tide of battle."}
            </div>

            {/* Card Diagram/Stats */}
            <div className="card-diagram">
                <div className="diagram-icon">
                    📊
                </div>
                <div className="diagram-text">
                    {cardData.diagram || `ID: ${cardData.id}`}
                </div>
            </div>
        </div>
    );
}

export default CommandCardComponent;