# Design

The interface uses the existing esmirnov.ai visual system.
The page surface is pale sage #DFE5DC.
The text is green-charcoal #303832.
The accent is dark clay #785448.
Secondary surfaces use #EFF2ED.

Use Arial for text and headings.
Use Courier New for sequences, metadata, and controls.
Keep the interface light for a reader at a desk in daylight.

Use thin rules to separate the sequence comparison, controls, and result.
Use no cards, shadows, or gradients.
Keep labels visible beside their controls.
Give each control a target of at least 44 pixels.

Put controls below the sequence comparison on narrow screens.
Keep horizontal sequence scroll inside a labeled region when necessary.
Use a responsive sequence window for long input.

Put the DNA playground first in the component.
Use native buttons for the coding-strand letters.
Give each button the selected mutation action.
Use the same action for click, tap, Enter, and Space.
Each tool works without a drag action.

Put "Swap a letter", "Cut one base", "Cut one codon", and "Add a base" near the coding strand.
Keep the base palette visible beside the insertion tool.
Show "Reset mutation" near the tools.
Show the original and edited protein chains near the DNA.
Use full amino-acid names in the focused-codon explanation.

Cap each chain preview at 24 symbols.
Keep the full amino-acid count visible.
Show the truncation note when more symbols exist.
Use the sequence comparison and export for the rest.

Highlight the default base without a mutation.
Show the one-edit rule near the tools.
Put the custom sequence and exact-position form in a native details element.
Use "Edit a custom sequence or exact positions" as its summary.
Keep guided challenges after the playground.

Link the selected DNA base with its codon and amino acid.
A compact helix can show this same selection.
The helix must show useful sequence information.

Honor reduced-motion preferences.
Use semantic HTML, keyboard controls, visible focus, and concise status messages.
Prefix component selectors with dme to prevent host-page conflicts.
Expose CSS custom properties for host colors.
