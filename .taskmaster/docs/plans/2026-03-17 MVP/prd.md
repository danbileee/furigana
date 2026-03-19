# PRD: Furigana MVP — AI Japanese Reading Assistant

Date: 2026-03-17

## Overview

Furigana is a single-page web app that helps Japanese learners read native-level text by generating furigana (small hiragana readings) above kanji characters. Users paste any Japanese text — from a sentence to a full blog article — and receive a formatted, readable version with pronunciation guides rendered inline. The goal is to remove the friction of looking up unfamiliar kanji, letting learners stay in reading flow.

## Problem Statement

Japanese learners frequently encounter kanji they cannot read, forcing them to pause, switch apps, and look up readings one by one. This breaks reading concentration and makes native-level content inaccessible to intermediate learners. There is no fast, clean tool that takes arbitrary Japanese text and instantly produces a furigana-annotated version suitable for comfortable reading.

## User Journey

1. User opens the app and sees a single clean input area with a textarea and a "Generate Furigana" button.
2. User pastes a Japanese paragraph (or a full blog article) into the textarea.
3. User clicks "Generate Furigana" or presses Cmd+Enter (Mac) / Ctrl+Enter (Windows/Linux).
4. A loading state appears while the reading annotations are being generated.
5. The main area transitions to a furigana reading view: the original text is displayed with small hiragana readings rendered directly above each kanji using ruby annotation styling.
6. The entry is saved and appears at the top of the left sidebar. A short AI-generated title (e.g., "Cherry Blossom Festival Guide") is displayed alongside a relative timestamp (e.g., "2 minutes ago"). While the title is being generated, the first ~30 characters of the submitted text serve as a placeholder.
7. User can toggle between "Always" and "On Hover" display modes using a toggle control in the reading view. "Always" keeps all readings visible; "On Hover" hides readings until the user mouses over (desktop) or taps (mobile) a specific word.
8. User can click "New" to return to the input state and submit another passage.
9. User can click any past entry in the sidebar to re-read it in the main view.
10. On mobile, the sidebar is hidden by default. A hamburger icon in the top-left opens it as a drawer overlay.
11. On page reload, the app automatically restores the last-viewed entry so the user can pick up where they left off.

## Feature Specifications

### Core Features

- **Text Input Area**: A large textarea occupying the main content area, with placeholder text prompting users to paste Japanese text. Supports input up to 10,000 characters. A character counter is displayed below the textarea, and the "Generate Furigana" button is disabled when the limit is exceeded. The "Generate Furigana" button sits below the textarea. Keyboard shortcut (Cmd/Ctrl+Enter) submits from anywhere in the textarea. This keeps the interaction model simple and familiar — paste and go.

- **Furigana Reading View**: After generation, the textarea is replaced by a styled reading panel displaying the original text with ruby annotations. Each kanji (or kanji compound) shows its hiragana reading in smaller text directly above it. Non-kanji characters (hiragana, katakana, punctuation, latin) are displayed without any annotation. The font size, line height, and ruby spacing are tuned for comfortable sustained reading — not just functional display.

- **View Mode Toggle — Always / On Hover**: A toggle control in the reading view header lets users switch between two modes. "Always" renders all furigana visible at all times, ideal for beginners. "On Hover" hides furigana by default and reveals them when the user hovers over a word (desktop) or taps it (mobile), ideal for learners who want to self-test before seeing the reading. The selected mode persists across sessions so users never have to set it again. The default mode on first visit is **Always**.

- **History Sidebar**: A left sidebar lists all past submissions in reverse-chronological order (newest at top). Each row shows an AI-generated title and a relative timestamp. Clicking a row loads that entry's furigana view in the main area and highlights the row as active. The sidebar is always visible on desktop and accessible via a drawer on mobile.

- **AI Title Generation**: When the user submits Japanese text, the app generates a short descriptive title (3–6 words, in English) for that entry in the background — after the furigana result is displayed. The title is stored with the entry and shown in the sidebar. While generation is in progress, the sidebar row shows the first ~30 characters of the submitted text as a low-contrast placeholder. Once the title arrives, it replaces the placeholder without a layout shift. If generation fails, the placeholder remains as the permanent title.

- **Inline Title Editing**: Double-clicking a sidebar history entry switches its title into an inline edit field (single-line input, pre-filled with the current title). The user can:
  - Press **Enter** or click outside (blur) to confirm and save the new title
  - Press **Escape** to cancel and restore the previous title

  The updated title is saved persistently and updates the reading view header immediately on confirmation. An empty or whitespace-only submission restores the previous title silently — blank titles are not allowed. Title editing via double-click is not supported on mobile in this version and may be considered for a future iteration.

- **Delete Entry**: On desktop, hovering over a sidebar row reveals a trash icon on the right side of the row. Clicking the icon immediately removes the row from the sidebar and shows an "Entry deleted" toast notification at the bottom of the screen. The deleted entry moves to a soft-delete trash store and is not permanently removed. Users can access a **Trash menu** via a trash icon shown at the bottom of the left sidebar. From the Trash menu, users can restore individual entries back to the sidebar in their original chronological position. Entries in the Trash are permanently deleted when the user explicitly empties the trash or after a reasonable retention period (to be determined in implementation).

- **Trash Menu**: A trash icon at the bottom of the left sidebar opens the Trash menu — a list of soft-deleted entries. Each row shows the entry title and deletion timestamp. Users can restore any entry, which returns it to the sidebar at its original chronological position. Users can also permanently delete individual entries or empty the entire trash. The Trash menu is accessible on both desktop and mobile.

- **New Button**: A "New" button in the sidebar header (or top bar) resets the main area to the empty textarea input state, allowing the user to submit a new passage without navigating away. The current entry in the sidebar remains saved and accessible.

- **Session Persistence**: When the user reloads the page, the app automatically displays the most recently viewed entry (not just the most recently created one) in the main view, with furigana already rendered. If there are no saved entries, the app shows the empty input state. If the last-viewed entry has been deleted (moved to Trash), the app also falls back to the empty input state rather than attempting to display the deleted entry. This ensures the user never loses their place.

- **Mobile Sidebar Drawer**: On screens below the desktop breakpoint, the sidebar is hidden. A hamburger icon in the top-left corner opens the sidebar as a full-height overlay drawer. Tapping a sidebar entry or tapping outside the drawer closes it. The main reading view and input area are not affected by the drawer state.

### Interactions & Behaviors

- **Submission Loading State**: From the moment the user submits until the furigana result is ready, the "Generate Furigana" button is disabled and shows a spinner or loading label. The textarea remains visible but is also disabled during this period. If the request takes longer than expected, no timeout message is shown unless an actual error occurs — the user simply waits.

- **Furigana Toggle Transition**: Switching between "Always" and "On Hover" modes takes effect instantly without any page reload or re-fetch. The change is visual only — the underlying annotation data is already present.

- **Sidebar Active State**: The currently displayed entry is visually highlighted in the sidebar (e.g., with a distinct background color). If the user is in the "New" input state (no entry loaded), no sidebar row is highlighted.

- **Relative Timestamps**: Sidebar timestamps update to reflect time passing (e.g., "just now" transitions to "5 minutes ago" as time passes). Timestamps older than 24 hours show the date instead (e.g., "Mar 15").

- **Empty State**: When there are no history entries, the sidebar shows a subtle empty state message (e.g., "No entries yet"). The main area always defaults to the input textarea in this case.

- **Cmd/Ctrl+Enter Shortcut**: The shortcut works only when the textarea is focused. It does not trigger submission if the textarea is empty (same behavior as the button).

- **AI Title Loading Placeholder**: While the AI-generated title is being fetched, the sidebar row shows the first ~30 characters of the submitted text in a visually subdued style. Once the title arrives, it replaces the placeholder with a smooth text transition and no layout jump.

- **Inline Title Edit Flow**: Double-clicking a sidebar row title activates an inline input field pre-filled with the current title. Confirming (Enter or blur) saves the new title if non-empty; an empty or whitespace-only value silently restores the previous title. Escape always cancels. The edit field does not interfere with furigana generation or any other app action. This interaction is desktop-only; no equivalent gesture is provided on mobile for MVP.

- **Trash Menu Access**: The trash icon is always visible at the bottom of the left sidebar (desktop and mobile). Clicking it opens the Trash menu as a panel or overlay. Restoring an entry from trash closes the menu and immediately shows the restored entry in the sidebar. If the restored entry was the last-viewed entry, it is also re-displayed in the main view.

### UI/UX Considerations

- **Reading-First Typography**: The furigana reading view uses generous line height and font sizing to make ruby annotations readable without crowding. This is not a compact utility view — it should feel like a pleasant reading experience.

- **Minimal Chrome**: The app has no navigation bar, no settings page, and no account UI. The entire interface is the sidebar plus the main content area. Every element visible on screen serves the current task.

- **Input as the Default State**: A user who has no history lands directly on the input area — no onboarding modal, no splash screen. The placeholder text inside the textarea is the only guide they need.

- **Hover-Only Affordance on Desktop**: The trash icon for delete is intentionally hidden until hover to avoid visual clutter in the sidebar. On mobile (where hover does not exist), the trash icon is visible at all times on each sidebar row, since there is no alternative affordance.

- **Responsive Layout Priority**: On mobile, the reading view is the primary focus. The sidebar is secondary and requires explicit intent (hamburger tap) to access. This ensures the reading area is not squeezed.

## Edge Cases & Error Handling

- **Empty Submission**: If the user clicks "Generate Furigana" or uses the keyboard shortcut with an empty textarea, nothing happens. No error message is shown. The button remains in its default state.

- **No Kanji in Input**: If the submitted text contains no kanji (e.g., pure hiragana or romaji), the text is displayed as-is in the reading view without any ruby annotations. No error is shown — the output is simply the original text displayed in the reading panel.

- **Generation Failure**: If the furigana generation request fails (network error, service unavailable, etc.), the loading state clears and a brief inline error message appears below the textarea: "Something went wrong. Please try again." The textarea content is preserved so the user does not lose their pasted text.

- **Input Character Limit**: The textarea enforces a 10,000-character maximum. The submit button is disabled and the character counter highlights when the limit is reached. Text beyond 10,000 characters cannot be entered. This cap protects against disproportionate API costs while covering the vast majority of real-world reading passages.

- **Deleting the Currently Viewed Entry**: If the user deletes an entry that is currently displayed in the main view, the main view immediately switches to the next most recent entry. If no entries remain, the main view shows the empty input state. On page reload, if the last-viewed entry ID refers to a deleted or non-existent entry, the app falls back to the empty input state for a new entry.

- **Restoring the Active Entry from Trash**: If the entry currently displayed in the main view is deleted, the main view falls back to the empty input state (per the "Deleted Entry" edge case). If the user later restores that entry from the Trash menu, the sidebar updates but the main view does not automatically switch — the user must click the restored entry to view it again.

- **Reload With No History**: If the user reloads with no saved entries, the app opens to the empty textarea input state, identical to first-time use.

- **Sidebar Overflow**: If the user accumulates many entries, the sidebar scrolls independently of the main content area. There is no pagination — all entries are always listed.

- **AI Title Generation Failure**: If the title generation call fails or times out, the sidebar entry permanently displays the first ~30 characters of the submitted text as its title. No error is surfaced to the user — the fallback is indistinguishable from a successfully titled entry.

- **Title Edit — Empty Input**: If the user clears the title field and presses Enter (or blurs), the edit is discarded and the previous title is restored silently. Blank titles are never saved.

## Out of Scope

- User authentication or accounts
- Cloud sync across devices
- Sharing or exporting entries
- Per-word vocabulary lookup or dictionary integration
- Audio pronunciation playback
- Sentence-by-sentence reading mode
- Furigana editing or correction by the user
- Support for Traditional/Simplified Chinese or other CJK languages
- Dark mode toggle (can be considered in a later iteration)
- Offline support

## Success Criteria

- A user can paste Japanese text, submit, and receive a furigana-annotated reading view within a reasonable wait time, with no broken or missing annotations on kanji that exist in standard Japanese usage.
- The "On Hover" mode correctly hides all furigana on desktop until mouseenter on a word, and reveals them on tap on mobile.
- Deleting an entry moves it to the Trash. Restoring it from the Trash menu returns it to its original sidebar position with no data loss.
- Reloading the page restores the last-viewed entry, including its rendered furigana, without requiring re-submission.
- On a mobile viewport, the sidebar is not visible on load, the hamburger opens it as a drawer, and tapping an entry closes the drawer and displays the entry.
- The view mode preference (Always vs. On Hover) is remembered across page reloads and new sessions.
- Submitting with an empty textarea performs no action and triggers no error state.
- A failed generation request restores the textarea to an editable state with the original content intact and displays a clear retry message.
- After furigana generation completes, the sidebar entry transitions from a truncated text placeholder to an AI-generated descriptive title with no layout shift.
- Double-clicking a sidebar title enters inline edit mode; saving a non-empty value updates both the sidebar and the reading view header immediately; pressing Escape restores the original title.
