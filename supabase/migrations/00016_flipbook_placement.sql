-- Let the パラパラアニメ sit on the diary canvas like stamps and
-- placed media — (x, y) is the center, scale multiplies base_width,
-- rotation is degrees, all in the 800×600 canvas coordinate space.
--
-- When x/y are null the flipbook renders in its legacy position below
-- the page so existing entries keep working unchanged.

alter table public.flipbooks
  add column if not exists x float,
  add column if not exists y float,
  add column if not exists scale float,
  add column if not exists rotation float,
  add column if not exists base_width float,
  add column if not exists base_height float;
