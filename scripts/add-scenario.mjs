// Add a map exported from the app (Exportar in Mis mapas: <id>.m44map.json) to the catalog, so
// every device has it once the app updates (a push to main deploys it).
// Usage: npm run add-scenario -- [--check] [--replace] <file>
//   --check    only check the file (parseScenario), writing nothing
//   --replace  update a map already in the catalog (its notes are kept if the file has none)
//
// It writes src/data/catalog/<id>.json as exported (data/catalog.ts's catalogFile: the id, terrain
// and units unchanged, so a game in progress on the device's copy goes on with the catalog's), adds
// the board to scripts/boards.json, and paints its art with `npm run board`, drawing the rivers when
// no river tile fits a bend. A board bigger than the standard 13×9, or with a river fork no tile
// fits, isn't painted: the app draws its art, as it does in the map editor.
// The app's code (parseScenario, the built-ins) is loaded through Vite, as the dev server would.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { runnerImport } from "vite";

const load = async (path) => (await runnerImport(path, { configFile: false, logLevel: "error" })).module;
const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const args = process.argv.slice(2);
const check = args.includes("--check");
const replace = args.includes("--replace");
const [path, ...extra] = args.filter((arg) => !arg.startsWith("--"));
if (!path || extra.length) fail("Usage: npm run add-scenario -- [--check] [--replace] <file exported from Mis mapas>");

let json;
try {
  json = JSON.parse(readFileSync(path, "utf8"));
} catch (error) {
  fail(`${path}: ${error.message}`);
}

const { catalogFile, formatJson } = await load("/src/data/catalog.ts");
const { scenarios } = await load("/src/data/scenarios.ts");
const catalogPath = (id) => `src/data/catalog/${id}.json`;
// The built-ins are the scenarios that aren't catalog files
const reserved = scenarios.map(({ id }) => id).filter((id) => !existsSync(catalogPath(id)));
const id = typeof json?.id === "string" ? json.id : "";
const target = catalogPath(id);
const replacing = id && existsSync(target) ? JSON.parse(readFileSync(target, "utf8")) : undefined;

let file;
try {
  file = catalogFile(json, { reserved, replacing });
} catch (error) {
  fail(`${path} can't go into the catalog:\n${error.message}`);
}
const name = `${file.name.es}${file.name.en !== file.name.es ? ` / ${file.name.en}` : ""}`;
if (check) {
  console.log(`${path}: ${name} (${file.id}) can be played${replacing ? `; it's in the catalog already (--replace to update it)` : ""}`);
  process.exit(0);
}
if (replacing && !replace) fail(`${target} is in the catalog already: add --replace to update it`);

mkdirSync("src/data/catalog", { recursive: true });
writeFileSync(target, formatJson(file));
console.log(`${target}: ${name}${replacing ? " (updated)" : ""}`);

// Its board in scripts/boards.json, then its art painted. A map that can't be painted (bigger than
// 13×9, or a river fork no tile fits) is left without: the app draws its art, as in the map editor
const BOARDS = "scripts/boards.json";
const boards = JSON.parse(readFileSync(BOARDS, "utf8"));
const saveBoards = () => writeFileSync(BOARDS, formatJson(boards, Infinity));
let board = boards.find((each) => each.terrain === target);
const unpainted = (why) => {
  if (board) {
    boards.splice(boards.indexOf(board), 1);
    saveBoards();
  }
  // No art from an earlier version of the map
  rmSync(board?.image ?? `src/assets/scenarios/${file.id}.webp`, { force: true });
  console.log(`${why}: it isn't painted, the app draws its art (as in the map editor)`);
};
if (file.board !== "standard") unpainted(`A ${file.board.cols}×${file.board.rows} board`);
else {
  if (!board) {
    board = { terrain: target, image: `src/assets/scenarios/${file.id}.webp` };
    boards.push(board);
    saveBoards();
  }
  const paint = () => spawnSync(process.execPath, ["scripts/compose-board.mjs", target], { stdio: ["inherit", "inherit", "pipe"], encoding: "utf8" });
  let painted = paint();
  if (painted.status !== 0 && painted.stderr.includes("No painted river tile joins") && !board.drawn?.includes("river")) {
    console.log("No river tile fits a bend of its rivers: they're drawn instead");
    board.drawn = [...(board.drawn ?? []), "river"];
    saveBoards();
    painted = paint();
  }
  if (painted.status !== 0 && /River at .* joins more than three|No painted river tile forks/.test(painted.stderr)) unpainted("A river fork no tile fits");
  else if (painted.status !== 0) fail(`${painted.stderr}\nThe board art failed: fix ${BOARDS}'s entry and run npm run board -- ${target}`);
}

console.log(`
Then, by hand:
- the description in both languages, if the map has none, and the sources and rulings in "notes"
- "drawn" or "separateHills" in scripts/boards.json if the art needs them (then npm run board -- ${target})
- tests for any special rule
- npm run check, and push to main: every device gets the map when the app updates`);
