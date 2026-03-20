# Design System Strategy: Civic Hospitality

## 1. Overview & Creative North Star
**The Creative North Star: "The Steeping Room"**

This design system rejects the cold, sterile efficiency of traditional civic-tech. Instead, it embraces the ritual of the *Chai Pe Charcha* (conversations over tea)—the idea that community progress happens when people feel warm, welcomed, and heard. 

We break the "template" look by treating the digital interface as a curated editorial experience. This is achieved through **intentional asymmetry**, where text-heavy civic data is balanced by expansive white space and overlapping organic containers. We move away from rigid grids toward a "fluid-fixed" layout, where elements breathe and float, mimicking the steam and surface tension of a perfectly poured cup of tea.

---

## 2. Colors & Surface Philosophy

### The "No-Line" Rule
**Strict Mandate:** Designers are prohibited from using 1px solid borders to section content. Traditional lines create "boxes" that feel like government forms. Instead, boundaries must be defined solely through:
- **Tonal Shifts:** A `surface-container-low` section sitting against a `surface` background.
- **Negative Space:** Using the Spacing Scale (specifically `10` to `16`) to create mental separation.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—like fine handmade paper stacked on a wooden table.
- **Background (`#FFF8F1`):** The base canvas.
- **Surface Tiers:** Use `surface-container` (`#F4EDE5`) for primary content blocks and `surface-container-highest` (`#E8E1DA`) for high-interaction utility zones. 
- **The Nested Depth Rule:** An inner container must always be a step "higher" or "lower" than its parent to define importance. Never place two identical surface tokens adjacent to one another.

### The "Glass & Gradient" Rule
To add "soul," use subtle gradients. 
- **Primary CTAs:** Use a linear gradient from `primary` (`#6F4627`) to `primary-container` (`#8B5E3C`) at a 135-degree angle.
- **Glassmorphism:** For floating navigation or modal overlays, use `surface-variant` at 70% opacity with a `20px` backdrop blur. This allows the warm tones of the underlying content to bleed through, maintaining the "Steeping Room" warmth.

---

## 3. Typography: Editorial Authority

The hierarchy is a conversation between the intellectual (Newsreader) and the functional (Manrope).

*   **Display & Headlines (Newsreader):** Use these for storytelling and big civic ideas. The serif "Newsreader" brings a sense of journalistic integrity and historical weight.
    *   *Scale Example:* `display-lg` (3.5rem) should be used sparingly, with tight letter-spacing (-0.02em) to feel premium.
*   **Body & Titles (Manrope):** A clean, humanist sans-serif. It handles the "labor" of the platform—reading policy, filling forms, and navigating data.
    *   *Scale Example:* `body-lg` (1rem) with a generous line-height (1.6) to ensure accessibility for all age groups.

**Typographic Identity:** Headlines should frequently use "Sentence case" rather than "Title Case" to feel approachable and human, never "Corporate."

---

## 4. Elevation & Depth: Tonal Layering

### The Layering Principle
We do not use shadows to create "pop"; we use them to create "atmosphere." 
- **Ambient Shadows:** For floating elements (like a FAB or a floating header), use a shadow color tinted with `on-surface` (`#1E1B17`) at 4-6% opacity. 
- **Blur Radius:** Minimum `40px` blur. We want a glow of depth, not a harsh drop shadow.

### The "Ghost Border" Fallback
If accessibility requirements (WCAG) demand a visible boundary on a low-contrast screen, use a **Ghost Border**:
- **Token:** `outline-variant` (`#D5C3B8`)
- **Opacity:** 15% 
- **Weight:** 1.5px (A softer, more "ink-like" feel than 1px).

---

## 5. Components & Interaction

### Buttons: The "Soft Press"
- **Primary:** Gradient-filled (`primary` to `primary-container`), `xl` (1.5rem) roundedness. No border.
- **Secondary:** `surface-container-highest` background with `on-surface` text. 
- **Interaction:** On hover, the button should lift slightly (Ambient Shadow) and shift color toward `secondary`.

### Cards: The Rounded Vessel
- **Style:** Use `xl` (1.5rem) or `lg` (1rem) corner radius. 
- **Constraint:** **Strictly no dividers.** Separate header, body, and footer using the Spacing Scale (`3` to `5`) or a 2% shift in background tone.
- **Texture:** Apply a subtle "Grain" overlay (5% opacity) to cards to mimic the texture of a ceramic tea cup or organic paper.

### Civic Progress Trackers (Custom Component)
Instead of a standard "Step Indicator," use **The Infusion Bar**. A thick, rounded track (`tertiary-fixed`) that fills with `tertiary` (`#3E580E`) as a user completes community actions.

### Input Fields
- **Unfocused:** `surface-container-low` background with a bottom-only "Ghost Border."
- **Focused:** Transition to a full `surface-container-lowest` with a `secondary` (`#99461C`) 2px bottom accent.

---

## 6. Do’s and Don’ts

### Do
- **Do** use asymmetrical margins. If the left margin is `12`, try a right margin of `16` for hero sections to create an editorial feel.
- **Do** use `tertiary` (Elaichi Green) for positive civic reinforcement (e.g., "Vote Cast," "Petition Signed").
- **Do** embrace "Long-form" scrolling. Let content breathe.

### Don’t
- **Don't** use pure black (#000000). Always use `Deep Charcoal` (#2F241F) for text to maintain warmth.
- **Don't** use "Alert Red" for everything. Use `Masala Terracotta` for warnings; it alerts the user without causing panic.
- **Don't** use sharp 90-degree corners. This platform is "human-centered"—humans have no sharp edges.

---

## 7. Motion & Soul
- **The "Steeping" Transition:** Page transitions should not "slide." They should "fade and lift"—a 400ms opacity transition combined with a 5px Y-axis lift.
- **Micro-interactions:** Icons should have a "bounce" (elastic-out easing) to feel optimistic and responsive.