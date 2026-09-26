import { Position } from "../types/scenario";
import Order from "../game-core/order";
import { samePosition } from "../game-core/position";

interface OrderProps {
  orderIndex: number;
  order: Order;
  getHexCenter: (position: Position) => { x: number; y: number };
  hexSize: number;
}

// Different colors based on order index
const orangeShades = [
  "#992600", // dark reddish-brown orange
  "#cc3300", // deep burnt orange
  "#e65c00", // strong vivid orange
  "#ff6600", // bright orange
  "#ff884d", // warm amber-orange
  "#b34700"  // earthy orange-brown
];

/** Arrow colour for the order at `orderIndex`; the battle summary uses it too */
export const orderColor = (orderIndex: number = 0): string =>
  orangeShades[orderIndex % orangeShades.length]!;

// Draws an order as an arrow along the unit's path, from start to destination
function OrderComponent({ orderIndex, order, getHexCenter, hexSize }: OrderProps) {
  // Hold-and-fire orders have no movement; the unit's ready-to-fire glow shows them
  if (samePosition(order.start, order.end)) {
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
    const arrowSize = 16;
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

  const color = orderColor(orderIndex);

  return (
    <g className="order-arrow" filter="url(#board-pencil)">
      {/* Dark underline so the arrow reads on any terrain */}
      <path
        d={pathString}
        stroke="rgba(20, 16, 10, 0.55)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d={pathString}
        stroke={color}
        strokeWidth="5"
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
        stroke="rgba(20, 16, 10, 0.55)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </g>
  );
}

export default OrderComponent;
