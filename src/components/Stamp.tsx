import type { ReactNode } from "react";
import { motion } from "motion/react";
import "./Stamp.css";

interface StampProps {
  children: ReactNode;
  /** Tilt in degrees */
  angle?: number;
  size?: "small" | "large";
  className?: string;
}

/** A rubber stamp that slams down when it appears ("ÓRDENES CONFIRMADAS", "DISPARÓ") */
function Stamp({ children, angle = -8, size = "small", className = "" }: StampProps) {
  return (
    <motion.span
      className={`stamp stamp--${size} ${className}`}
      initial={{ scale: 1.8, opacity: 0, rotate: angle - 6 }}
      animate={{ scale: 1, opacity: 1, rotate: angle }}
      transition={{ type: "spring", stiffness: 500, damping: 26 }}
    >
      {children}
    </motion.span>
  );
}

export default Stamp;
