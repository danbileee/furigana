# Task 13: Add Ruby CSS Base Rules

**Project**: Furigana MVP
**Generated**: 2026-03-21
**Source PRD**: `.taskmaster/docs/plans/2026-03-17 MVP/milestones/1-prd-Core Generation Loop.md`

---

## Overview

`app/app.css` already contains a partial `rt` rule (`font-size: 0.5em; ruby-position: over`) inside `@layer base`, but it is incomplete. The full set of display rules required for the CSS Ruby Layout model to function under Tailwind v4's Preflight reset — specifically `display: ruby`, `display: ruby-text`, and `display: none` on `rp` — are absent. This task adds those rules and introduces a `.reading-view` utility class for the reading-area typography used in `furigana.$id.tsx`.

---

## Requirements Analysis

### Functional Requirements

- `ruby` elements must render with `display: ruby` so the browser applies the ruby formatting model instead of falling back to inline-block or flow layout.
- `rt` elements must render with `display: ruby-text`, `font-size: 0.5em`, and `line-height: 1`. The existing partial rule covers `font-size` and `ruby-position` but does not set `display` or `line-height`.
- `rp` elements (parenthesis fallback content) must be hidden via `display: none`; they exist solely for non-ruby-capable environments and should not appear in modern browsers.
- A `.reading-view` utility class must be added with `font-size: 1.125rem` and `max-width: 65ch` to support reading-area layout.
- All rules must live inside `@layer base` to participate correctly in Tailwind v4's cascade and be overridable by component or utility layers.

### Non-Functional Requirements

- The change is pure CSS — no JavaScript, no TypeScript, no new npm dependencies.
- The implementation must not break any existing styles. The existing `rt` partial rule must be replaced (not duplicated) with the complete rule.
- The `.reading-view` class must be placed in `@layer utilities` (not `@layer base`), matching Tailwind v4's convention for reusable utility classes that consumers apply with a class name.
- CSS values must be authored in plain CSS, not via `@apply`, because these rules reference internal CSS model values (`display: ruby`, `display: ruby-text`) that have no Tailwind utility equivalents.

### Dependencies and Constraints

- No task dependencies. This task is self-contained.
- Tailwind CSS v4 (`^4.0.0`) is the installed version. Tailwind v4's Preflight does **not** reset ruby, rt, or rp elements — confirmed by reviewing the upstream `preflight.css` source. However, browsers still vary in their default UA stylesheets; explicit `display` declarations ensure cross-browser consistency.
- `display: ruby-text` has **no support in Safari** (any version as of March 2026) and was removed from Chromium-based Edge (versions 79+). See Third-Party Integration Research for fallback analysis.
- The existing `@layer base` block in `app/app.css` already contains the partial `rt` rule at line 144–147. That block must be extended in-place; a second `@layer base` block would also work in CSS (layers merge), but editing the existing block is cleaner and matches the file's current convention.

---

## Implementation Plan

### Phase 1: Update `@layer base` with Ruby Display Rules

**Objective**: Replace the partial `rt` rule with a complete set of ruby display rules covering `ruby`, `rt`, and `rp`.

#### Subtask 1.1: Replace the existing partial `rt` rule

- **File to modify**: `app/app.css`
- **Current state** (lines 144–147):
  ```css
  rt {
    font-size: 0.5em;
    ruby-position: over;
  }
  ```
- **Action**: Replace this block with three separate rules covering all three ruby-related elements.
- **Key consideration**: `ruby-position: over` is the CSS4 Ruby property for positioning annotation above the base. It is complementary to `display: ruby-text` and should be retained. Retaining it avoids a regression — without it browsers that default to `under` (a theoretical possibility for vertical-writing-mode text) would change behaviour.
- **Acceptance criteria**: The `@layer base` block contains `ruby`, `rt`, and `rp` rules, and no orphaned partial `rt` rule remains.

#### Subtask 1.2: Add `ruby` and `rp` element rules

- **File to modify**: `app/app.css`
- **New rules** (to be added alongside the updated `rt` rule):

  ```css
  ruby {
    display: ruby;
  }

  rt {
    display: ruby-text;
    font-size: 0.5em;
    line-height: 1;
    ruby-position: over;
  }

  rp {
    display: none;
  }
  ```

- **Key consideration for `display: ruby`**: Browsers that understand the CSS Ruby Layout module (Chrome 121+, Firefox 38+) already apply `display: ruby` via their UA stylesheet for the `<ruby>` HTML element. Making it explicit ensures the rule survives any future preflight update that might normalise or remove UA ruby defaults, and removes ambiguity in the cascade.
- **Key consideration for `display: none` on `rp`**: The `<rp>` elements in `furigana.$id.tsx` wrap parentheses `(` and `)` as fallback text for environments that do not render ruby. Under a browser that renders ruby correctly, those parentheses must not appear alongside the annotation. Setting `display: none` on `rp` in `@layer base` achieves this. Since no Tailwind utility or shadcn component ever targets `rp`, there is no conflict risk.
- **Key consideration for `line-height: 1` on `rt`**: Without an explicit `line-height`, the `rt` element inherits the document's line-height (typically 1.5 in this app due to Tailwind's base body styles). This causes the ruby annotation to push the base text line down, adding excessive spacing between lines of Japanese text. Setting `line-height: 1` on `rt` contains the annotation height within the annotation's own em-square.
- **Acceptance criteria**: `pnpm dev` renders `<ruby>漢字<rt>かんじ</rt></ruby>` with the kana appearing above the kanji, no parentheses visible, and no excessive inter-line spacing.

### Phase 2: Add `.reading-view` Utility Class

**Objective**: Provide a reusable utility class for reading-area typography that can be applied to the `<article>` element in `furigana.$id.tsx` or any future reading component.

#### Subtask 2.1: Add `.reading-view` to `@layer utilities`

- **File to modify**: `app/app.css`
- **Location**: Append a new `@layer utilities` block after the closing brace of the existing `@layer base` block.
- **New rule**:

  ```css
  @layer utilities {
    .reading-view {
      font-size: 1.125rem;
      max-width: 65ch;
    }
  }
  ```

- **Key consideration — layer choice**: In Tailwind v4, `@layer utilities` is the correct layer for single-purpose CSS classes that are used directly on HTML elements with a class name. Using `@layer base` for a class selector would place it below Tailwind's utility layer in specificity priority, making it impossible to override with utility classes like `text-xl`. `@layer utilities` places it at the same priority as Tailwind utilities, with source-order winning on conflict.
- **Key consideration — `font-size` vs `text-xl`**: The `furigana.$id.tsx` component currently applies `text-xl` (equivalent to `1.25rem`) on the `<article>` element directly via a class. The `.reading-view` class uses `1.125rem` (= `text-lg` in Tailwind). These are different values. Do not apply `.reading-view` to the existing article element unless the intentional size change is accepted — the `.reading-view` class is being added as a utility, not automatically applied.
- **Key consideration — `max-width: 65ch`**: `ch` units are relative to the width of the `0` character in the current font. For Japanese text set in a sans-serif font this yields approximately 65 characters per line, a widely accepted readable line length for dense CJK content.
- **Acceptance criteria**: `.reading-view` class is present in the compiled CSS; applying it to any element produces `font-size: 1.125rem` and `max-width: 65ch`.

---

## Third-Party Integration Research

### Tailwind CSS v4 (`^4.0.0`, latest: v4.1.x as of March 2026)

- **Official docs**: [tailwindcss.com/docs/preflight](https://tailwindcss.com/docs/preflight)
- **Preflight and ruby**: Tailwind v4's `preflight.css` does **not** set any rules on `ruby`, `rt`, or `rp`. The only broad `display: none` rule targets elements with the HTML `hidden` attribute (`[hidden]:where(:not([hidden='until-found'])) { display: none !important }`). Ruby elements are untouched by Preflight, so explicit `display` declarations in `@layer base` are additive, not defensive overrides.
- **Layer merging**: Multiple `@layer base { }` declarations in the same file merge correctly in both the CSS specification and Tailwind v4's PostCSS pipeline. Editing the existing block is preferred for readability, but splitting is safe if needed.
- **`@apply` limitation**: `@apply` cannot be used to set `display: ruby` or `display: ruby-text` because Tailwind v4 does not define utility classes for these internal display values. Plain CSS is required for these declarations.
- **Recent changes**: Tailwind v4 simplified placeholder opacity rules and removed some legacy PostCSS plugin API; none of these affect ruby handling.
- **Security advisories**: None found.
- **Performance notes**: None — this is static CSS with zero runtime cost.

### CSS Ruby Layout (`display: ruby`, `display: ruby-text`)

- **Spec**: [CSS Ruby Annotation Layout Module Level 1](https://www.w3.org/TR/css-ruby-1/)
- **`display: ruby-text` browser support (as of March 2026)**:
  - Chrome: 121+
  - Firefox: 38+
  - Edge (Chromium): support removed at v79, making Edge 12–18 (legacy) the only Edge versions with it. Modern Edge (Chromium-based, v79+) does not support `display: ruby-text` as a CSS property, but respects the HTML `<rt>` element's UA stylesheet default which maps it internally. **In practice, modern Edge renders ruby correctly through the HTML element UA mapping.**
  - Samsung Internet: 25.0+
  - Safari: **No support across all tested versions (3.1–26.4)**. However, Safari does have native HTML ruby support via its UA stylesheet — it renders `<rt>` above the base text without needing an explicit CSS `display: ruby-text` declaration. The explicit CSS declaration simply has no effect in Safari, and the UA default takes over.

> ⚠️ **Needs Review**: Safari does not recognise `display: ruby-text` as a CSS value. This means setting `rt { display: ruby-text }` in `@layer base` will be ignored by Safari, and Safari will fall back to its UA stylesheet mapping for `<rt>`. The HTML-level ruby rendering in Safari (via UA stylesheet) works and produces correct output for basic ruby annotations, so there is **no visible regression**. However, if any future CSS rule in the project relies on `display: ruby-text` being active in the cascade in Safari (e.g., specificity battles), it will silently lose. Workaround: always rely on semantic HTML ruby structure for accessibility and layout correctness — do not depend on CSS `display: ruby-text` for any behaviour beyond the reset.

### HTML Ruby Annotation Element (`<ruby>`, `<rt>`, `<rp>`)

- **MDN reference**: [developer.mozilla.org/en-US/docs/Web/CSS/Guides/Ruby_layout](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Ruby_layout)
- **`<ruby>` element browser support**: Partial in Chrome 5+, Safari 5+, and all modern browsers. "Partial" means complex ruby (nested `<rbc>`/`<rtc>` elements) may not render correctly, but basic `<ruby><rt>` is supported universally.
- **`<rp>` element**: The `<rp>` element is universally supported as an HTML element — browsers know it exists. Without `display: none`, browsers that handle ruby natively may still show the `<rp>` content alongside the annotation, or may hide it on their own via UA stylesheet. Explicitly setting `display: none` in `@layer base` guarantees consistent behaviour across all browsers.
- **Security advisories**: None — this is a pure HTML/CSS feature.
- **Performance notes**: The ruby layout model introduces an additional formatting context on the base text line. For documents with many ruby annotations (hundreds per page), layout recalculation could be marginally slower, but this is negligible in practice for the use case of this application.

---

## Code Patterns

### Pattern 1: Complete `@layer base` Ruby Block

```css
@layer base {
  /* ...existing rules... */

  ruby {
    display: ruby;
  }

  rt {
    display: ruby-text;
    font-size: 0.5em;
    line-height: 1;
    ruby-position: over;
  }

  rp {
    display: none;
  }
}
```

**Where to apply**: Inside the existing `@layer base` block in `app/app.css`, replacing the current partial `rt` rule.

**Why this pattern**: Placing element-level display normalisation in `@layer base` follows the same convention used by Tailwind's own Preflight — base styles are opinionated resets and normalisation, applied first in the cascade, overridable by component and utility layers.

### Pattern 2: `.reading-view` Utility Class

```css
@layer utilities {
  .reading-view {
    font-size: 1.125rem; /* text-lg equivalent */
    max-width: 65ch;     /* ~65 character line width */
  }
}
```

**Where to apply**: Appended as a new `@layer utilities` block after `@layer base` in `app/app.css`.

**Why this pattern**: Single-responsibility utility classes belong in `@layer utilities` in Tailwind v4 so they interoperate correctly with Tailwind's own utility layer and remain overridable by arbitrary-value utilities or inline styles. The `font-size` and `max-width` values are expressed in plain CSS rather than `@apply text-lg max-w-[65ch]` because the token values (`1.125rem` and `65ch`) are well-known reading-typography constants that benefit from being explicit and self-documenting.

---

## Test Cases

### Manual Browser Tests

These are the primary verification method for this task because the changes are CSS rendering rules — unit tests cannot assert visual rendering.

**Test 1**: Basic ruby rendering

- **Given**: Development server running (`pnpm dev`), browser navigated to the `/furigana/:id` route or a temporary test page containing `<ruby>漢字<rt>かんじ</rt></ruby>`
- **When**: Page loads
- **Then**: The hiragana `かんじ` appears centred above the kanji `漢字`; no parentheses are visible; the text is readable without excessive line spacing
- **Coverage**: Confirms `display: ruby`, `display: ruby-text`, and `display: none` on `rp` are all functioning

**Test 2**: Cross-browser rendering — Chrome (121+)

- **Given**: Same test page in Chrome DevTools
- **When**: Inspecting the `<ruby>` element in the Elements panel
- **Then**: Computed `display` on `<ruby>` is `ruby`; computed `display` on `<rt>` is `ruby-text`; computed `display` on `<rp>` is `none`
- **Coverage**: Confirms CSS rules are parsed and applied correctly in Chrome

**Test 3**: Cross-browser rendering — Firefox (38+)

- **Given**: Same test page in Firefox DevTools
- **When**: Inspecting computed styles
- **Then**: Same computed display values as Chrome test above; ruby annotation is visually above the base text
- **Coverage**: Confirms Firefox computes the same display model

**Test 4**: Cross-browser rendering — Safari

- **Given**: Same test page in Safari Web Inspector
- **When**: Inspecting computed styles on `<rt>`
- **Then**: `display: ruby-text` may show as unrecognised in computed styles (Safari does not support it), BUT the `<rt>` content still appears visually above the kanji (Safari's UA stylesheet handles this); no parentheses visible (Safari hides rp content via UA stylesheet or via our `display: none` rule which Safari does recognise)
- **Coverage**: Confirms Safari fallback path works correctly and there is no visual regression

**Test 5**: Line spacing verification

- **Given**: A paragraph with multiple lines of Japanese text, each containing at least one ruby annotation
- **When**: The page renders
- **Then**: Line spacing is even and no line is taller than the others due to the ruby annotation pushing the line apart
- **Coverage**: Confirms `line-height: 1` on `rt` prevents inter-line spacing inflation

**Test 6**: `.reading-view` utility class

- **Given**: An element with `class="reading-view"` added to any page in the app
- **When**: The element is inspected in DevTools
- **Then**: Computed `font-size` is `18px` (1.125rem at default 16px root); computed `max-width` is `65ch`
- **Coverage**: Confirms the utility class is compiled and applied correctly

**Test 7**: No regression on existing styles

- **Given**: The home page and any other existing routes
- **When**: Pages load after the CSS change
- **Then**: No visible change in existing UI; no layout shifts; no console errors
- **Coverage**: Confirms the new rules do not bleed into non-ruby elements via incorrect cascade layering

### Automated Test Consideration

This task has no TypeScript code changes, so no unit tests or integration tests are applicable. The Playwright E2E suite (configured in task 3) is the appropriate vehicle for a regression test if one is desired, but that is out of scope for this task. A Playwright test verifying that a `<ruby>` element renders visually above the baseline using `getByRole` or screenshot comparison could be added in a follow-up task.

---

## Implementation Checklist

- [ ] Checkout branch `feature/add-ruby-css-base-rules`
- [ ] Read current `app/app.css` to confirm the exact text of the existing partial `rt` rule
- [ ] Replace the existing `rt { font-size: 0.5em; ruby-position: over; }` block with the complete three-rule set (`ruby`, `rt`, `rp`) inside `@layer base`
- [ ] Append a new `@layer utilities` block with the `.reading-view` class
- [ ] Run `pnpm dev` and verify in Chrome that ruby annotation renders correctly
- [ ] Verify in Firefox
- [ ] Verify in Safari (confirm no visual regression even though `display: ruby-text` is not supported)
- [ ] Confirm `rp` parentheses are not visible in any browser
- [ ] Confirm inter-line spacing is not inflated by ruby annotations
- [ ] Run `pnpm exec eslint .` — should produce no errors (CSS is not linted by the current ESLint config)
- [ ] Run `pnpm exec prettier --write app/app.css` to format the file
- [ ] Run `pnpm type-check` — should pass unchanged (no TS changes)
- [ ] Commit and update task 13 status to `done`

---

## Notes and Considerations

**Existing partial `rt` rule**: `app/app.css` lines 144–147 already contain `rt { font-size: 0.5em; ruby-position: over; }`. This is a partial rule from a previous implementation attempt. The implementation plan replaces this with the full rule. Do not leave a duplicate `rt` block.

**`ruby-position: over` retention**: The existing `ruby-position: over` declaration is correct and should be preserved in the updated `rt` rule. It explicitly positions the annotation above the base text, which is the conventional position for Japanese furigana. Dropping it would not break anything on horizontal-writing-mode pages (browsers default to `over`), but retaining it is defensive and documents intent.

**`@layer utilities` vs no layer**: In Tailwind v4, custom CSS written outside any `@layer` directive sits in the implicit outer layer and has higher specificity than all `@layer`-d rules. Putting `.reading-view` in `@layer utilities` ensures Tailwind's own utility classes (e.g., `text-xl`) can override it when both are applied to the same element, which is the expected Tailwind ergonomic. If `.reading-view` were placed outside any layer, it would win over all Tailwind utilities unconditionally, which is undesirable.

**`65ch` and CJK fonts**: The `ch` unit is based on the advance width of the `0` character (U+0030) in the active font. For Latin fonts this is approximately half an em; for CJK fonts the `0` character is typically full-width (1 em). This means `65ch` will produce a significantly narrower column when a CJK font is active compared to a Latin font. Given the `furigana.$id.tsx` route sets `lang="ja"` and will typically trigger a CJK font fallback, the effective line length will be roughly 65 full-width characters, which is an appropriate and readable column width for Japanese prose. This is intentional.

**Do not apply `.reading-view` in this task**: The scope of task 13 is limited to adding the CSS. Applying `.reading-view` to `furigana.$id.tsx` is a separate concern that belongs to task 12 (ReadingView component) or a follow-up refactor. The current `<article>` in `furigana.$id.tsx` uses `text-xl` and a `max-w-3xl` constraint already.
