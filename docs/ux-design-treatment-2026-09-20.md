# Family Feature UX Design Treatment

**Status:** Implemented in PR #83; device and assistive-technology validation pending
**Date:** September 20, 2026  
**Product:** [Family Feature](https://movies.tonykim.io/)  
**Repository:** `tokim25/movie-app-repo`  
**Audience:** Product, design, engineering, accessibility, and content owners

## Executive summary

Family Feature has a strong product premise: turn a large family-movie catalog into one credible choice for the people, time, and mood available tonight. The current product already has a coherent three-part structure—Tonight, Shelf, and Family—and unusually clear explanations of local storage, optional sync, age-based starter settings, and parent control.

The next design phase should prioritize trust and accessibility before visual polish:

1. Make recommendation confidence, evidence, and uncertainty visible at the moment of decision.
2. Correct interaction semantics, validation behavior, labels, focus handling, and target sizes.
3. Simplify Family into a clear hierarchy without hiding safety-relevant information.
4. Replace the current beige and terracotta theme with the approved Cinema Blue system.
5. Adapt navigation and filtering for desktop rather than stretching mobile patterns.

The Family page is visually dense, but it is not the product's most consequential problem. The product promise is the recommendation. A trustworthy recommendation system is therefore the first design priority.

## Implementation handoff

This treatment is the design source of truth for issues #84–#88 and the corresponding implementation in PR #83. The implementation intentionally preserves the existing recommendation scoring, stored family data, sync format, offline shell, and destructive confirmations. It changes presentation, interaction semantics, and explanatory copy without silently changing the rules that decide whether a title is within a family's settings.

| Issue | Shipped treatment | Acceptance signal |
|---|---|---|
| #84 — Cinema Blue visual system | Light/dark semantic tokens, cobalt actions, cool-neutral surfaces, visible focus rings, 44px critical targets, updated browser/PWA theme colors | Both themes use the token table below; beige/terracotta chrome is removed |
| #85 — Accessible interaction states | `aria-pressed`/`aria-current`, inline onboarding error, assertive and polite live regions, labeled filters, focus return/trap for the compact filter sheet | Selection, error, status, and navigation state are programmatically exposed |
| #86 — Recommendation trust | “Tonight's pick,” “Review fit,” and “Above settings”; adults-only explanation; visible evidence and source; two alternatives; optional session-only Skip reason | Provenance and uncertainty appear without opening Details; feedback does not change family limits |
| #87 — Family information architecture | Family members, Content limits, Appearance and sync, and About; one card and one inline editor per member; “Personalization” removed | Only one member editor is open at a time and focus moves into the requested task |
| #88 — Responsive Shelf and navigation | Compact bottom navigation and filter sheet; desktop left navigation and filter popover; search result count, clear action, focused zero-results recovery | Search suppresses unrelated Browse by content and prefills Request a movie when empty |

### Product boundaries

- Skip reasons are optional, toggleable, and held for the current session only.
- “Adults only” means child content limits do not apply; it is not an adult-content preference.
- Recommendation provenance is separate from the green/amber/red fit calculation.
- The implementation does not add behavioral inference, automatic profile changes, analytics, or a new persistence schema.
- Exactly two alternatives are shown when the eligible catalog can supply them; the primary recommendation remains the default path.

### Verification status

- Source-level JavaScript parsing, diff hygiene, service-worker data-version checks, canonical redirect checks, and Playwright test discovery pass locally.
- Regression coverage was added for inline validation, state semantics, recommendation evidence and alternatives, search recovery, single-editor Family behavior, and compact/desktop filter behavior.
- The full browser suite remains required in CI. The local environment could not download its pinned Chromium binary, so this document does not claim a completed device, VoiceOver, NVDA, or cross-browser pass.

## Review basis and limits

This treatment combines:

- A live walkthrough of onboarding and sample-family setup.
- Tonight configuration for viewers, time, and mood.
- An adults-only recommendation, recommendation details, and Skip behavior.
- Shelf browsing, search, zero-results behavior, filtering, and source links.
- Family profiles, child editing, content limits, appearance, sync, and About content.
- Inspection of the live interface's accessible names, selection state, validation notification, control sizes, typography, and color values.
- Review of the current repository structure and design tokens in `index.html`.

The review was conducted against the live desktop experience. It is not a substitute for moderated family research, a full screen-reader test matrix, or device-level testing across every supported mobile breakpoint.

## Product design principles

### 1. Earn trust before asking for action

Show why a recommendation fits, what information supports it, and where the system is uncertain. Do not use language that implies a safety guarantee the underlying evidence cannot provide.

### 2. One decisive recommendation, with an escape hatch

Retain the product's valuable “one good pick” premise. Pair it with Skip and a restrained “See two alternatives” option so decisiveness does not become false certainty.

### 3. Parents set limits; the system explains consequences

Age-based settings are starter guidance, not objective rules. Parent-set limits must remain visible, reversible, and stable until the parent changes them.

### 4. State must be more than visual

Every selection, error, loading state, success state, and disabled state must be perceivable visually and programmatically.

### 5. Poster art supplies the warmth

The application chrome should be neutral, cool, and quiet. Posters and editorial content can provide color and personality without tinting every surface.

## Approved visual direction: Cinema Blue

The existing beige and terracotta system is replaced by a cool neutral canvas, white surfaces, midnight text, cobalt actions, and restrained marquee-gold highlights. The direction is cinematic without imitating a streaming service, and it gives poster art room to lead.

### Light theme tokens

| Semantic role | Token | Value | Usage |
|---|---|---:|---|
| Canvas | `--bg` | `#F4F6FA` | Page background |
| Subtle surface | `--bg-sub` | `#E9EEF7` | Grouped areas, selected-row backing, filters |
| Surface | `--surface` | `#FFFFFF` | Cards, sheets, inputs |
| Primary text | `--ink` | `#172033` | Headings and body text |
| On-dark text | `--on-ink` | `#FFFFFF` | Text on dark controls and notifications |
| Secondary text | `--ink-soft` | `#566176` | Supporting copy and metadata |
| Tertiary text | `--ink-faint` | `#626D83` | Nonessential metadata only |
| Border | `--line` | `#CFD7E6` | Dividers and input boundaries |
| Primary action | `--accent` | `#2F5FEA` | Primary buttons, active navigation, focus affordances |
| Primary action RGB | `--accent-rgb` | `47,95,234` | Tinted selected states |
| Action text | `--accent-text` | `#2348B7` | Links and action text on light surfaces |
| On-action text | `--on-accent` | `#FFFFFF` | Text on cobalt buttons |
| Selection | `--select-rgb` | `47,95,234` | Selected controls and focus-adjacent fills |
| Highlight | `--star` | `#D59B16` | Want-to-watch star and rare highlights |
| On-highlight text | `--on-star` | `#172033` | Text on gold selected states |
| New label | `--new` | `#2354B8` | New-content label text |
| New label surface | `--new-bg` | `#E7EEFF` | New-content label background |
| Success | `--success` | `#18794E` | Confirmed completion |
| Warning | `--warning` | `#8A5A00` | Caution requiring attention |
| Warning surface | `--warning-soft` | `#FFF4D6` | Warning background |
| Error | `--error` | `#B42318` | Validation and destructive actions |
| Error surface | `--error-bg` | `#FDECEA` | Error background |
| Focus | `--focus` | `#5B8DEF` | Keyboard focus ring |

Gold is not a general-purpose brand color. Reserve it for the Want-to-watch star, a featured badge, or another small moment of emphasis. It should not be used for body text or primary buttons.

### Dark theme tokens

| Semantic role | Token | Value |
|---|---|---:|
| Canvas | `--bg` | `#0B1020` |
| Subtle surface | `--bg-sub` | `#1C2540` |
| Surface | `--surface` | `#131A2C` |
| Primary text | `--ink` | `#F7F9FC` |
| On-dark text | `--on-ink` | `#0B1020` |
| Secondary text | `--ink-soft` | `#B6C0D2` |
| Tertiary text | `--ink-faint` | `#929DB2` |
| Border | `--line` | `#2B3654` |
| Primary action | `--accent` | `#7FA2FF` |
| Primary action RGB | `--accent-rgb` | `127,162,255` |
| Action text | `--accent-text` | `#9AB4FF` |
| On-action text | `--on-accent` | `#0B1020` |
| Selection | `--select-rgb` | `127,162,255` |
| Highlight | `--star` | `#F2C14E` |
| On-highlight text | `--on-star` | `#0B1020` |
| New label | `--new` | `#AAC0FF` |
| New label surface | `--new-bg` | `#202D50` |
| Success | `--success` | `#4CC38A` |
| Warning | `--warning` | `#F2C14E` |
| Warning surface | `--warning-soft` | `#382F18` |
| Error | `--error` | `#FF7A70` |
| Error surface | `--error-bg` | `#3B2024` |
| Focus | `--focus` | `#9AB4FF` |

### Color application rules

- Use cobalt for the single primary action in a region. Do not turn every link and chip blue.
- Use a visible 2px focus ring with a minimum 2px offset where layout permits.
- Do not communicate status by color alone; pair it with text, an icon, or programmatic state.
- Preserve at least WCAG AA contrast for text and essential control boundaries.
- Test selected, hover, pressed, disabled, focus-visible, loading, success, warning, and error states in both themes.
- Use shadows sparingly. Borders and surface changes should carry most grouping work.

## Typography

The current type-family selection is directionally sound. The problem is hierarchy and sizing, not the need for another font.

### Families

- **Editorial display:** Fraunces, reserved for page titles and rare editorial moments.
- **Interface:** native system sans (`-apple-system`, `BlinkMacSystemFont`, `SF Pro Text`, `Helvetica Neue`, Arial, sans-serif) for body copy, controls, metadata, and settings.
- Do not add a third family.

### Type scale

| Role | Size / line height | Weight | Family |
|---|---:|---:|---|
| Page title | 32 / 36 | 650 | Fraunces |
| Section heading | 20 / 26 | 600 | System sans |
| Subsection heading | 17 / 23 | 600 | System sans |
| Body | 16 / 24 | 400 | System sans |
| Control label | 15 / 20 | 600 | System sans |
| Metadata | 14 / 20 | 400–500 | System sans |
| Eyebrow, when necessary | 13 / 18 | 600 | System sans |

### Typography rules

- Replace 12px uppercase section labels with semantic headings in sentence case.
- Keep essential explanatory copy at 16px.
- Do not use tertiary text color for required instructions, safety context, or active controls.
- Keep line length near 45–75 characters for explanatory copy on desktop.

## Information architecture

### Primary navigation

Retain the three destinations:

1. **Tonight** — make a decision.
2. **Shelf** — browse and manage the catalog.
3. **Family** — manage profiles, limits, appearance, and sync.

On compact screens, bottom navigation is appropriate. On desktop, use a compact sidebar or top navigation instead of stretching three bottom-navigation buttons across the viewport.

### Family page

“Personalization” and “Children” should not both remain. They describe overlapping parts of the same task and create duplicate representations of each child.

Use this hierarchy:

1. **Family members**
   - Simon — age 6 — Starter settings
   - Nora — age 3 — Starter settings
   - Add family member
2. **Content limits**
   - Select a family member
   - Review or edit content categories
3. **Appearance and sync**
4. **About Family Feature**

Each family member should have one row or card. Editing should open an inline disclosure, dialog, or focused edit view. Do not repeat permanent edit forms beneath the summary cards.

Replace “How Family Feature understands each kid right now” with **How recommendations are filtered** or **Child profiles and content limits**. The current wording anthropomorphizes a narrow profile and can imply behavioral inference that is not occurring.

## Recommendation experience

### Problem

In the reviewed live flow, Adults only + About 90 minutes + Calm produced *Barbie in the Nutcracker (2026)* followed by *The Colors Within (2025)*. A children's title is not inherently wrong for adults, but the result shows an expectation gap: “Adults only” can read as an adult-content preference, while the implementation means only that child limits are disabled.

The recommendation also used the label “Green Light” while stating that safety limits were not applied. For one title, Details explained that no direct Common Sense Media review was available and that guidance was inferred from general coverage and comparison with an older film. That uncertainty was responsible but appeared too late.

### Required changes

- Replace **Green Light** with **Tonight's pick**, **Likely fit**, or **Why this may fit**.
- Explain Adults only as: **No children watching—child content limits won't apply.**
- Show source availability and confidence directly on the recommendation card.
- Distinguish direct review data, substitute sources, and inferred guidance.
- Keep the underlying source reachable from Tonight, not only from Shelf.
- Offer an optional “See two alternatives” action after the primary pick.
- Do not describe a recommendation as safe or approved unless the product can substantiate that claim.

### Proposed recommendation card

**Tonight's pick**  
*Movie title (year)*

Why it may fit:

- Fits the selected time.
- Within Simon and Nora's current limits.
- Matches a calm night.
- Common Sense Media review available.

Actions:

- **Choose this movie**
- Skip
- See two alternatives
- View source and details

For uncertain guidance:

> **Limited guidance**  
> No direct Common Sense Media review is available. This suggestion uses general title information and comparison material.

### Skip feedback

After Skip, offer optional, nonblocking reasons:

- Wrong mood
- Not interested
- Already seen
- Not available to us
- Content concern

Do not silently turn a skip reason into a permanent family-profile rule. If feedback changes future ordering, say so and provide a way to inspect or reset it.

## Shelf experience

### What works

- Search filters the catalog quickly.
- Movie rows use list semantics.
- Direct source links are visible.
- The request-a-movie path provides a useful escape hatch.

### Required changes

- Provide a result count and clear-search action when a query is present.
- On a zero-result search, prefill Request a movie with the current query.
- Reduce unrelated Browse by studio content while search results are active.
- Give every filter select a visible label or programmatic accessible name.
- Expose selected filter and tab states programmatically.
- Use a popover or side panel for desktop filtering; retain a sheet on compact screens.
- Increase icon-only controls to a 44×44px interaction area.

## Family and content-limit experience

### What works

- Starter settings are explicitly tied to age.
- Parent overrides are described as persistent.
- The interface explains that numbered content levels are internal calibration, not official ratings.
- Individual content-level buttons expose pressed state more successfully than several other chip systems.
- Local storage and optional Google Drive sync are explained clearly.

### Required changes

- Consolidate summary and edit representations into one family-member component.
- Rename the section to **Family members** and remove the “Personalization” label.
- Make Add family member a system component rather than a browser-default button.
- Keep Remove separated from Save and require confirmation.
- Move child selection and content-limit summaries nearer to the section heading.
- Initially show a concise limit summary; reveal detailed definitions and examples on request.
- Do not hide content concerns or uncertainty solely to shorten the page.
- Use heading elements for major sections rather than styled spans.

## Interaction and accessibility requirements

### Selection controls

Viewer, time, mood, appearance, child selection, tabs, and filter toggles currently rely heavily on visual CSS classes. Implement them as native radios/checkboxes where appropriate, or expose state using `aria-pressed`/`aria-selected` with the correct containing role.

Acceptance criteria:

- A screen reader announces the control name, role, and current state.
- Keyboard users can reach and change every selection.
- Focus remains visible in light and dark themes.
- State does not depend on color alone.

### Validation

The onboarding Continue action currently produces a generic toast when the child name is blank, leaves focus on Continue, and does not expose a live-region announcement.

Acceptance criteria:

- An inline error appears adjacent to the child-name field.
- The input uses `aria-invalid="true"` while invalid.
- The error is associated using `aria-describedby`.
- Focus moves to the first invalid field after submission.
- An error summary or assertive live region announces the failure once.
- The message says what to do: **Enter a child name to continue.**

### Notifications

- Use `role="status"` and an appropriate live region for passive confirmations.
- Avoid leaving stale confirmation toasts visible across unrelated screens.
- Do not use a toast as the only representation of a form error.

### Target sizes

- Use a minimum 44×44px interaction area for primary, icon-only, and frequently used controls.
- Visible artwork may remain smaller if the surrounding hit area reaches the target.
- Maintain adequate spacing between adjacent destructive and nondestructive actions.

### Labels and headings

- Every select, search field, and input needs a visible or programmatic label.
- Use a logical heading hierarchy.
- Do not use small, low-contrast uppercase spans as the only section boundary.

## Three-perspective assessment

### Interaction designer perspective

The Tonight flow is focused and understandable, and the warm editorial voice has character. The largest interaction weakness is that many controls look stateful without being semantically stateful. The product also applies mobile navigation and sheets too literally on desktop. Correct the primitives—state, focus, validation, targets, and responsive patterns—before adding animation or decorative depth.

### Product manager perspective

The catalog is an input, not the differentiator. The value proposition is reducing household decision time with a credible recommendation. Recommendation acceptance, provenance, availability, and time-to-decision should drive prioritization. Family-page simplification is valuable but should follow recommendation integrity and accessibility defects.

Suggested measures:

- Median time from opening Tonight to choosing a movie.
- Skip rate and optional skip-reason distribution.
- Details-open and source-click rates.
- Recommendation-to-watched conversion.
- Repeat weekly use.
- Search zero-result rate.
- Family-profile setup completion.
- Custom-limit reversal rate.
- Diversity of accepted recommendations.

Guard against improving acceptance by repeatedly narrowing families into the same familiar titles.

### Dissenting, AI-sensitive UX perspective

Even if the engine is rules-based, people will experience it as algorithmic. Avoid false authority, anthropomorphic language, and invisible inference. Make evidence and uncertainty visible where the recommendation is presented. Keep feedback optional and reversible. Do not trade away safety context for a cleaner card. Preserve the product's personal character rather than adopting a generic “AI assistant” aesthetic.

## Prioritized implementation plan

### P0 — Trust and accessibility

1. Replace “Green Light” and clarify Adults only.
2. Surface provenance and uncertainty on Tonight.
3. Correct selection semantics across the application.
4. Implement accessible inline validation and notification behavior.
5. Label all filter controls and establish visible focus treatment.
6. Increase important interaction areas to 44×44px.

### P1 — Visual system and Family architecture

1. Implement Cinema Blue tokens in light and dark themes.
2. Verify every component state and contrast combination.
3. Consolidate Family member summaries and editing.
4. Remove “Personalization” and rename “Children” to “Family members.”
5. Restyle Add family member and separate destructive actions.

### P1 — Decision quality

1. Add optional Skip reasons.
2. Provide source access from Tonight.
3. Add “See two alternatives.”
4. Investigate availability/service preferences without blocking the core experience.

### P2 — Responsive refinement and measurement

1. Add desktop navigation and filter treatments.
2. Improve active-search and zero-results states.
3. Add privacy-conscious product measurement if desired.
4. Conduct moderated sessions with parents and mixed-age households.

## Definition of done

The design treatment is implemented when:

- Cinema Blue replaces the beige/terracotta system in both themes.
- Automated contrast checks cover semantic token pairs and critical component states.
- Axe reports no serious or critical violations in onboarding, Tonight, Shelf, and Family.
- Keyboard-only users can complete onboarding, choose a recommendation, search/filter Shelf, and edit a child profile.
- Screen readers announce selection state, validation errors, and confirmations.
- Recommendation cards show confidence/provenance without requiring Details.
- “Green Light,” “Personalization,” and the duplicate Children editing surface are removed.
- Critical controls meet the 44×44px interaction target.
- Desktop navigation and filtering no longer stretch mobile patterns across the viewport.
- Product copy has been reviewed for safety claims, anthropomorphism, and implied inference.

## Recommended validation plan

1. Run current Playwright and accessibility suites before and after each implementation slice.
2. Add regression tests for pressed/selected state, accessible filter names, inline validation, and status announcements.
3. Add visual snapshots for light/dark token application at compact and desktop widths.
4. Test with VoiceOver + Safari and NVDA + Chrome.
5. Conduct five usability sessions with households spanning different child ages.
6. Ask participants what “Adults only,” “Green Light,” and age-based starter settings mean before explaining them.
7. Measure whether participants can explain why a title was recommended and how to override the system.

## Decision log

| Decision | Outcome | Rationale |
|---|---|---|
| Background and brand palette | Replace with Cinema Blue | The current beige/terracotta treatment is disliked and tints the entire experience; cool neutrals allow posters to lead. |
| Typography families | Retain Fraunces + system sans | The families provide character and clarity; hierarchy, size, and contrast need correction instead. |
| “Personalization” label | Remove | It is abstract, duplicative, and implies broader inference than the feature performs. |
| “Children” section | Rename to Family members | It better describes the managed entities and leaves room for future household roles. |
| “Green Light” | Remove | It overstates certainty and conflicts with adults-only recommendations where child limits are not applied. |
| Recommendation model | Keep one primary pick with alternatives | Preserves decisiveness while giving users agency when the first result misses. |
