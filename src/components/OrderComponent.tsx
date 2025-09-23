import React from "react";
import { Position } from "../types/scenario";
import Order from "../game-core/order";

interface OrderProps {
  orderIndex: number;
  order: Order;
  getHexCenter: (position: Position) => { x: number; y: number };
  hexSize: number;
}

//NOTE: Code mostly generated. First point in path is actually the last
function OrderComponent({ orderIndex, order, getHexCenter, hexSize }: OrderProps) {
  // If we have a full path, use it; otherwise fall back to direct line
  const pathToRender =
    order.path && order.path.length > 1 ? order.path : [order.start, order.end];

  // Convert path positions to screen coordinates
  const pathPoints = pathToRender.map((pos) => getHexCenter(pos));

  // Shorten the first segment to avoid overlapping with the unit/hex center
  if (pathPoints.length >= 2) {
    const firstPoint = pathPoints[0];
    const secondPoint = pathPoints[1];

    // Calculate direction from first to second point
    const dx = secondPoint!.x - firstPoint!.x;
    const dy = secondPoint!.y - firstPoint!.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    // Offset the start point towards the second point
    const offset = hexSize * 0.5; // Adjust this value to control how far from hex center the arrow starts
    const unitX = dx / length;
    const unitY = dy / length;

    pathPoints[0] = {
      x: firstPoint!.x + unitX * offset,
      y: firstPoint!.y + unitY * offset,
    };
  }

  // Create SVG path string for the route
  const createPathString = (points: { x: number; y: number }[]) => {
    if (points.length < 2) return "";

    let pathString = `M ${points[0]?.x} ${points[0]?.y}`;
    for (let i = 1; i < points.length; i++) {
      pathString += ` L ${points[i]?.x} ${points[i]?.y}`;
    }
    return pathString;
  };

  // Calculate arrowhead at the end of the path
  const getArrowHead = (points: { x: number; y: number }[]) => {
    if (points.length < 2) return null;

    const lastPoint = points[0]; //NOTE: points seem to be backwards
    const secondLastPoint = points[1];

    // Calculate direction FROM secondLast TO last (forward direction)
    const dx = lastPoint!.x - secondLastPoint!.x;
    const dy = lastPoint!.y - secondLastPoint!.y;

    const arrowSize = 12;
    const arrowAngle = Math.PI / 6; // 30 degrees

    // Calculate the angle of the forward direction
    const forwardAngle = Math.atan2(dy, dx);

    // Arrowhead points should go backwards from the tip
    const arrowHead1 = {
      x: lastPoint!.x - arrowSize * Math.cos(forwardAngle - arrowAngle),
      y: lastPoint!.y - arrowSize * Math.sin(forwardAngle - arrowAngle),
    };

    const arrowHead2 = {
      x: lastPoint!.x - arrowSize * Math.cos(forwardAngle + arrowAngle),
      y: lastPoint!.y - arrowSize * Math.sin(forwardAngle + arrowAngle),
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
      {arrowHead && (
        <polygon
          points={`${arrowHead.lastPoint!.x},${arrowHead.lastPoint!.y} ${
            arrowHead.arrowHead1.x
          },${arrowHead.arrowHead1.y} ${arrowHead.arrowHead2.x},${
            arrowHead.arrowHead2.y
          }`}
          fill={color}
        />
      )}
    </g>
  );
}

export default OrderComponent;
