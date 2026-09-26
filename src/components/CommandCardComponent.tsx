import CommandCard from "../game-core/commandCard";
import "./CommandCard.css";
import defaultImage from "../assets/cards/default.webp";
import cardTemplate from "../assets/cards/template.webp";

interface CommandCardProps {
    cardData: CommandCard;
    onClick: (card: CommandCard) => void;
}

function CommandCardComponent({ cardData, onClick }: CommandCardProps) {
    return (
        <div className={`command-card ${cardData.type}`} onClick={() => onClick(cardData)}>
            {/* Faded card template behind the text */}
            <div className="card-overlay">
                <img src={cardTemplate} alt="" className="card-image" />
            </div>

            <div className="card-content">
                <div className="card-header">
                    <h3 className="card-title">{cardData.name}</h3>
                </div>

                <div className="card-image-container">
                    <img src={defaultImage} alt="" className="card-image" />
                </div>

                <div className="card-description">{cardData.description}</div>
            </div>
        </div>
    );
}

export default CommandCardComponent;
