import React from "react";
import { Position } from "../types/scenario";
import Order from "../game-core/order";

interface OrderProps {
  order: Order;
  getHexCenter: (position: Position) => { x: number; y: number };
}

function OrderComponent({ order, getHexCenter }: OrderProps) {
  // If we have a full path, use it; otherwise fall back to direct line
  const pathToRender =
    order.path && order.path.length > 1 ? order.path : [order.start, order.end];

  // Convert path positions to screen coordinates
  const pathPoints = pathToRender.map((pos) => getHexCenter(pos));

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

  const color = "#ff8800";

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
