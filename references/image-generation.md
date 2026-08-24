# Generated Image Rules

Use this reference whenever the card set needs newly generated images.

## Source and prompt requirements

- Invoke the system-provided image generation capability for every new source image. Keep the selected raster files under the run's output directory.
- Establish one art direction before the first prompt. Record its medium, color palette, lighting, camera or viewpoint, texture, and emotional register in the run notes or input spec.
- Reuse that art direction in every prompt in the same card set. Individual scenes may change to match their page theme, yet rendering medium, palette family, contrast, lens language, and texture must remain visually coherent.
- The prompts must explicitly prohibit visible text, letters, numbers, punctuation, typography, logos, watermarks, signatures, borders, frames, collages, split panels, and UI elements. All written content is placed later by the fixed card template.
- Ask for an editorially usable artistic image with a clear focal subject and sufficient uncluttered space for the assigned fixed crop. Avoid generic stock-photo treatment when the topic supports a more specific visual language.

## Selection gate

- Inspect each generated candidate before binding it to a card. Reject and regenerate any image containing text, a logo, watermark, signature, decorative border, picture frame, collage panel, or UI-like overlay.
- Reject and regenerate images that conflict with the declared subject, crop poorly in their assigned slot, or visibly depart from the set's art direction.
- Do not hide an unwanted artifact by cropping it out or placing text over it. The selected source image itself must satisfy the no-text and no-border rule.
- When user-provided images are visually incompatible with the declared set direction, do not combine them with generated images unless the user explicitly approves the mixed treatment.

## Final review

Use a vision-capable tool to review the selected source images and final PNG cards. Confirm that every source image is free of prohibited visual artifacts and that the complete set reads as one intentional editorial image system.
