import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const temp = mkdtempSync(join(tmpdir(), "dna-package-"));
const npm = (args, cwd = temp) => execFileSync("npm", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const node = (source) => execFileSync(process.execPath, ["--input-type=module", "-e", source], { cwd: temp, encoding: "utf8" });

try {
  const [pack] = JSON.parse(npm(["pack", "--json", "--ignore-scripts", "--pack-destination", temp], root));
  const paths = pack.files.map(({ path }) => path);
  for (const name of ["dist/core/index.js", "dist/core/index.d.ts", "dist/react/index.js", "dist/react/index.d.ts", "dist/styles.css", "README.md", "LICENSE"]) {
    assert(paths.includes(name), `The package must contain ${name}.`);
  }
  assert(!paths.some(path => /(?:node_modules|demo-dist|\.env|\.tgz|\.git)/.test(path)));
  writeFileSync(join(temp, "package.json"), JSON.stringify({ private: true, type: "module" }));
  npm(["install", "--ignore-scripts", "--no-audit", "--no-fund", resolve(temp, pack.filename)]);
  const lock = JSON.parse(readFileSync(join(temp, "package-lock.json"), "utf8"));
  assert(!lock.packages["node_modules/react"], "The core must install without React.");
  const installedRoot = join(temp, "node_modules", "@esmirnov.ai", "dna-mutation-explorer");
  const installedManifest = JSON.parse(readFileSync(join(installedRoot, "package.json"), "utf8"));
  assert.equal(installedManifest.name, "@esmirnov.ai/dna-mutation-explorer");
  assert.equal(installedManifest.version, "0.4.1");
  assert(readFileSync(join(installedRoot, "dist", "styles.css"), "utf8").length > 0, "The scoped package must include its stylesheet.");
  assert(lock.packages["node_modules/@esmirnov.ai/dna-mutation-explorer"], "The consumer must install the scoped package.");
  assert(!lock.packages["node_modules/dna-mutation-explorer"], "The consumer must not install the former package name.");
  writeFileSync(join(temp, "consumer.ts"), `
    import { analyzeCodingEdit, type CodingEdit } from '@esmirnov.ai/dna-mutation-explorer';
    import { translateDna } from '@esmirnov.ai/dna-mutation-explorer/core';
    import { CHALLENGES } from '@esmirnov.ai/dna-mutation-explorer/lessons';
    import { createDamageLab, getDamageMetrics } from '@esmirnov.ai/dna-mutation-explorer/playground';
    const edit: CodingEdit = { start: 5, deleteCount: 1, insert: 'G' };
    const result = analyzeCodingEdit('ATGGAACTGTAA', edit);
    const protein: string = translateDna('ATGGAACTGTAA').protein;
    const damage = getDamageMetrics(createDamageLab(600, 420));
    void [result, protein, damage, CHALLENGES];
  `);
  execFileSync(process.execPath, [join(root, "node_modules", "typescript", "bin", "tsc"), "--noEmit", "--strict", "--skipLibCheck", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--target", "ES2020", "consumer.ts"], { cwd: temp, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const result = JSON.parse(node(`
    import { analyzeCodingEdit } from '@esmirnov.ai/dna-mutation-explorer';
    import { translateDna } from '@esmirnov.ai/dna-mutation-explorer/core';
    import { CHALLENGES } from '@esmirnov.ai/dna-mutation-explorer/lessons';
    import { createDamageLab, pulseDamage, getDamageMetrics, setDnaProtectors } from '@esmirnov.ai/dna-mutation-explorer/playground';
    if (CHALLENGES.length !== 8) throw new Error('The lesson export must contain eight challenges.');
    const lab = createDamageLab(600, 420, { species: 'bare', protectors: { repair: 0 } });
    lab.dna.paused = true;
    pulseDamage(lab, 'uv');
    if (getDamageMetrics(lab).dimers !== 1) throw new Error('A UV pulse must create a same-strand dimer.');
    setDnaProtectors(lab, { uvFilter: 1 });
    pulseDamage(lab, 'uv');
    if (getDamageMetrics(lab).dimers !== 1 || getDamageMetrics(lab).blocked !== 1) throw new Error('The UV filter must block another UV lesion.');
    const result = analyzeCodingEdit('ATGGAACTGTAA', { start: 5, deleteCount: 1, insert: 'G' });
    process.stdout.write(JSON.stringify({ consequence: result.consequence, protein: translateDna('ATGGAACTGTAA').protein }));
  `));
  assert.deepEqual(result, { consequence: "synonymous", protein: "MEL*" });
  for (const version of ["18.3.1", "19.2.6"]) {
    npm(["install", "--ignore-scripts", "--no-audit", "--no-fund", `react@${version}`, `react-dom@${version}`]);
    const markup = node(`
      import React from 'react';
      import { renderToString } from 'react-dom/server';
      import { MutationExplorer, DnaDamageLab, DnaPlayground } from '@esmirnov.ai/dna-mutation-explorer/react';
      process.stdout.write(renderToString(React.createElement(React.Fragment, null, React.createElement(DnaDamageLab), React.createElement(DnaPlayground), React.createElement(MutationExplorer))));
    `);
    assert(markup.includes("DNA"));
    assert(markup.includes("<button"));
    assert(markup.includes("DNA damage and protection lab"));
    console.log(`React ${version}: the component renders on the server.`);
  }
  console.log(`Package smoke tests passed. ${paths.length} files, ${pack.size} compressed bytes.`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
