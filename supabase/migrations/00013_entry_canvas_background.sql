-- Canvas background type for handwritten diary entries.
--
-- The notebook ruling used to be baked into the saved canvas PNG, which
-- made the displayed image drift against the viewer's own paper background
-- (the two rulings didn't line up). We now save a transparent canvas PNG
-- and render the background with CSS in the viewer, using this column to
-- know which style to render.
--
-- Nullable: entries without a handwritten canvas (photos-only, video-only)
-- leave this NULL.

alter table public.entries
  add column if not exists canvas_background text
  check (canvas_background is null or canvas_background in ('ruled', 'plain', 'grid'));
