import CommandCard from "../game-core/commandCard";
import "./CommandCard.css";
import defaultImage from "../assets/cards/default.png";
import cardTemplate from "../assets/cards/template.jpg";

interface CommandCardProps {
    cardData: CommandCard;
    onClick: (card: CommandCard) => void;
    variant?: 'default' | 'offensive' | 'defensive' | 'utility' | 'special';
}

function CommandCardComponent({
    cardData,
    onClick,
}: CommandCardProps) {
    const handleCardClick = () => {
        onClick(cardData);
    };

    const image = defaultImage;
    const diagram = null;

    return (
        <div
            className={`command-card ${cardData.type}`}
            onClick={handleCardClick}
        >
            {/* Background overlay for better text readability */}
            <div className="card-overlay">
                {cardTemplate ? (
                    <img src={cardTemplate} alt={cardData.name} className="card-image"/>
                ) : null}
            </div>

            {/* Card Content - layered on top */}
            <div className="card-content">
                {/* Card Header */}
                <div className="card-header">
                    <h3 className="card-title">{cardData.name}</h3>
                </div>

                {/* Card Image */}
                <div className="card-image-container">
                    {image ? (
                        <img
                            src={image}
                            alt={cardData.name}
                            className="card-image"
                        />
                    ) : null}
                    <div
                        className="card-image-placeholder"
                        style={{ display: image ? 'none' : 'flex' }}
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
                    <div className="diagram">
                        📊
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CommandCardComponent;