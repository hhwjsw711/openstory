-- Seed: system team and default style templates
-- Uses INSERT OR IGNORE so this migration is safe to re-run on existing data.

INSERT OR IGNORE INTO `teams` (`id`, `name`, `slug`, `created_at`, `updated_at`)
VALUES ('00000000000000SYSTEMTEAM', 'System Templates', 'system-templates', unixepoch(), unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `styles` (`id`, `team_id`, `name`, `description`, `config`, `category`, `tags`, `is_public`, `is_template`, `preview_url`, `created_at`, `updated_at`, `created_by`)
VALUES
  ('00000000000CINEMATICDRAMA', '00000000000000SYSTEMTEAM', 'Cinematic Drama',
   'Deep, emotional storytelling with rich cinematography. Perfect for character-driven narratives.',
   '{"artStyle":"Cinematic drama with deep shadows and warm tones","colorPalette":["#8B4513","#D2691E","#F4A460","#2F4F4F","#708090"],"lighting":"Dramatic chiaroscuro lighting with strong contrast","cameraWork":"Slow, deliberate movements with meaningful close-ups","mood":"Introspective and emotional","referenceFilms":["The Godfather","There Will Be Blood","Moonlight"],"colorGrading":"Warm highlights with cool shadows"}',
   'cinematic', '["drama","emotional","character-driven","cinematic"]', 1, 1, NULL, unixepoch(), unixepoch(), NULL),

  ('0000000000NEONOIRTHRILLER', '00000000000000SYSTEMTEAM', 'Neo-Noir Thriller',
   'Dark, stylized visuals with high contrast and urban settings. Ideal for mystery and crime stories.',
   '{"artStyle":"Neo-noir with stark contrasts and neon accents","colorPalette":["#000000","#FF0000","#00CED1","#4B0082","#FF1493"],"lighting":"High contrast with venetian blind shadows and neon highlights","cameraWork":"Dutch angles and voyeuristic framing","mood":"Tense and mysterious","referenceFilms":["Blade Runner","Sin City","Drive"],"colorGrading":"Desaturated with selective color pops"}',
   'noir', '["noir","thriller","urban","mystery","crime"]', 1, 1, NULL, unixepoch(), unixepoch(), NULL),

  ('0000000000WESANDERSONSTYL', '00000000000000SYSTEMTEAM', 'Wes Anderson Style',
   'Symmetrical compositions with pastel colors and whimsical aesthetics.',
   '{"artStyle":"Perfectly symmetrical compositions with pastel palette","colorPalette":["#FFB6C1","#87CEEB","#F0E68C","#DDA0DD","#98FB98"],"lighting":"Soft, even lighting with minimal shadows","cameraWork":"Centered framing, tracking shots, and planimetric composition","mood":"Whimsical and nostalgic","referenceFilms":["Grand Budapest Hotel","Moonrise Kingdom","The Royal Tenenbaums"],"colorGrading":"Saturated pastels with vintage feel"}',
   'artistic', '["whimsical","symmetrical","pastel","quirky","artistic"]', 1, 1, NULL, unixepoch(), unixepoch(), NULL),

  ('000000000DOCUMENTARYREALSM', '00000000000000SYSTEMTEAM', 'Documentary Realism',
   'Natural, observational style with authentic lighting and handheld movement.',
   '{"artStyle":"Natural documentary style with authentic environments","colorPalette":["#8B7355","#CD853F","#DEB887","#F5DEB3","#FFE4B5"],"lighting":"Natural and available light only","cameraWork":"Handheld camera with observational framing","mood":"Authentic and immediate","referenceFilms":["Free Solo","The Act of Killing","Citizenfour"],"colorGrading":"Natural color with slight desaturation"}',
   'documentary', '["documentary","realistic","natural","authentic","observational"]', 1, 1, NULL, unixepoch(), unixepoch(), NULL),

  ('00000000000SCIFIFUTURISTIC', '00000000000000SYSTEMTEAM', 'Sci-Fi Futuristic',
   'Clean, high-tech aesthetics with cool tones and sleek designs.',
   '{"artStyle":"Futuristic sci-fi with clean lines and holographic elements","colorPalette":["#00FFFF","#0000FF","#C0C0C0","#800080","#00FF00"],"lighting":"Cool LED lighting with lens flares","cameraWork":"Smooth camera movements with wide establishing shots","mood":"Futuristic and technological","referenceFilms":["Ex Machina","Arrival","Interstellar"],"colorGrading":"Cool blues and teals with high contrast"}',
   'scifi', '["scifi","futuristic","technology","space","cyberpunk"]', 1, 1, NULL, unixepoch(), unixepoch(), NULL),

  ('000000000000HORRORGOTHIC0', '00000000000000SYSTEMTEAM', 'Horror Gothic',
   'Dark, atmospheric visuals with Gothic elements and unsettling compositions.',
   '{"artStyle":"Gothic horror with dark shadows and eerie atmosphere","colorPalette":["#1C1C1C","#8B0000","#483D8B","#2F4F4F","#696969"],"lighting":"Low-key lighting with harsh shadows","cameraWork":"Unsettling angles and slow zooms","mood":"Ominous and foreboding","referenceFilms":["The Witch","Hereditary","The Lighthouse"],"colorGrading":"Desaturated with crushed blacks"}',
   'horror', '["horror","gothic","dark","atmospheric","supernatural"]', 1, 1, NULL, unixepoch(), unixepoch(), NULL),

  ('0000000ACTIONBLOCKBUSTER0', '00000000000000SYSTEMTEAM', 'Action Blockbuster',
   'High-energy visuals with dynamic camera work and explosive color palette.',
   '{"artStyle":"High-octane action with dynamic compositions","colorPalette":["#FF4500","#FFD700","#1E90FF","#FF6347","#FFA500"],"lighting":"High contrast with dramatic rim lighting","cameraWork":"Fast cuts, sweeping crane shots, and dynamic angles","mood":"Exciting and adrenaline-pumping","referenceFilms":["Mad Max: Fury Road","John Wick","Mission Impossible"],"colorGrading":"Saturated colors with orange and teal contrast"}',
   'action', '["action","blockbuster","explosive","dynamic","adventure"]', 1, 1, NULL, unixepoch(), unixepoch(), NULL),

  ('000000000ROMANTICCOMEDY00', '00000000000000SYSTEMTEAM', 'Romantic Comedy',
   'Bright, warm visuals with soft lighting and cheerful compositions.',
   '{"artStyle":"Warm and inviting with soft, romantic lighting","colorPalette":["#FFC0CB","#FFDAB9","#FFE4E1","#F0FFFF","#FFFACD"],"lighting":"Soft, diffused lighting with warm tones","cameraWork":"Smooth movements with intimate framing","mood":"Light, romantic, and optimistic","referenceFilms":["La La Land","Amelie","When Harry Met Sally"],"colorGrading":"Warm and saturated with soft contrast"}',
   'romance', '["romance","comedy","lighthearted","warm","feelgood"]', 1, 1, NULL, unixepoch(), unixepoch(), NULL),

  ('0000000000000WESTERNEPIC0', '00000000000000SYSTEMTEAM', 'Western Epic',
   'Wide vistas with dusty, golden hour lighting and classic Western aesthetics.',
   '{"artStyle":"Classic Western with wide landscapes and golden hour lighting","colorPalette":["#D2691E","#8B4513","#DEB887","#CD853F","#F4A460"],"lighting":"Magic hour lighting with long shadows","cameraWork":"Wide shots, slow zooms, and classic Western framing","mood":"Epic and frontier-inspired","referenceFilms":["The Good, The Bad and The Ugly","Once Upon a Time in the West","The Searchers"],"colorGrading":"Warm, dusty tones with high contrast"}',
   'western', '["western","epic","frontier","classic","americana"]', 1, 1, NULL, unixepoch(), unixepoch(), NULL),

  ('000000000ANIMATIONSTUDIO0', '00000000000000SYSTEMTEAM', 'Animation Studio',
   'Vibrant, stylized visuals reminiscent of high-quality animation productions.',
   '{"artStyle":"High-quality animation style with vibrant colors","colorPalette":["#FF69B4","#00CED1","#FFD700","#98FB98","#DDA0DD"],"lighting":"Bright, even lighting with soft shadows","cameraWork":"Dynamic camera movements with exaggerated perspectives","mood":"Playful and imaginative","referenceFilms":["Spider-Verse","Coco","How to Train Your Dragon"],"colorGrading":"Hyper-saturated with vibrant colors"}',
   'animation', '["animation","cartoon","vibrant","stylized","family"]', 1, 1, NULL, unixepoch(), unixepoch(), NULL),

  ('00000000LOFIIPHONEAESTHTC', '00000000000000SYSTEMTEAM', 'Lo-Fi iPhone 7 Aesthetic (Clean)',
   'Simulates the look of circa-2016 smartphone photography without any overlays. Characterized by lower resolution, poor dynamic range (blown-out highlights), digital noise, and the specific "crunchy" JPEG processing of the iPhone 7 era.',
   '{"artStyle":"iPhone 7 12MP JPEG aesthetic. Clean image with absolutely NO text overlays, NO datestamps, and NO time indicators burnt into the visual. Visible digital compression artifacts and over-sharpening. Textures are slightly soft/muddy. Includes sensor limitations: significant digital noise in shadows and color fringing.","colorPalette":["#F5F5DC","#D2B48C","#8B4513","#FFFAF0","#2F4F4F"],"lighting":"Low dynamic range (LDR). Highlights are blown out/clipped (loss of detail in bright areas like skies or lamps). Shadows are crushed and grainy. Simulates the struggle of older sensors to balance exposure.","cameraWork":"Handheld amateur perspective, f/1.8 aperture. Less sophisticated stabilization implies slight micro-jitters. Focus is decent but not clinical; background separation is digital and less smooth than modern sensors.","mood":"Nostalgic, amateur, \"Camera Roll 2016\". Authentic snapshot quality with no professional polish. Pure photographic capture.","referenceFilms":["Amateur Vlogs circa 2016","Early Instagram Aesthetic","Raw Phone Camera Roll"],"colorGrading":"Standard Rec.709 sRGB with older auto-white balance tendencies (often slightly too cool or too warm). No Log profile. Colors appear \"baked in\" and digital."}',
   'photography', '["lo-fi","iphone-7","amateur","2010s","no-text","digital-noise"]', 1, 1, NULL, unixepoch(), unixepoch(), NULL);
