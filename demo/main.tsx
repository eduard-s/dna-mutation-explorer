import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { MutationExplorer, DnaDamageLab } from "../src/react/index.js";
import "../src/react/styles.css";
import "../src/react/playground.css";
import "../src/react/damage-lab.css";
import "./demo.css";

function Demo() {
  const [showExplorer, setShowExplorer] = useState(false);
  return <div className="demo-shell">
    <a className="demo-skip" href="#explorer">Skip to the explorer</a>
    <header className="demo-header"><a className="demo-author" href="https://esmirnov.ai/">esmirnov.ai</a>
      <nav aria-label="Package links"><a href="https://github.com/eduard-s/dna-mutation-explorer">GitHub</a><a href="https://www.npmjs.com/package/dna-mutation-explorer">npm</a></nav></header>
    <main>
      <div className="demo-intro"><h1>DNA damage lab<span>.</span></h1><p>Expose the DNA to different conditions. Add protection. Watch which damage forms and which protection helps.</p></div>
      <div id="explorer"><DnaDamageLab /></div>
      <details className="demo-advanced" onToggle={event => setShowExplorer(event.currentTarget.open)}><summary>Open the detailed DNA explorer</summary>
        {showExplorer && <MutationExplorer />}</details>
      <section className="demo-package" aria-labelledby="package-title"><div><h2 id="package-title">Use it in your project</h2>
        <p>The npm package has a TypeScript core and an optional React component.</p><p>Use the same component as this demo.</p>
        <p><a href="https://github.com/eduard-s/dna-mutation-explorer#readme">Read the installation guide</a></p></div>
        <pre><code>{`npm install dna-mutation-explorer

import { DnaDamageLab } from "dna-mutation-explorer/react";
import "dna-mutation-explorer/styles.css";

<DnaDamageLab />`}</code></pre></section>
      <section className="demo-science" aria-labelledby="model-title"><h2 id="model-title">What the model explains</h2>
        <p>The lab separates UV dimers, strand breaks, oxidized bases, and heat-driven strand separation.</p>
        <p>Filters, radical scavengers, and repair act through different mechanisms.</p>
        <p>The controls use relative settings. The model does not calculate physical doses or health risk.</p>
        <p>The sample is synthetic. <a href="https://github.com/eduard-s/dna-mutation-explorer/blob/main/docs/MODEL.md">Read the model and biology sources.</a></p></section>
    </main>
    <footer className="demo-footer"><span>Eduard Smirnov</span><a href="https://github.com/eduard-s/dna-mutation-explorer/blob/main/LICENSE">MIT license</a>
      <a href="https://esmirnov.ai/nematic-game/">Nematic game</a></footer>
  </div>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><Demo /></StrictMode>);
