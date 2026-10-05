import { ReactNode } from "react";
import { motion, useMotionValue, useTransform } from "motion/react";
import "./CardFlip.css";

/**
 * A card turned over as it lands: it comes in face down and flips to its
 * face. Key it by the card so each card flips in. With reduced motion
 * (GameView's MotionConfig) it is simply there.
 */
function CardFlip({ children }: { children: ReactNode }) {
  const turn = useMotionValue(180);
  // Past a quarter turn the back is what faces the player
  const backOpacity = useTransform(turn, (deg) => (Math.abs(deg) > 90 ? 1 : 0));

  return (
    <motion.div
      className="card-flip"
      style={{ rotateY: turn, transformPerspective: 900 }}
      initial={{ rotateY: 180, y: -24, scale: 0.92 }}
      animate={{ rotateY: 0, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 140, damping: 16 }}
    >
      {children}
      <motion.div className="card-back card-flip__back" aria-hidden style={{ opacity: backOpacity }}>
        <span className="card-back__mark">M'44</span>
      </motion.div>
    </motion.div>
  );
}

export default CardFlip;
