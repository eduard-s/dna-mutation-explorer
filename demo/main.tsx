import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MutationExplorer } from "../src/react/index.js";
import "../src/react/styles.css";
import "./demo.css";

function Demo() {
  return <div className="demo-shell">
    <a className="demo-skip" href="#explorer">Skip to the explorer</a>
    <header className="demo-header"><a className="demo-author" href="https://esmirnov.ai/">esmirnov.ai</a>
      <nav aria-label="Package links"><a href="https://github.com/eduard-s/dna-mutation-explorer">GitHub</a><a href="https://www.npmjs.com/package/dna-mutation-explorer">npm</a></nav></header>
    <main>
      <div className="demo-intro"><h1>DNA mutation explorer<span>.</span></h1><p>Change a DNA sequence. Discover what changes in its protein.</p>
        <p className="demo-local">All sequence analysis stays in your browser.</p></div>
      <div id="explorer"><MutationExplorer /></div>
      <section className="demo-package" aria-labelledby="package-title"><div><h2 id="package-title">Use it in your project</h2>
        <p>The npm package has a TypeScript core and an optional React component.</p><p>Use the same component as this demo.</p>
        <p><a href="https://github.com/eduard-s/dna-mutation-explorer#readme">Read the installation guide</a></p></div>
        <pre><code>{`npm install dna-mutation-explorer

import { MutationExplorer } from "dna-mutation-explorer/react";
import "dna-mutation-explorer/styles.css";

<MutationExplorer />`}</code></pre></section>
      <section className="demo-science" aria-labelledby="model-title"><h2 id="model-title">What the model explains</h2>
        <p>The explorer uses a coding DNA sequence and the <a href="https://www.ncbi.nlm.nih.gov/Taxonomy/Utils/wprintgc.cgi#SG1">NCBI standard genetic code</a>.
          It compares sequence consequences after one edit.</p>
        <p>It does not predict protein structure, protein function, disease risk, gene expression, or splicing.</p>
        <p>The examples use a synthetic sequence. They do not represent a gene from an organism.</p></section>
    </main>
    <footer className="demo-footer"><span>Eduard Smirnov</span><a href="https://github.com/eduard-s/dna-mutation-explorer/blob/main/LICENSE">MIT license</a>
      <a href="https://esmirnov.ai/nematic-game/">Nematic game</a></footer>
  </div>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><Demo /></StrictMode>);
