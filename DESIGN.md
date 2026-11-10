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

The signature interaction links a selected DNA base with its codon and amino acid.
A compact helix can show this same selection.
The helix must show useful sequence information.

Honor reduced-motion preferences.
Use semantic HTML, keyboard controls, visible focus, and concise status messages.
Prefix component selectors with dme to prevent host-page conflicts.
Expose CSS custom properties for host colors.
