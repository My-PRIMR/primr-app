# AUDIT: primr-app

## 1. Hardcoded color violations

### Hardcoded hex colors in `.module.css` files (violations)

The following files contain bare hex values not used as CSS variable fallbacks. Entries using `var(--token, #fallback)` are noted separately as "fallback pattern" — they are lesser violations but technically still hardcode a color if the token is missing.

**app/login/page.module.css**
- `:74` — `color: #d94f4f;` — bare hex (error red, no token equivalent)
- `:85` — `color: #fff;` — bare hex (white on dark button)

**app/upgrade/page.module.css**
- `:86` — `color: #fff;`
- `:185` — `color: #fff;`
- `:297` — `color: #fff;`
- `:320` — `color: var(--coral, #E8453C);` — fallback hex (acceptable pattern but uses non-standard token name)

**app/(shell)/account/security/page.module.css**
- `:63` — `color: #d94f4f;`
- `:69` — `color: #2e7d32;` — bare hex (success green, no token)
- `:80` — `color: #fff;`

**app/components/UpgradeModal.module.css** — HIGH VIOLATION COUNT (18 bare hex values)
- `:17` — `background: #FFFFFF;`
- `:37` — `color: #8A8FA8;`
- `:43` — `color: #0F1117;`
- `:50` — `color: #6B5CE7;`
- `:51` — `background: #EAE7FB;`
- `:63` — `color: #0F1117;`
- `:69` — `color: #4A4D5E;`
- `:91` — `color: #6B5CE7;`
- `:101` — `color: #0F1117;`
- `:108` — `color: #8A8FA8;`
- `:114` — `color: #d94f4f;`
- `:124` — `color: #0F1117;`
- `:130` — `color: #8A8FA8;`
- `:140` — `background: #fff;`
- `:141` — `color: #0F1117;`
- `:147` — `border-color: #6B5CE7;`
- `:155` — `color: #fff;`
- `:156` — `background: #6B5CE7;`
- `:169` — `color: #8A8FA8;`

**app/apply-teacher/ApplyTeacher.module.css**
- `:198` — `color: var(--color-coral, #c00);` — fallback hex (`#c00` doesn't match design system coral)

**app/components/PageHeader.module.css**
- `:19` — `color: var(--ink, #0F1117);` — fallback (acceptable pattern)
- `:29` — `color: var(--ink-muted, #8A8FA8);` — fallback

**app/learn/[id]/FeedbackOverlay.module.css**
- `:91` — `color: #fff;` — bare hex inside a lesson-path file (minor, white on teal button)
- Other entries use `var(--token, fallback)` pattern

**app/upgrade/success/page.module.css**
- `:77` — `color: #fff;`

**app/embed/course/[id]/EmbedCoursePlayer.module.css**
- `:210` — `color: #fff;`

**app/(shell)/team/page.module.css**
- `:110` — `color: #fff;`
- `:150` — `color: #fff;`
- Other entries use `var(--coral, #E8453C)` fallback pattern

**app/components/UserMenu.module.css**
- `:11` — `color: #fff;`

**app/components/shell/ShellUserMenu.module.css**
- `:10` — `color: #fff;`

**app/components/Paywall.module.css**
- `:68` — `color: #fff;`
- `:110` — `color: #d94f4f;` — bare hex

**app/(shell)/page.module.css**
- `:87` — `color: #fff;`

**app/(shell)/settings/billing/page.module.css**
- `:65` — `color: #fff;`
- `:137` — `color: #fff;`

**app/learn/course/[id]/CoursePlayer.module.css**
- `:2` — `--green: #16a34a;` — local CSS variable defined as hex
- `:184` — `color: #dc2626;` — bare hex (error red)
- `:245` — `color: #fff;`
- `:267` — `color: #fff;`

**app/(shell)/creator/page.module.css**
- `:9` — `color: #fff;`
- `:107` — `color: #c0392b;` — bare hex (delete red)
- `:114` — `color: #a93226;` — bare hex

**app/(shell)/team/accept/[token]/page.module.css**
- `:42` — `color: #fff;`

**app/(shell)/creator/components/LessonBlockEditor.module.css**
- `:102` — `color: #fff;`
- `:110` — `color: #EDEEF5;` — bare hex
- `:111` — `background: #1A1C28;` — bare hex (dark code panel background)
- `:119` — `color: #fff;`

**app/(shell)/creator/new/components/OutlineEditor.module.css**
- `:186` — `color: #d94f4f;`
- `:198` — `color: #fff;`
- `:90` — `rgba(217,79,79,0.08)` — inline rgb (in hover state)

**app/(shell)/creator/InviteModal.module.css**
- `:85` — `color: #fff;`
- `:175` — `color: #e03c3c;`
- `:188` — `color: #e03c3c;`

**app/(shell)/creator/components/BlockPickerModal.module.css**
- `:120` — `color: #000;` — bare hex (black on amber badge)

**app/(shell)/creator/new/components/StepIndicator.module.css**
- `:44` — `color: #fff;`
- `:51` — `color: #fff;`

**app/(shell)/creator/monetization/page.module.css**
- `:58` — `color: #16a34a;`

**app/(shell)/creator/video-status/[id]/page.module.css**
- `:3` — `--coral: #E85D3A;` — local CSS variable as hex
- `:4` — `--coral-soft: #FAEAE5;`
- `:2` — `--teal-soft: #E0F5F1;`

**app/(shell)/creator/new/page.module.css**
- `:123` — `color: #fff;`
- `:140` — `color: #d94f4f;`
- `:314` — `color: #fff;`
- `:341` — `color: #e55;` — bare 3-digit hex

**app/(shell)/creator/edit/[id]/PricingSection.module.css**
- `:85` — `color: #fff;`
- `:102` — `color: #16a34a;`
- `:107` — `color: #d94f4f;`

**app/(shell)/creator/edit/[id]/EditClient.module.css**
- `:360` — `color: #fff;`
- `:390` — `color: #e55;`

**app/(shell)/creator/new/components/ImageSection.module.css**
- `:130` — `color: #fff;`
- `:147` — `color: #d94f4f;`
- `:416` — `color: #fff;`
- `:473` — `color: #d94f4f;`

**app/(shell)/creator/new/components/VideoIngestForm.module.css**
- `:29` — `color: #fff;`
- `:34` — `color: #fff;`
- `:43` — `border-color: #d94f4f !important;`
- `:48` — `color: #d94f4f;`

**app/(shell)/creator/new/components/BlockEditPanel.module.css**
- `:110` — `color: #EDEEF5;`
- `:111` — `background: #1A1C28;`
- `:459` — `color: #fff;`

**app/(shell)/creator/CreatorDashboard.module.css**
- `:93` — `color: #fff;`
- `:94` — `background: #c0392b;`
- `:305` — `color: #c0392b;`
- `:311` — `color: #a93226;`
- `:317` — `color: #fff;`

**app/(shell)/creator/monetization/SubscriptionSettings.module.css**
- `:74` — `color: #fff;`
- `:96` — `color: #16a34a;`
- `:103` — `color: #d94f4f;`

**app/(shell)/creator/new/components/Step1Form.module.css**
- `:183` — `color: #d94f4f;`
- `:188` — `color: #d94f4f;`
- `:200` — `color: #fff;`
- `:212` — `color: #d94f4f;`

**app/(shell)/creator/monetization/ConnectStripeButton.module.css**
- `:12` — `color: #fff;`
- `:32` — `color: #d94f4f;`

**app/(shell)/creator/EmbedCodeModal.module.css**
- `:111` — `color: #fff;`

**app/(shell)/creator/ActionsDropdown.module.css**
- `:70` — `color: #c0392b;`
- `:74` — `color: #a93226;`

**app/(shell)/settings/page.module.css**
- `:99` — `color: #d94f4f;`
- `:105` — `color: #16a34a;`
- `:117` — `color: #fff;`

**app/(shell)/creator/courses/new/CourseWizard.module.css**
- `:2` — `--green: #16a34a;` — local CSS variable as hex
- `:3` — `--red: #dc2626;`
- `:45` — `color: #fff;`
- `:75` — `background: #fef2f2;` — bare hex (error surface)
- `:76` — `border: 1px solid #fecaca;`
- `:440` — `background: #fef3c7;`
- `:441` — `color: #92400e;`
- `:514` — `color: #fff;`

**app/(shell)/creator/courses/[id]/edit/CourseEditClient.module.css**
- `:3` — `--surface-deep: #F0EEF9;` — local CSS variable as hex
- `:4` — `--green: #22C55E;`
- `:5` — `--red: #EF4444;`

**app/(shell)/creator/courses/[id]/edit/PricingSection.module.css**
- `:103` — `color: #fff;`
- `:120` — `color: #16a34a;`
- `:125` — `color: #d94f4f;`

### Inline style color violations in `.tsx` files

**app/learn/[id]/LessonPlayer.tsx**
- `:130` — `style={{ padding: '2rem', color: '#d94f4f' }}` — bare hex in inline style on error div
- `:142` — `fontFamily: 'DM Sans, system-ui, sans-serif'` — hardcoded font in inline style (see Section 2)
- `:149` — `background: mode === 'showcase' ? 'var(--accent, #7C8EF7)' : 'transparent'` — fallback hex in inline style

### globals.css
- `:7` — `font-family: 'DM Sans', system-ui, sans-serif;` — hardcoded font (see Section 2; body baseline may be intentional but should use `var(--font-body)`)

---

## 2. Hardcoded font-family violations

The following `.module.css` files hardcode font family names instead of using `var(--font-heading)`, `var(--font-body)`, or `var(--font-mono)`. This is pervasive — nearly every module-level CSS file is affected.

**Confirmed violations (representative list — all `.module.css` files affected):**

| File | Token to use |
|---|---|
| `app/login/page.module.css:20` — `'DM Serif Display', Georgia, serif` | `var(--font-heading)` |
| `app/login/page.module.css:53,79,103` — `'DM Sans', system-ui, sans-serif` | `var(--font-body)` |
| `app/apply-teacher/ApplyTeacher.module.css:5,174` — `'DM Sans'` | `var(--font-body)` |
| `app/apply-teacher/ApplyTeacher.module.css:30,70,102` — `'DM Mono', monospace` | `var(--font-mono)` |
| `app/apply-teacher/ApplyTeacher.module.css:40` — `'DM Serif Display', serif` | `var(--font-heading)` |
| `app/components/UpgradeModal.module.css:60` — `'DM Serif Display', Georgia, serif` | `var(--font-heading)` |
| `app/upgrade/page.module.css` — multiple instances of all three font names | All three font tokens |
| `app/upgrade/success/page.module.css` — multiple | All three font tokens |
| `app/(shell)/account/security/page.module.css` — multiple | Body + heading tokens |
| `app/components/shell/AppShell.module.css:6` — `'DM Sans'` | `var(--font-body)` |
| `app/components/shell/SideNavItem.module.css:18,103` — `'DM Sans'` | `var(--font-body)` |
| `app/components/shell/ShellHeader.module.css:49` — `'DM Serif Display'` | `var(--font-heading)` |
| `app/components/shell/ShellUserMenu.module.css:13` — `'DM Sans'` | `var(--font-body)` |
| `app/components/PageHeader.module.css:16` — `'DM Serif Display'` | `var(--font-heading)` |
| `app/components/PageHeader.module.css:26` — `'DM Sans'` | `var(--font-body)` |
| `app/components/Paywall.module.css:34` — `'DM Serif Display'` | `var(--font-heading)` |
| `app/components/Paywall.module.css:50` — `'DM Mono', monospace` | `var(--font-mono)` |
| `app/components/Paywall.module.css:65,87` — `'DM Sans'` | `var(--font-body)` |
| `app/learn/LearnHeader.module.css:22` — `'DM Sans'` | `var(--font-body)` |
| `app/learn/LearnHeader.module.css:33` — `'DM Serif Display'` | `var(--font-heading)` |
| `app/learn/[id]/FeedbackOverlay.module.css:31` — `'DM Serif Display', serif` | `var(--font-heading)` |
| `app/learn/[id]/FeedbackOverlay.module.css:68,94,107` — `DM Sans, system-ui, sans-serif` (unquoted) | `var(--font-body)` |
| `app/learn/course/[id]/CoursePlayer.module.css:22,229` — `'DM Serif Display'` | `var(--font-heading)` |
| `app/embed/course/[id]/EmbedCoursePlayer.module.css:185` — `'DM Serif Display'` | `var(--font-heading)` |
| `app/(shell)/settings/page.module.css:5,45,84,110` — `'DM Sans'` | `var(--font-body)` |
| `app/(shell)/settings/page.module.css:9` — `'DM Serif Display'` | `var(--font-heading)` |
| `app/(shell)/settings/billing/page.module.css` — multiple | Body + heading tokens |
| `app/(shell)/team/page.module.css` — multiple | Body + heading tokens |
| `app/(shell)/team/accept/[token]/page.module.css` — multiple | Body + heading tokens |
| `app/(shell)/creator/page.module.css:35,72` | Body + heading tokens |
| `app/(shell)/creator/CreatorDashboard.module.css:9,82,90,172,202,302,314,330` | `var(--font-body)` |
| `app/(shell)/creator/DashboardSummary.module.css:43` — `'DM Serif Display'` | `var(--font-heading)` |
| `app/(shell)/creator/ActionsDropdown.module.css:9,46` — `'DM Sans'` | `var(--font-body)` |
| `app/(shell)/creator/InviteModal.module.css` (no font-family found — clean) | — |
| `app/(shell)/creator/EmbedCodeModal.module.css:99` — `'DM Mono', monospace` | `var(--font-mono)` |
| `app/(shell)/creator/components/LessonBlockEditor.module.css` — multiple | Body + heading tokens |
| `app/(shell)/creator/components/BlockPickerModal.module.css:68,93,147` — `'DM Sans'` | `var(--font-body)` |
| `app/(shell)/creator/edit/[id]/EditClient.module.css` — multiple | Body font token |
| `app/(shell)/creator/edit/[id]/PricingSection.module.css` — multiple | Body font token |
| `app/(shell)/creator/courses/[id]/edit/CourseEditClient.module.css` — multiple | Body font token |
| `app/(shell)/creator/courses/[id]/edit/PricingSection.module.css` — multiple | Body font token |
| `app/(shell)/creator/courses/new/CourseWizard.module.css:61,334,689` | Heading + body tokens |
| `app/(shell)/creator/courses/[id]/results/page.module.css:5,22` | Body + heading tokens |
| `app/(shell)/creator/lessons/[id]/results/page.module.css:5,22` | Body + heading tokens |
| `app/(shell)/creator/monetization/page.module.css:20,41` — `'DM Serif Display'` | `var(--font-heading)` |
| `app/(shell)/creator/monetization/RevenueSummary.module.css:10` — `'DM Serif Display'` | `var(--font-heading)` |
| `app/(shell)/creator/monetization/RevenueSummary.module.css:24` — `'DM Mono', monospace` | `var(--font-mono)` |
| `app/(shell)/creator/monetization/SubscriptionSettings.module.css:9` — `'DM Serif Display'` | `var(--font-heading)` |
| `app/(shell)/creator/monetization/SubscriptionSettings.module.css:54,71` — `'DM Sans'` | `var(--font-body)` |
| `app/(shell)/creator/monetization/ConnectStripeButton.module.css:9` — `'DM Sans'` | `var(--font-body)` |
| `app/(shell)/creator/new/page.module.css` — multiple | Body + heading tokens |
| `app/(shell)/creator/new/components/BlockEditPanel.module.css:25,33,137,182,217,274,345` | All three tokens |
| `app/(shell)/creator/new/components/ImageSection.module.css:62,68,118,133,226,264,327,397` | Body + mono tokens |
| `app/(shell)/creator/new/components/OutlineEditor.module.css:10,79,95,119,130,161,175,192` | Body + heading tokens |
| `app/(shell)/creator/new/components/Step1Form.module.css:10,38,89,133,172,194,326` | Body + heading tokens |
| `app/(shell)/creator/new/components/VideoIngestForm.module.css` (no font-family) | — |
| `app/(shell)/creator/video-status/[id]/page.module.css:8,19` | Body + heading tokens |
| `app/(shell)/creator/[creatorSlug]/page.module.css:19,28,59,93,144` | All three tokens |

**Inline style violations (`.tsx` files):**
- `app/learn/[id]/LessonPlayer.tsx:142` — `fontFamily: 'DM Sans, system-ui, sans-serif'` (inside inline style)

**globals.css:**
- `:7` — `font-family: 'DM Sans', system-ui, sans-serif;` — hardcodes the body font; should use `var(--font-body)` once that token is defined in `@primr/tokens`.

**Exceptions (compliant):**
- `app/creator/embed-preview/[type]/[id]/EmbedPreview.module.css:6` — `font-family: var(--font-sans, system-ui, sans-serif);` — uses token variable (minor note: token name is `--font-sans` not `--font-body` — check token name alignment)
- `app/components/PriceBadge.module.css:13` — `font-family: var(--font-mono, 'DM Mono', monospace);` — uses token variable with fallback
- `app/(shell)/creator/components/LessonBlockEditor.module.css:396,422` — `var(--font-body)` and `var(--font-mono)` — correctly uses tokens

---

## 3. Hardcoded border-radius violations

Nearly every `.module.css` file uses pixel-value `border-radius` instead of the token scale (`--radius-sm` = 6px, `--radius-md` = 10px, `--radius-lg` = 16px). Below are the violations that map to token values, plus notes on values that are genuinely custom.

**Token-mappable violations (sample — the pattern is pervasive across all module files):**

- `border-radius: 6px` → should be `var(--radius-sm)` — appears in: `UpgradeModal.module.css:38`, `EmbedAnalytics.module.css:31`, `InviteModal.module.css:68,88,113`, `LessonBlockEditor.module.css` (many), `BlockPickerModal.module.css:72`, `creator/edit/[id]/EditClient.module.css:30,96,115,149,282,346,358,398`, `OutlineEditor.module.css:100,124`, `creator/new/page.module.css:29,232,303,312,349`, `BlockEditPanel.module.css:112,142,350,425,436,457,474`, `ImageSection.module.css:184,231,269,306,387`, `EmbedCodeModal.module.css:87`, `EmbedPreview.module.css:32,55,74,91`, `ActionsDropdown.module.css:15`, `SideNav.module.css:35`, `ShellHeader.module.css:26`, `CourseWizard.module.css:189`, and many more
- `border-radius: 10px` → should be `var(--radius-md)` — appears in: `OnboardingStrip.module.css:4`, `EmbedAnalytics.module.css:9`, `creator/page.module.css:64`, `creator/[creatorSlug]/page.module.css:56`, `DashboardSummary.module.css:13`, `creator/new/page.module.css:250,285`, `BlockEditPanel.module.css:325`, `OutlineEditor.module.css:136,151`, `CourseWizard.module.css:207,357,439,448`, `lessons/[id]/results/page.module.css:44,93,166`, `courses/[id]/results/page.module.css:44,93`, `video-status/[id]/page.module.css:109,172`, `Step1Form.module.css:43,230`, `CreatorDashboard.module.css:143,400,429,553`
- `border-radius: 16px` → should be `var(--radius-lg)` — appears in: `login/page.module.css:14`, `account/security/page.module.css:14`, `UpgradeModal.module.css:19`, `Paywall.module.css:14`, `video-status/[id]/page.module.css:39`
- `border-radius: 8px` → no exact token match (between sm=6 and md=10) — appears in: `login/page.module.css:58,83`, `team/page.module.css:102,134,153`, `upgrade/page.module.css:188,276,300`, `settings/billing/page.module.css:68,95,140`, `OnboardingStrip.module.css:52,92`, `CourseWizard.module.css:79,111,124,138,276,515,532,558,646`, `VideoIngestForm.module.css:5`, `ImageSection.module.css:19,98,422`, `Step1Form.module.css:139,161,198,273`, `upgrade/success/page.module.css:67`, `apply-teacher/ApplyTeacher.module.css:159,179`, and many others — these 8px values need a design decision (use `--radius-sm` and accept 6px, or introduce a `--radius-sm-plus` token)
- `border-radius: 12px` → no exact token match — appears in: `team/page.module.css:35`, `team/accept/[token]/page.module.css:14`, `InviteModal.module.css:14`, `upgrade/page.module.css:110,219`, `settings/billing/page.module.css:31`, `monetization/page.module.css:35`, `creator/edit/[id]/EditClient.module.css:47,127`, `FeedbackOverlay.module.css:20`, `UserMenu.module.css:32`, `ShellUserMenu.module.css:29`, `LessonBlockEditor.module.css:149`, `EmbedCodeModal.module.css:14`, `BlockPickerModal.module.css:16`, `EmbedPreview.module.css:117`, `creator/[creatorSlug]/page.module.css:115,175`, `monetization/SubscriptionSettings.module.css:3`, `RevenueSummary.module.css:3`, `apply-teacher/ApplyTeacher.module.css:64,124`, `CourseWizard.module.css:56 (14px — very close)`, `creator/page.module.css:124`

**Intentional / acceptable values:**
- `border-radius: 50%` — circle shape. Present in many files for avatar/icon circles. Acceptable.
- `border-radius: 999px` / `9999px` — pill shape. Present in `team/page.module.css:89`, `upgrade/page.module.css:61,71`, `VideoIngestForm.module.css:74`, `EmbedPreview.module.css:64`, `RevenueSummary.module.css:33`, `lessons/[id]/results/page.module.css:291`. Acceptable for badges.
- `border-radius: 0` — sharp corners. Acceptable.
- `border-radius: 2px`, `3px`, `4px`, `5px`, `7px` — sub-token micro-detail values (progress bars, chart bars, nav indicators). Flag as drift but lower priority.
- `border-radius: 20px` — large card/pill variant. No token. Appears in `(shell)/page.module.css:49`, `OutlineEditor.module.css:166`, `creator/new/page.module.css:158,260`, `EditClient.module.css:311`, `CreatorDashboard.module.css:36`, various dashboard chips. Consider `--radius-xl` token or use `var(--radius-lg)`.

**Compliant (uses token):**
- `app/learn/course/[id]/CoursePlayer.module.css:246,268` — `border-radius: var(--radius-sm)` — CORRECT
- `app/embed/course/[id]/EmbedCoursePlayer.module.css:212` — `border-radius: var(--radius-sm)` — CORRECT

---

## 4. prefers-color-scheme usage

None found.

---

## 5. themes.css import locations

| File | Path classification | Status |
|---|---|---|
| `app/embed/layout.tsx:2` | `app/embed/` — embed lesson/course rendering routes | LEGITIMATE |

**All `themes.css` occurrences in non-CSS files:**
- `CLAUDE.md` — documentation only, not an import
- `app/embed/layout.tsx` — the only actual import in code

**By design — no import needed in learn/ routes:**
`learn/[id]` and `learn/course/[id]` intentionally do not apply creator-chosen themes. Creator themes apply only in embedded content (`app/embed/**`). Native in-app lesson playback uses the platform's default token styling. This is correct behavior.

---

## 6. data-primr-theme usage

| File | Line | Usage context | Status |
|---|---|---|---|
| `app/embed/lesson/[id]/EmbedLessonClient.tsx` | `:18` | `document.body.setAttribute('data-primr-theme', theme)` — sets on `document.body` for the full embed page; the embed layout is a minimal shell with no nav chrome | LEGITIMATE (embed is a full-page lesson frame) |
| `app/embed/layout.tsx` | `:38` | `document.body.setAttribute('data-primr-theme', theme)` — same embed layout, sets on body in response to `primr-theme-change` postMessage | LEGITIMATE |
| `app/embed/course/[id]/EmbedCoursePlayer.tsx` | `:80` | `document.body.setAttribute('data-primr-theme', theme)` — sets on body for embed course page | LEGITIMATE (embed is a full-page frame) |

**Gaps and concerns:**

1. All three `data-primr-theme` usages set it on `document.body` rather than on a wrapper element enclosing only `<LessonRenderer>`. For embed routes this is acceptable since the entire page IS the lesson. However, the CLAUDE.md contract recommends wrapping the element, not the body, so that future additions (e.g. a nav bar or footer) outside the lesson subtree are not affected by the theme.

2. `app/learn/[id]/LessonPlayer.tsx` — no `data-primr-theme` by design. Native in-app lesson playback does not apply creator-chosen themes; that is intentional product behavior. Themes apply in embed routes only.

3. `app/learn/course/[id]/CoursePlayer.tsx` — same intentional behavior.

---

## 7. LessonManifest / BlockConfig type redeclarations

No declarations found. All references are imports from `@primr/components`.

`src/types/outline.ts:62` — `export { type LessonManifest, type BlockConfig }` — this is a re-export (not a redeclaration) of types imported from `@primr/components`. The types are forwarded for use within the app without defining a new type. **Technically compliant**, but this pattern creates a second path from which other files could mistakenly import these types (`@/types/outline` instead of `@primr/components`). Recommend auditing any downstream imports.

---

## 8. Block type / prompt-schema drift

### Types in @primr/components BlockConfig union:
```
hero
hero-new
narrative
step-navigator
quiz
flashcard
fill-in-the-blank
media
diagram
code-sandbox
hotspot-image
decision-tree
sort-rank
code-runner
equation-renderer
equation-fill-in-the-blank
graph-plotter
reaction-balancer
anatomy-labeler
circuit-builder
chart-builder
clickable-map
sql-sandbox
audio-pronunciation
financial-calculator
statute-annotator
physics-simulator
drag-and-drop
exam
math-problem
number-line
coordinate-plane
```
(32 total)

### Types defined in @primr/components block-schemas.ts (BLOCK_SCHEMAS — injected into all AI prompts):
```
hero
hero-new
narrative
step-navigator
media
quiz
flashcard
fill-in-the-blank
exam
hotspot-image
decision-tree
sort-rank
code-runner
equation-renderer
equation-fill-in-the-blank
graph-plotter
reaction-balancer
anatomy-labeler
circuit-builder
chart-builder
clickable-map
sql-sandbox
audio-pronunciation
financial-calculator
statute-annotator
physics-simulator
number-line
coordinate-plane
math-problem
```
(29 total — excludes `diagram`, `code-sandbox`, `drag-and-drop`)

### Types in the outline-system prompt (the block list fed to the AI for outline generation):
```
hero
narrative
step-navigator
media
equation-renderer
equation-fill-in-the-blank
graph-plotter
physics-simulator
financial-calculator
reaction-balancer
circuit-builder
code-runner
sql-sandbox
hotspot-image
sort-rank
quiz
flashcard
fill-in-the-blank
exam
```
(19 total — subset of the full schema list)

### In prompts but NOT in @primr/components (critical drift — renderer cannot render these):
**None.** All types in the prompt schemas exist in the `BlockConfig` union.

### In @primr/components BlockConfig union but NOT in any prompt schema (missing from generation):

**Missing from BLOCK_SCHEMAS (not injectable by AI at all):**
- `diagram` — in `BlockConfig` union but no schema defined in `block-schemas.ts`; AI cannot produce it
- `code-sandbox` — same as above; likely a legacy or placeholder type

**Missing from BLOCK_SCHEMAS and outline prompt (AI cannot generate in any path):**
- `drag-and-drop` — has a full props interface in `index.ts` and a schema in `block-schemas.ts` BUT is **absent from `block-schemas.ts`'s `RAW_DEFINITIONS` array** (checked: it is not in the exported `BLOCK_SCHEMAS` string). The type exists in the `BlockConfig` union but the schema was never added to `block-schemas.ts`. This means drag-and-drop **cannot be generated** by the AI.

**Missing from outline-system prompt but present in BLOCK_SCHEMAS (AI can generate them in lesson-gen but not plan for them in outlines):**
- `hero-new` — in BLOCK_SCHEMAS but not in outline type list
- `decision-tree` — in BLOCK_SCHEMAS but not in outline type list
- `anatomy-labeler` — in BLOCK_SCHEMAS but not in outline type list
- `chart-builder` — in BLOCK_SCHEMAS but not in outline type list
- `clickable-map` — in BLOCK_SCHEMAS but not in outline type list
- `audio-pronunciation` — in BLOCK_SCHEMAS but not in outline type list
- `statute-annotator` — in BLOCK_SCHEMAS but not in outline type list
- `number-line` — in BLOCK_SCHEMAS but not in outline type list
- `coordinate-plane` — in BLOCK_SCHEMAS but not in outline type list
- `math-problem` — in BLOCK_SCHEMAS but not in outline type list

**Note on `src/types/outline.ts` BlockType:**
This file defines a local `BlockType` union at line 3 that is a subset of `BlockConfig['type']`. It does not match the current schema list — it is missing `hero-new`, `decision-tree`, `anatomy-labeler`, `chart-builder`, `clickable-map`, `audio-pronunciation`, `statute-annotator`, `drag-and-drop`, `exam`, `math-problem`, `number-line`, `coordinate-plane`. This type drives the `OutlineBlock` shape and could cause TypeScript errors or runtime issues if the AI returns a type not in this local union.

---

## Summary

| Category | Violation Count | Severity |
|---|---|---|
| 1. Hardcoded colors | ~170+ instances across 40+ files | HIGH — systemic |
| 2. Hardcoded font-family | ~160+ instances across ~40 files | HIGH — systemic |
| 3. Hardcoded border-radius | ~200+ instances across all CSS files | MEDIUM — only 2 files use token correctly |
| 4. prefers-color-scheme | 0 | CLEAN |
| 5. themes.css in non-lesson paths | 0 flagged (1 legitimate import) | CLEAN |
| 6. data-primr-theme misuse | 0 flagged (3 legitimate embed usages) | CLEAN — learn/ routes intentionally do not apply creator themes (embed-only behavior) |
| 7. LessonManifest / BlockConfig redeclarations | 0 redeclarations | CLEAN |
| 8. Block type drift — in prompts but not in components | 0 | CLEAN |
| 8. Block type drift — in components but not in prompts | `diagram`, `code-sandbox` (no schema), `drag-and-drop` (schema missing from RAW_DEFINITIONS), 10 types absent from outline prompt | MEDIUM |

### Critical items to address:

1. **`drag-and-drop` block type is absent from `block-schemas.ts` `RAW_DEFINITIONS`.** The `BlockConfig` union and full `DragAndDropProps` interface exist in `@primr/components`, but the block cannot be generated by the AI because no schema is exported to the prompts. Add it to `RAW_DEFINITIONS`.

2. **`UpgradeModal.module.css` has 18+ bare hex values** — this is a high-traffic component that should be fully token-driven. Immediate refactor candidate.

4. **`diagram` and `code-sandbox`** are in the `BlockConfig['type']` union but have no schema definitions and no documentation. Either implement them or remove the dead types from the union.

5. **`src/types/outline.ts` `BlockType` union** is stale — missing 12 block types. If this type is used for type-checking outline blocks, AI-generated outlines containing newer block types (math-problem, number-line, etc.) will fail validation silently.

6. **The `font-family` and color violations are systemic** — virtually every `.module.css` was written before the token discipline was established. These should be addressed in a bulk migration sweep, not file-by-file.
