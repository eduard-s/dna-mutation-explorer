import { readFile, writeFile, mkdir } from "node:fs/promises";
await mkdir(new URL("../dist/", import.meta.url), { recursive: true });
const styles = await Promise.all(["styles.css", "playground.css", "damage-lab.css"].map(file => readFile(new URL(`../src/react/${file}`, import.meta.url), "utf8")));
await writeFile(new URL("../dist/styles.css", import.meta.url), styles.join("\n"));
