import { Position } from '../types/scenario';
import Order from '../game-core/order';

interface OrderProps {
  order: Order;
  hexSize: number;
  getHexCenter: (position: Position) => { x: number; y: number };
}

//TODO: represent arrow with actual hexes it has moved through not start to end
function OrderComponent({ order, hexSize, getHexCenter }: OrderProps) {
  const startCenter = getHexCenter(order.start);
  const endCenter = getHexCenter(order.end);
  
  // Calculate arrow direction
  const dx = endCenter.x - startCenter.x;
  const dy = endCenter.y - startCenter.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  
  // Normalize direction
  const unitX = dx / length;
  const unitY = dy / length;
  
  // Offset start and end points to avoid overlapping with hex centers
  const offset = hexSize * 0.6; // Adjust this value to control how close arrows get to hex edges
  const adjustedStart = {
    x: startCenter.x + unitX * offset,
    y: startCenter.y + unitY * offset
  };
  const adjustedEnd = {
    x: endCenter.x - unitX * offset,
    y: endCenter.y - unitY * offset
  };
  
  // Calculate arrowhead points
  const arrowSize = 12;
  const arrowAngle = Math.PI / 6; // 30 degrees
  
  const arrowHead1 = {
    x: adjustedEnd.x - arrowSize * Math.cos(Math.atan2(dy, dx) - arrowAngle),
    y: adjustedEnd.y - arrowSize * Math.sin(Math.atan2(dy, dx) - arrowAngle)
  };
  
  const arrowHead2 = {
    x: adjustedEnd.x - arrowSize * Math.cos(Math.atan2(dy, dx) + arrowAngle),
    y: adjustedEnd.y - arrowSize * Math.sin(Math.atan2(dy, dx) + arrowAngle)
  };
    
  const color = '#ff8800';

  return (
    <g className="order-arrow">
      {/* Arrow line */}
      <line
        x1={adjustedStart.x}
        y1={adjustedStart.y}
        x2={adjustedEnd.x}
        y2={adjustedEnd.y}
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
      />
      
      {/* Arrow head */}
      <polygon
        points={`${adjustedEnd.x},${adjustedEnd.y} ${arrowHead1.x},${arrowHead1.y} ${arrowHead2.x},${arrowHead2.y}`}
        fill={color}
      />
    </g>
  );
}

export default OrderComponent;