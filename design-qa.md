# Bear + Phosphor redesign — design QA

final result: passed

## Comparison target and evidence

- Selected visual truth: `C:/Users/USER/.codex/generated_images/01a0a5bd-2e28-71e2-b589-8846eb844923/exec-b0d6b3f2-951f-4ff1-a619-70767498a776.png` (the user's option 1).
- Implementation: `http://127.0.0.1:8189/?preview=0.9.2#/`.
- Evidence folder: `../output/nihongo-bear-redesign/`.
- Final rendered desktop: `desktop-final.png`; combined comparison: `comparison-final.jpg`.
- Focused side-by-side comparisons: `focus-final-0.jpg` (headline, review strip, icons, button); `focus-final-1.jpg` (lesson typography, progress, layout).
- Source: 1487 x 1058 pixels. CSS desktop viewport: 1488 x 1056, reported devicePixelRatio approximately 1. Browser capture: 1473 x 1045 pixels. The browser capture service scales its output slightly; the source was normalized to that exact capture size for comparison. No browser chrome or device frame is present.
- State: light theme, N5, current lesson 五十音・清音, 0/46 learned. Source shows illustrative 10 due; implementation uses local real progress, with 4 new questions remaining after a test answer. Dynamic counts, lesson descriptions and upcoming vocabulary are deliberately drawn from the existing curriculum.
- Responsive checks: 390 x 844 and 1024 x 900 CSS pixels. Evidence: `mobile-final.png`, `mobile-notes-fixed.png`, `mobile-course.png`.

## Findings and iterations

1. Initial comparison (`comparison-v1.jpg`, `desktop-v1.png`): P2, sidebar/secondary text too small and typography still loading in the first capture. Increased desktop sidebar to 278px, headline to 48px, navigation to 19.2px, and secondary text to 17–20px. Explicitly load Noto Sans TC for the interface, Noto Serif TC for the headline, Klee One for learning samples and Zen Kurenaido for the existing wordmark. Verify font loading before final evidence.
2. Second comparison (`comparison-v2.jpg`): macro composition, paper surfaces and vertical ordering match. Replaced remaining note-title emoji with Phosphor notebook icons and removed decorative prefixes at display time; original content identifiers and links remain intact. Cache-busted assets so the final browser run includes these changes.
3. Mobile content QA: P1, removing the search emoji left a visually blank search button; P2, narrow note tables wrapped Japanese into short fragments. Added visible 搜尋 text; gave mobile learning tables a 520px minimum width inside a keyboard-focusable horizontal scroll region. Before: `mobile-notes-final.png`; after: `mobile-notes-fixed.png`. Verified table client width 292px / scroll width 520px and no document overflow.
4. Final comparison (`comparison-final.jpg` and both focused comparisons): no actionable P0/P1/P2 findings. Sidebar, warm paper, blush review strip, lesson split, light separators and three upcoming rows are preserved. Mobile layout stacks the lesson and collapses the navigation into a working menu.

## Required fidelity surfaces

- Fonts / typography: explicit Traditional Chinese interface fonts, serif headline and handwritten Japanese samples. Final headings and smaller labels are readable; no missing characters observed. The live kana font is slightly lighter than the generated reference (P3, acceptable).
- Spacing / layout: fixed desktop sidebar; large quiet reading area; review strip, split current lesson and three compact upcoming rows. Fine separators and restrained 10–12px radii replace black borders, tape and hard shadows. No horizontal page overflow at checked widths.
- Colors / tokens: paper #f9f8f5, sidebar #f0ede8, text #2f3030, secondary #70716f, accent #ae4149, review surface #f7eeec. Primary and secondary text remain distinct. Existing correct/incorrect states retain color and text feedback.
- Assets / icons: original Phosphor Icons core 2.1.1 regular SVGs, vendored with MIT license; CSS masks inherit text color. No custom replacement drawings, emoji interface icons or remote icon runtime. The official cards-three shape differs from the generated sketch; this is the deliberate use of the user's chosen icon library. No raster art is required by this layout.
- Copy / content: real curriculum, counts, settings and learning progress. Corrected the mock's mixed-language caption to ここから。一步一步，打好基礎。New-content practice is labeled 今日練習 and due work 今日複習. For more than 20 due items, the estimate explicitly describes the 20-question round.

## Behavior and accessibility checked

- Mobile menu opens, closes after navigation, and retains aria-expanded state.
- Learning settings save, confirm success and survive reload; changing N5/N4 updates the home lesson and daily practice.
- Daily practice opens the learning preview, hides the answer, accepts an answer and shows scheduling/assisted-answer feedback.
- Notes chapter selector, full-text search (ながら), source links and horizontally scrollable tables work.
- Course list renders all 52 N5 units; reference, kana, kanji, review, quiz setup and unit pages pass DOM integration coverage.
- Skip link, visible focus, labeled controls, decorative icons hidden from assistive technology, reduced motion and native selects preserved.
- Browser warning/error log: empty during final check. Cloud account linking and operating-system audio output were not exercised; the sync and voice algorithms were unchanged.
- Automated tests: 68/68 passed, then the 8 app integration tests passed again after the final search/table changes. JavaScript syntax and git whitespace checks passed.

## Implementation checklist

- [x] Selected first design implemented in the existing project.
- [x] Official Phosphor assets and license included in Pages-staged css directory.
- [x] Actual curriculum and progress retained.
- [x] Desktop, mobile and tablet layout checks.
- [x] Focused and full-view comparisons; identified issues fixed and recaptured.
- [x] Settings, practice, navigation and note-search verification.
- [x] No unresolved P0/P1/P2 findings.

## Follow-up polish

P3: source mock's hand-drawn underline and kana shapes are not exact font glyph matches. Live, selectable text and a simple typographic underline are intentional. Native rendering may vary slightly between operating systems.
