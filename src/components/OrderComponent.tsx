import { Position } from "../types/scenario";
import Order from "../game-core/order";

interface OrderProps {
  orderIndex: number;
  order: Order;
  getHexCenter: (position: Position) => { x: number; y: number };
  hexSize: number;
}

// Draws an order as an arrow along the unit's path, from start to destination
function OrderComponent({ orderIndex, order, getHexCenter, hexSize }: OrderProps) {
  // Hold-and-fire orders have no movement; the unit's ready-to-fire glow shows them
  if (order.start.row === order.end.row && order.start.col === order.end.col) {
    return null;
  }

  // If we have a full path, use it; otherwise fall back to direct line
  const pathToRender =
    order.path && order.path.length > 1 ? order.path : [order.start, order.end];

  // Convert path positions to screen coordinates
  const pathPoints = pathToRender.map((pos) => getHexCenter(pos));

  // Pull the tip back from the destination centre so it doesn't cover the unit
  const tip = pathPoints[pathPoints.length - 1]!;
  const beforeTip = pathPoints[pathPoints.length - 2]!;
  const dx = tip.x - beforeTip.x;
  const dy = tip.y - beforeTip.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const offset = hexSize * 0.5;
  pathPoints[pathPoints.length - 1] = {
    x: tip.x - (dx / length) * offset,
    y: tip.y - (dy / length) * offset,
  };

  // Create SVG path string for the route
  const createPathString = (points: { x: number; y: number }[]) =>
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  // Arrowhead at the (shortened) tip, pointing along the last segment
  const getArrowHead = (points: { x: number; y: number }[]) => {
    const lastPoint = points[points.length - 1]!;
    const arrowSize = 12;
    const arrowAngle = Math.PI / 6; // 30 degrees
    const forwardAngle = Math.atan2(dy, dx);

    const arrowHead1 = {
      x: lastPoint.x - arrowSize * Math.cos(forwardAngle - arrowAngle),
      y: lastPoint.y - arrowSize * Math.sin(forwardAngle - arrowAngle),
    };
    const arrowHead2 = {
      x: lastPoint.x - arrowSize * Math.cos(forwardAngle + arrowAngle),
      y: lastPoint.y - arrowSize * Math.sin(forwardAngle + arrowAngle),
    };

    return { lastPoint, arrowHead1, arrowHead2 };
  };

  const pathString = createPathString(pathPoints);
  const arrowHead = getArrowHead(pathPoints);

  // Different colors based on order key
  const orangeShades = [
    "#992600", // dark reddish-brown orange
    "#cc3300", // deep burnt orange
    "#e65c00", // strong vivid orange
    "#ff6600", // bright orange
    "#ff884d", // warm amber-orange
    "#b34700"  // earthy orange-brown
  ];
  const getArrowColor = (orderIndex: number = 0) => {
    return orangeShades[orderIndex % orangeShades.length];
  };

  const color = getArrowColor(orderIndex);

  return (
    <g className="order-arrow">
      {/* Path line */}
      <path
        d={pathString}
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Arrow head */}
      <polygon
        points={`${arrowHead.lastPoint.x},${arrowHead.lastPoint.y} ${
          arrowHead.arrowHead1.x
        },${arrowHead.arrowHead1.y} ${arrowHead.arrowHead2.x},${
          arrowHead.arrowHead2.y
        }`}
        fill={color}
      />
    </g>
  );
}

export default OrderComponent;
