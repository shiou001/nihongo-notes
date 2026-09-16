# Learning audit implementation — 2026-09-16

Scope: implement all findings from the 2026-09-15 public-site audit in this existing GitHub Pages app. Retain the handwritten brand, static architecture, Notion sync and Supabase progress. The parent workspace's Three.js visual passes concern a different project.

1. Correct audited teaching statements through a versioned editorial transform before learning-data extraction. Preserve raw Notion caches and stable existing item IDs where possible; corrections must survive scheduled sync. Add source references, classification, clean examples and focused lesson links.
2. Remove answer leakage; add optional hints and kana input / contextual cloze practice. Improve distractor selection without introducing multiple correct answers. Keep all existing quiz families.
3. Add an explicit device-local level, goal and weekly study target; scope daily vocabulary to that level. Prioritize due reviews, then a small new-word allowance; don't silently replace scope with all levels.
4. Count independent correct recall on spaced days for mastery; hints and same-day repeats cannot establish mastery. Preserve prior counts, cloud merge shape and migration compatibility. Show next due times, selected answers and per-skill results.
5. Derive weekly estimates from remaining site vocabulary and the selected weekly target. Mark advanced collections as partial, clarify that site progress is not JLPT certification, and connect weekly tasks/notes to focused practice.
6. Keep navigation compact on mobile, use legible body typography, restore accessible native selection controls and visible focus, reduce motion, and label audio/search controls.
7. Run the original test suite, add focused regression tests for content, scheduling, hints, scopes and generated questions, rebuild, verify entrypoints and syntax. Retain the project's existing publishing destination; prepare a reviewable Git change and use available GitHub access for delivery.

Acceptance: audited incorrect rules no longer appear after a rebuild; reading prompts don't expose their answers; daily questions stay in the requested scope; due items are not starved by unseen items; same-day/hinted success cannot mark mastery; profiles persist; focused notes/practice works; choices remain keyboard-accessible; mobile notes expose content before the full category list.
