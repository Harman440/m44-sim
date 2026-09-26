import { lazyWithPreload } from "../../lazyWithPreload";

/** The game screen and everything only it uses (board, motion, fire dialog) in its own chunk */
const LazyGameView = lazyWithPreload(() => import("./GameView"));

export default LazyGameView;
