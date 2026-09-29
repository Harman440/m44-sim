import { useEffect, useRef, useState } from "react";
import { Box, useTheme } from "@mui/material";
import { AnimatePresence, motion } from "motion/react";
import { signedCoins } from "../labels";

interface CoinCountProps {
  coins: number;
}

/**
 * The number of coins. When it changes, it pops and the change ("+1", "−3")
 * floats up from it. It stays still on the first render, so opening a screen
 * doesn't animate. MotionConfig in GameView honours "reduce motion".
 */
function CoinCount({ coins }: CoinCountProps) {
  const { palette } = useTheme();
  const previous = useRef(coins);
  /** The last change, keyed so each one floats up on its own */
  const [change, setChange] = useState<{ amount: number; key: number } | null>(null);

  useEffect(() => {
    const amount = coins - previous.current;
    previous.current = coins;
    if (amount === 0) return;
    setChange((prev) => ({ amount, key: (prev?.key ?? 0) + 1 }));
    const done = setTimeout(() => setChange(null), 1200);
    return () => clearTimeout(done);
  }, [coins]);

  return (
    <Box component="span" sx={{ position: "relative", display: "inline-block" }}>
      <motion.span
        key={change?.key ?? 0}
        style={{ display: "inline-block" }}
        initial={change ? { scale: 1.45 } : false}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 14 }}
      >
        {coins}
      </motion.span>
      <AnimatePresence>
        {change && (
          <motion.span
            key={change.key}
            aria-hidden
            data-testid="coin-change"
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: 1, y: "-0.9em" }}
            exit={{ opacity: 0, y: "-1.4em" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{
              position: "absolute",
              left: "100%",
              top: 0,
              marginLeft: "0.15em",
              fontSize: "0.6em",
              fontWeight: 700,
              whiteSpace: "nowrap",
              pointerEvents: "none",
              color: change.amount < 0 ? palette.error.main : palette.success.main,
            }}
          >
            {signedCoins(change.amount)}
          </motion.span>
        )}
      </AnimatePresence>
    </Box>
  );
}

export default CoinCount;
