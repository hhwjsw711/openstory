# Hero Video Loop — Generation Script

**Target:** 8–10 second seamless loop, 16:9, 1080p minimum
**Pace:** Measured cuts (1–1.5s each), confident — every frame looks like it cost $10K to shoot
**Feel:** "This is what your next video looks like." Aspirational. Polished. Commercial.

---

## The Concept

A montage of real commercial video content — the exact kind of work that agencies, creators, and marketing teams pay thousands to produce. Each shot represents a different industry vertical. The message isn't "look what AI can do" — it's "look what YOU can ship tomorrow." Every shot should feel like it belongs in a finished ad, not an AI demo reel.

---

## Shot List

Generate each shot as a 3-5 second clip. Trim to ~1.2s for the final cut. Every shot should have smooth, deliberate camera movement — nothing handheld or chaotic.

### SHOT 1 — PRODUCT / BEAUTY

> A luxury perfume bottle rotates slowly on a reflective black surface. Golden liquid catches studio light. A fine mist drifts behind it. Camera orbits at eye level, shallow depth of field. Clean commercial lighting — one key, one rim. The kind of hero shot brands put on their homepage.

### SHOT 2 — REAL ESTATE / PROPERTY

> Slow tracking shot through the open-plan living room of a modern luxury home. Floor-to-ceiling windows reveal a city skyline at golden hour. Warm interior light, cool exterior light. Steadicam-smooth movement. Architectural Digest quality.

### SHOT 3 — FOOD & BEVERAGE

> A chef's hands plate a dish in a high-end restaurant kitchen — microgreens placed with tweezers, sauce drizzled in an arc. Tight overhead shot pulling slowly wider. Steam rises. Warm tungsten lighting. Bon Appétit production value.

### SHOT 4 — FASHION / E-COMMERCE

> A model walks toward camera on a clean studio cyclorama, wearing a structured linen blazer. Fabric moves naturally. Camera at waist height, slight slow motion. Soft diffused light, no harsh shadows. The standard hero clip for any DTC fashion brand.

### SHOT 5 — TRAVEL / HOSPITALITY

> Aerial drone shot gliding over turquoise water toward a white-sand beach with a boutique resort. Palm trees, a few lounge chairs, golden hour light raking across the sand. Smooth forward dolly. The hero shot every hotel website needs.

### SHOT 6 — STARTUP / TECH

> A diverse team collaborates around a large screen showing data visualizations in a bright, modern office. One person gestures at the screen, another nods. Camera slowly pushes in from a wide establishing shot. Natural window light. Authentic, not stock-photo stiff.

### SHOT 7 — FITNESS / LIFESTYLE

> An athlete mid-stride on an empty coastal road at sunrise. Camera tracks alongside at speed. Wind in their hair, muscles engaged, morning fog lifting off the asphalt. Cinematic slow motion. Nike-commercial energy — aspirational but grounded.

### SHOT 8 — MUSIC / CONTENT CREATOR

> A musician plays guitar in a warm, moody home studio. Bokeh from string lights in the background. Camera slowly racks focus from the guitar fretboard to their face. Intimate. The kind of B-roll that makes a YouTube channel feel professional.

### SHOT 9 — AUTOMOTIVE

> A matte black sports car rounds a mountain switchback at dusk. Headlights sweep across rock face. Camera mounted low, tracking the front quarter panel. Blue-hour sky above, warm headlight glow below. Luxury automotive ad quality.

---

## Edit Notes

- **Transitions:** Clean hard cuts, precisely on the beat if audio is added later. Each cut should feel like turning a page — a new world, same production quality.
- **Color grade:** Unified and warm. Every shot should feel like the same colourist graded it — consistent skin tones, rich shadows, controlled highlights. Think: high-end commercial colour, not Instagram filter.
- **Pacing:** Slightly slower than a typical sizzle reel. Let each shot breathe for a beat so the viewer registers what they're seeing. This isn't chaos — it's confidence.
- **Loop technique:** Shot 9 ends on the car driving into darkness. Shot 1 begins on the perfume bottle emerging from darkness. Black is the seam.

---

## Generation Tips

1. **Model choice per shot:**
   - Product/macro (Shots 1, 3): Kling 2.5 Pro — best at controlled studio lighting and fine detail
   - Architecture/interiors (Shot 2): Wan i2v — excels at smooth tracking through spaces
   - People/fashion (Shots 4, 6, 7, 8): Kling 2.5 Pro — most consistent human rendering
   - Aerial/landscape (Shot 5): Wan — handles scale and drone-style movement well
   - Automotive (Shot 9): Kling 2.5 or Wan — both handle reflective surfaces

2. **Generate image first, then i2v:** For every shot, generate a high-quality still frame first (use a strong image model). Art-direct the composition, lighting, and framing. Then use image-to-video to add camera motion. This two-step approach gives you 10x more control than text-to-video alone.

3. **Aspect ratio:** Generate at 16:9 native. These are all landscape-format commercial shots.

4. **Camera motion prompts:** Be specific about motion type:
   - "Slow orbit" (Shot 1) — camera circles the subject
   - "Tracking shot" (Shots 2, 7) — camera moves laterally alongside subject
   - "Dolly forward" (Shots 5, 6) — camera pushes toward subject
   - "Overhead pull-out" (Shot 3) — camera rises away from subject
   - "Rack focus" (Shot 8) — focus shifts, camera stays still

5. **Loop point:** Use 0.3s of black between Shot 9 and Shot 1 to create a natural breathing point. A hard loop without black will feel jarring given the measured pace.

---

## Quick Version (5 shots, ~6 seconds)

Best subset for maximum commercial range:

1. **Shot 1** (product/beauty) — 1.2s
2. **Shot 2** (real estate) — 1.2s
3. **Shot 5** (travel/aerial) — 1.2s
4. **Shot 4** (fashion) — 1.2s
5. **Shot 9** (automotive) — 1.2s

Five verticals, five shots that each look like a $10K production. That's the pitch.
