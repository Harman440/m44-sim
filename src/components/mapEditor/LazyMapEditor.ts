import { lazyWithPreload } from "../../lazyWithPreload";

/** The map editor (board, board art, tools) in its own chunk, loaded when the menu opens it */
const LazyMapEditor = lazyWithPreload(() => import("./MapEditor"));

export default LazyMapEditor;
