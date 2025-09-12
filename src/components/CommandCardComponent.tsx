import CommandCard from "../game-core/commandCard"

interface CommandCardProps {
    cardData: CommandCard,
    onClick: (card: CommandCard) => void
}

function CommandCardComponent ({
    cardData,
    onClick,
}: CommandCardProps) {

    const handleCardClick = () => {
        onClick(cardData);
    }
    
    return (
        <div>
            <button
                key={cardData.id}
                onClick={() => handleCardClick()}
                className={` text-white p-2 rounded text-sm hover:opacity-80`}
              >
                {cardData.name} ({cardData.maxTotalOrders} actions)
            </button>
        </div>
    )
}

export default CommandCardComponent;