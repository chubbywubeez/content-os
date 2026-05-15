# Vantum design system (Copy Maker)

Plain-text export of `vantum_pdf_design_system_v2.html` for LLM prompts. Prefer editing this file for Copy Maker; the HTML file remains for visual layout reference.

---

🎨 Vantum Design System v2 · Lead Magnet Blueprint

    
The Vantum PDF

Design System.

    
Updated with official branding guide. Everything you need to generate consistent, on-brand lead magnet PDFs at scale. Colors, blocks, page rules, typography, and the master prompt.

  

  

  

    

      
1

      
Brand Color System 
Updated

    

    

      
Primary Colors — From Official Branding Guide

      

        

          

          

            
Deep Blue-Black

            
#030a17

            
Cover page bg, tasks page header. Replaces navy gradient.

          

        

        

          

          

            
App Background

            
#f7f8fa

            
Lesson page background (slightly off-white)

          

        

        

          

          

            
White

            
#ffffff

            
Card backgrounds, elevated surfaces

          

        

        

          

          

            
Charcoal

            
#1A1E29

            
Dark challenge boxes, headers, task cards

          

        

      

      
Typography Colors — From Official Branding Guide

      

        

          

          

            
Text Primary

            
#0f172a

            
Lesson titles, bold phrases, headings

          

        

        

          

          

            
Text Soft

            
#334155

            
Secondary body text, descriptions

          

        

        

          

          

            
Text Muted

            
#475569

            
Body text, task descriptions

          

        

        

          

          

            
Light Gray

            
#A3A6B4

            
Text on dark backgrounds, footer text

          

        

      

      
Accent Colors — Use Intentionally

      

        

          

          

            
Emerald ★

            
#059669

            
✅ Primary CTA, go/positive, VANTUM footer, task 01 border, section numbers

          

        

        

          

          

            
Cyan

            
#0891b2

            
AI/insight cues, secondary highlights, agent surfaces

          

        

        

          

          

            
Deep Ochre

            
#C97B00

            
🔍 Diagnostic/quote blocks, cover H1 title, task 02 border

          

        

        

          

          

            
Terracotta

            
#B34A3F

            
❌ Stop/warning/mistake blocks, task 03 border

          

        

      

      

        
Color Rule:
 Emerald = commit/go/CTA (primary brand). Cyan = AI/insight/copilot. Ochre = quote/diagnostic/insight. Terracotta = stop/warning/mistake. Dark box = challenge/action (always last). Never mix accent colors in the same block.
      

    

  

  

  

    

      
2

      
Typography System

    

    

      
Font Family

      
Use 
Montserrat
 throughout all PDF assets. Import from Google Fonts. No other fonts.

      

        

Element

Weight

Size

Color

Notes

        

Cover VANTUM wordmark

900

42pt

#FFFFFF

ALL CAPS, letter-spacing 4px

        

Cover H1 title

700

22pt

#C97B00 (ochre)

Title case, line-height 1.2

        

Cover subtitle

300

10pt

#A3A6B4

Max 2 lines, max-width 420px

        

Lesson title (h2)

800

22pt

#0f172a

Can strikethrough one key word for emphasis

        

Section heading

700

10pt

#0f172a

Before feature cards, examples, grids

        

Body text

400

9.5pt

#475569

Line-height 1.8. Bold key phrases in #0f172a

        

Block labels

700

6.5pt

Matches block accent

ALL CAPS, letter-spacing 1.5px

        

Block body text

400

9pt

Dark version of block accent

Italic for diagnostic/quote blocks

        

Task numbers (01, 02)

900

18pt

Matches task border color

Emerald / Ochre / Terra rotating per task

        

Task title

700

9.5pt

#0f172a

Named — not just "Task 01"

        

Task description

700

8.5pt

#059669 (emerald)

Bold emerald — signature Vantum style

        

Footer VANTUM

800

7.5pt

#059669 (full word)

ALL CAPS, letter-spacing 2px — entire word in emerald

        

Footer lesson ref

300

7pt

#A3A6B4

Right-aligned

      

    

  

  

  

    

      
3

      
The 5 Block Types — When & How to Use Each

    

    

      

        

          
❌ Stop / Warning / Ceiling / Common Mistake

          
The Ceiling — Stop Leading With This

          
"I'm a Fractional CMO." — the wrong approach

        

        

          
✅ Go / Bridge / Principle / Fix / Solution

          
The Bridge — Lead With This Instead

          
"I help [company type] hit [outcome] in [timeframe]."

        

        

          
🔍 The Diagnostic / Quote / The Test / Insight

          
"The harder it is to say, the more it's working."

          
Always italic. Used for direct quotes from the lesson.

        

        

          
🎯 Your Challenge / Action / The System

          
Kill the title. Lead with the outcome.

          
Always the LAST block on every lesson page. Dark bg, white title, gray body.

        

      

      
When To Use Each Block

      

        

Block Type

Color

When to Use

Max Per Page

        

❌ Terracotta

#B34A3F + terra-light bg

Wrong approach, mistake to avoid, warning, ceiling

1

        

✅ Emerald

#059669 + emerald-light bg

Right approach, fix, principle, solution, bridge

2

        

🔍 Ochre

#C97B00 + ochre-light bg

Direct quote, diagnostic, test, insight — always italic

1

        

🎯 Dark

Charcoal bg, white text

ALWAYS the final block on every lesson page. The challenge/action.

1 (always last)

        

📌 Example

card-bg + emerald left border

Real example sentences, case studies, before/after comparisons

3 max

      

      

        
Block Order Rule:
 On every lesson page, blocks always follow this sequence: Red (problem) → Emerald (solution) → Body text → Ochre (insight/quote) → Dark (challenge). The dark challenge box is ALWAYS last. Never break this order.
      

    

  

  

  

    

      
4

      
Page Architecture — Every Page Type 
Updated

    

    

      
Cover Page

      

        

Element

Rule

        

Background

Solid 
#030a17
 — deep blue-black. No gradient.

        

Top tag

Small caps pill: "⚡ [COURSE NAME] · FREE GUIDE" — rgba white bg, #A3A6B4 text

        

VANTUM wordmark

900 weight, 42pt, white (#FFFFFF), ALL CAPS, letter-spacing 4px

        

H1 title

700 weight, 22pt, ochre (#C97B00) — the guide/course title

        

Subtitle

300 weight, 10pt, #A3A6B4 — 1-2 sentence description

        

Divider

48px wide, 3px tall, emerald (#059669), before lesson list

        

Lesson list numbers

Emerald circle borders, emerald text (1.1, 1.2, etc.) + white description

        

Bottom bar

"VANTUM" left (full word in emerald) + "vantum.ai · Course · X Lessons" right

        

Decorative circles

2 circles, rgba emerald 0.08 — top-right and bottom-left

      

      
Lesson Pages

      

        

          
BADGE

          
LESSON TITLE

          

          
BODY TEXT

          
BODY TEXT

          
WHITEBOARD IMAGE

          
RED BLOCK

          
EMERALD BLOCK

          
BODY

          
OCHRE BLOCK

          
DARK CHALLENGE

          

          
FOOTER

        

        

          

Badge:
 "SALES FUNDAMENTALS" pill — emerald-light bg, emerald text, all caps, outline border

          

Lesson title:
 22pt, 800 weight, #0f172a. Strikethrough effect on 1 key word where appropriate

          

Divider:
 Full-width 2px border under title. Always present.

          

Body text:
 9.5pt, 400, #475569. Bold key phrases in #0f172a

          

Whiteboard image:
 White/light bg, marker-style sketch. Placed BEFORE the blocks.

          

Red block:
 Problem/wrong approach. Always before the emerald.

          

Emerald block:
 Solution/right approach. Always after the red.

          

Ochre block:
 Quote or diagnostic, italic text. Second-to-last.

          

Dark challenge block:
 ALWAYS LAST. Never move it.

          

Footer:
 Full "VANTUM" in emerald (left) + lesson reference (right)

        

      

      
Tasks Page 
Updated

      

        

Element

Rule

        

Header banner

Solid 
#030a17
 bg (no gradient). "ACTION TASKS" emerald badge + white heading + gray subtitle

        

Task cards

#f7f8fa bg, rounded corners (12px), left border in accent. Checkbox top-right corner.

        

Task border colors

Task 01 = emerald #059669, Task 02 = ochre #C97B00, Task 03 = terracotta #B34A3F

        

Task number

18pt, 900 weight, matches border color. "01", "02", "03"

        

Task title

9.5pt, 700 bold, #0f172a. Always a real named title.

        

Task description

8.5pt, 700 bold, emerald #059669 — bold emerald is the signature style

        

CTA section

Centered below divider: heading (#0f172a) + subtext (#475569) + emerald button

        

CTA button

Emerald bg #059669, white text, "TRY VANTUM FREE → VANTUM.AI"

        

Footer

Same as lesson pages — full "VANTUM" in emerald

      

    

  

  

  

    

      
5

      
Image Rules — Whiteboard Style 
Updated

    

    

      

        

          
🖊️

          
Style: Whiteboard Marker

          
All visuals should look drawn on a white/light background with marker-style lines — like a whiteboard sketch. Clean white bg, bold marker strokes, not hand-drawn on paper/cream.

        

        

          
📐

          
Placement: Before Blocks

          
Image goes AFTER opening body text and BEFORE the red/emerald/ochre callout blocks. Never after the dark challenge box.

        

        

          
📏

          
Size: Full Width, ~160px Tall

          
Spans full content width. Height ~160px. Border-radius 8px. Light bg (white or #f7f8fa). Clean edges.

        

        

          
🎨

          
Colors: Emerald + Ochre as Highlights

          
Use emerald (#059669) or ochre (#C97B00) to highlight the hero element in the drawing. Everything else in black marker strokes on white bg.

        

        

          
🖼️

          
One Image Per Lesson

          
Maximum one whiteboard-style image per lesson page. The image must directly visualize the lesson concept. No decorative images.

        

        

          
📝

          
In Placeholder Mode (PDF Generation)

          
Use a dashed emerald border box with centered icon + image type label + description of what to draw. Makes Canva drop-in straightforward.

        

      

    

  

  

  

    

      
6

      
The Master Prompt — Copy & Use Every Time 
Updated

    

    

      
Paste this prompt into Claude every time you want to generate a new lead magnet PDF. Replace all 
{{VARIABLE}}
 fields with your actual content.

      

# VANTUM LEAD MAGNET PDF GENERATOR v2
# Copy this entire prompt. Replace all {{VARIABLES}} with real content.
# Updated with official Vantum branding guide.
# ─────────────────────────────────────────────

You are generating a lead magnet PDF for Vantum using our official brand design system.
Generate a complete, print-ready HTML file that converts to PDF via WeasyPrint.

BRAND RULES — follow exactly:

- Font: Montserrat (Google Fonts) — no other fonts
- Cover background: solid #030a17 (deep blue-black — NO gradient)
- Tasks page header: solid #030a17 (same as cover — NO gradient)
- Lesson pages: #f7f8fa background, white (#ffffff) cards
- Primary accent: Emerald #059669 (go/positive/CTA/section numbers/task 01)
- Secondary accent: Ochre #C97B00 (insight/quote/cover title/task 02)
- Warning accent: Terracotta #B34A3F (stop/mistake/warning/task 03)
- Dark box: Charcoal #1A1E29 (ALWAYS the LAST block on every lesson page)
- Text primary: #0f172a | Text body: #475569 | Text on dark: #A3A6B4

BLOCK RULES — use exactly these 5 block types:

1. RED block (terra-light #fdf0ef bg, #B34A3F left border) — stop/wrong/ceiling/mistake
2. EMERALD block (emerald-light #d1fae5 bg, #059669 left border) — go/solution/principle
3. OCHRE block (ochre-light #fff4e0 bg, #C97B00 left border, italic text) — quote/diagnostic
4. DARK block (#1A1E29 charcoal bg, white title, #A3A6B4 body) — ALWAYS LAST, the challenge
5. EXAMPLE items (#f1f5f9 bg, #059669 left border) — real examples, cases

Block order per page: Red → Emerald → body text → Ochre → Dark (never break this order)

TYPOGRAPHY RULES:

- Cover VANTUM: Montserrat 900, 42pt, #FFFFFF, ALL CAPS, letter-spacing 4px
- Cover H1: Montserrat 700, 22pt, #C97B00 (ochre)
- Lesson titles: Montserrat 800, 22pt, #0f172a (strikethrough one key word where relevant)
- Body text: Montserrat 400, 9.5pt, #475569, line-height 1.8
- Bold key phrases in body: #0f172a
- Block labels: 700, 6.5pt, ALL CAPS, letter-spacing 1.5px, matches block accent color
- Task numbers: Montserrat 900, 18pt, matches task border color
- Task titles: Montserrat 700, 9.5pt, #0f172a — give each task a REAL NAME
- 
Task descriptions: Montserrat 700, 8.5pt, #059669 EMERALD (bold emerald = signature style)

- 
Footer VANTUM: full word in emerald #059669 (not just "TUM" — entire word)

IMAGE PLACEHOLDERS:

For each lesson, insert a placeholder box with:
- #f1f5f9 background, 2px dashed #059669 border, border-radius 8px
- height ~160px, centered icon + image type label + description
- Style note: "Whiteboard style — white/light bg, marker lines, emerald or ochre as highlight color"
- Label: "Visual: {{IMAGE_TYPE}} — {{WHAT_IT_SHOWS}}"

PAGE STRUCTURE:

Page 1: Cover (solid #030a17 bg)
Pages 2–N: One lesson per page (#f7f8fa bg, white cards)
Last page: Tasks page (#030a17 header, #f7f8fa body, task cards)

TASKS PAGE RULES:

- Header: solid #030a17, "ACTION TASKS" emerald badge, bold white heading, #A3A6B4 subtitle
- Task cards: #f7f8fa bg, border-radius 12px, left border rotates emerald → ochre → terra
- Task 01: emerald border + emerald number | Task 02: ochre | Task 03: terracotta
- Task description text: 700 weight, #059669 EMERALD (bold emerald — signature style)
- CTA button: emerald #059669 bg, white text, "TRY VANTUM FREE → VANTUM.AI"
- Footer: full "VANTUM" in emerald + lesson/guide reference right-aligned

OUTPUT:

Generate complete HTML with embedded CSS. Use @page { size: A4; margin: 0; }
Include print-color-adjust: exact. Convert cleanly via WeasyPrint.

─────────────────────────────────────────────
CONTENT TO GENERATE:
─────────────────────────────────────────────

GUIDE TITLE: {{e.g. "How Fractionals Close More, Charge More, and Get Remembered."}}

COURSE: {{e.g. C1 — Sales Fundamentals}}

COVER SUBTITLE: {{1-2 sentence description}}

LESSONS:

LESSON {{1.1}}
TITLE: {{The Fractional Title Is a Ceiling}}
BODY: {{Full lesson text}}
IMAGE: {{Visual type}} — {{Description of what to draw in whiteboard style}}

LESSON {{1.2}}
TITLE: {{Three Tiers. Not One.}}
BODY: {{Full lesson text}}
IMAGE: {{Visual type}} — {{Description}}

[Continue for all lessons...]

TASKS:
TASK 01 — {{Task Name}}: {{Task description}}
TASK 02 — {{Task Name}}: {{Task description}}
TASK 03 — {{Task Name}}: {{Task description}}

TASKS PAGE HEADING: {{e.g. "Your Three Tasks. Real Numbers. Real Decisions."}}

TASKS SUBTEXT: {{1 sentence framing}}

CTA TEXT: {{e.g. "Ready to put all three lessons to work?"}}

      

        
Workflow:
 Copy prompt above → fill in {{VARIABLES}} → paste into Claude → Claude generates HTML → run through WeasyPrint → PDF ready → import to Canva → drop in real whiteboard images → done.
      

    

  

  

  

    

      
7

      
Production Checklist — Before Every Export 
Updated

    

    

      

        

✓

Font loaded:
 Montserrat from Google Fonts in HTML head

        

✓

Cover background:
 Solid 
#030a17
 — NOT a gradient

        

✓

Tasks page header:
 Solid 
#030a17
 — NOT a gradient

        

✓

VANTUM wordmark:
 900 weight, ALL CAPS, letter-spacing 4px, white on cover

        

✓

Cover title:
 In ochre (#C97B00), not white or emerald

        

✓

Primary accent is emerald:
 #059669 — not teal #007A7A

        

✓

Block order:
 Red → Emerald → Ochre → Dark on every lesson page

        

✓

Dark challenge block:
 ALWAYS the LAST block on every lesson page

        

✓

Image placeholders:
 Dashed emerald border, whiteboard style note, one per lesson

        

✓

Task descriptions:
 Bold emerald (#059669, weight 700) — not gray, not teal

        

✓

Task border colors:
 Emerald (01) → Ochre (02) → Terra (03)

        

✓

Task titles are named:
 Real names, not just "Task 01"

        

✓

Footer VANTUM:
 Full word in emerald — every letter, not just "TUM"

        

✓

CTA button:
 Emerald bg, white text, "TRY VANTUM FREE → VANTUM.AI"

        

✓

@page CSS:
 size A4, margin 0, print-color-adjust: exact