-- Allow images and videos to be placed freely on the diary canvas
-- (previously they only rendered as a thumbnail grid below the page).
--
-- When x/y are non-null the media is "placed" and the viewer renders it
-- as an absolutely-positioned overlay on the 800×600 canvas.
-- When they are null the media renders in the legacy thumbnail grid —
-- so existing entries keep working unchanged.
--
-- Coordinate convention matches entry_stamps: (x, y) is the *center*
-- of the media in canvas-space (0..800, 0..600), scale is a multiplier
-- on base_width, and rotation is degrees.

alter table public.entry_media
  add column if not exists x float,
  add column if not exists y float,
  add column if not exists scale float,
  add column if not exists rotation float,
  add column if not exists base_width float;
