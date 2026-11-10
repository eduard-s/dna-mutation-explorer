# Design

The interface uses the existing esmirnov.ai visual system.
The page surface is pale sage #DFE5DC.
The text is green-charcoal #303832.
The accent is dark clay #785448.
Secondary surfaces use #EFF2ED.

Use Arial for text and headings.
Use Courier New for sequences, metadata, and controls.
Keep the interface light for a reader at a desk in daylight.

Use thin rules to separate the canvas, controls, and readouts.
Use no cards, shadows, or gradients.
Keep labels visible beside their controls.
Give each control a target of at least 44 pixels.

Put a large DNA damage canvas first.
Show the DNA, exposure particles, and protection events in the same field.
Use flexible double-helix geometry with letters and visible base pairs.
Let the pointer move DNA or apply a selected factor.
Keep pointer forces local and bounded.

Keep exposure and protection controls visible near the canvas.
Give each factor a native control and a relative value.
Show species context without a resistance score.
Keep pause and reset visible.
Put controls in document flow on phones.
Preserve normal document scroll and pinch zoom.

Give dimers, strand breaks, and oxidized bases different states.
Use letters and labels with color.
Keep readouts about actual model state.
Use no scores, rounds, or win screens in the main playground.

Show the selected mechanism in a schematic atomic view.
Use excitation, electron ejection, reactive oxygen, and bond changes as separate events.
Do not draw electron paths as literal planetary orbits.
Label the atomic view as schematic.
Keep stage descriptions brief and specific.

Keep the advanced `MutationExplorer` in an optional section.
Its detailed sequence view uses a responsive window for long input.
Its chain preview keeps the existing 24-symbol limit and full counts.
Its export includes the full result.

Keep `DnaPlayground` as an optional copy-and-repair utility.

Honor reduced-motion preferences.
Use semantic HTML, keyboard controls, visible focus, and concise status messages.
Prefix component selectors to prevent host-page conflicts.
Expose CSS custom properties for host colors.
