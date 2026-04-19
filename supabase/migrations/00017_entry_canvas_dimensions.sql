-- Store the canvas dimensions of each entry so the viewer can render it
-- at the exact aspect the author drew on. New entries use A4 portrait
-- (800×1131) while legacy entries fall back to the original 800×600.
--
-- Null = legacy entry, viewer applies the old 800×600 defaults.

alter table public.entries
  add column if not exists canvas_width int,
  add column if not exists canvas_height int;
