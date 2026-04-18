-- Seed built-in stamps (組み込みスタンプ)
-- These Lottie JSON files are stored as static assets in frontend/public/stamps/

insert into public.stamps (name, type, url, thumbnail_url, scope, group_id, created_by) values
  -- Emotions (感情)
  ('にっこり',   'lottie', '/stamps/happy.json',      '/stamps/thumbnails/happy.png',      'builtin', null, null),
  ('かなしい',   'lottie', '/stamps/sad.json',        '/stamps/thumbnails/sad.png',        'builtin', null, null),
  ('わらう',     'lottie', '/stamps/laugh.json',      '/stamps/thumbnails/laugh.png',      'builtin', null, null),
  ('びっくり',   'lottie', '/stamps/surprised.json',  '/stamps/thumbnails/surprised.png',  'builtin', null, null),
  ('だいすき',   'lottie', '/stamps/love.json',       '/stamps/thumbnails/love.png',       'builtin', null, null),
  ('ぷんぷん',   'lottie', '/stamps/angry.json',      '/stamps/thumbnails/angry.png',      'builtin', null, null),

  -- Weather (天気)
  ('はれ',       'lottie', '/stamps/sunny.json',      '/stamps/thumbnails/sunny.png',      'builtin', null, null),
  ('あめ',       'lottie', '/stamps/rainy.json',      '/stamps/thumbnails/rainy.png',      'builtin', null, null),
  ('くもり',     'lottie', '/stamps/cloudy.json',     '/stamps/thumbnails/cloudy.png',     'builtin', null, null),
  ('ゆき',       'lottie', '/stamps/snowy.json',      '/stamps/thumbnails/snowy.png',      'builtin', null, null),

  -- Actions (アクション)
  ('いいね',     'lottie', '/stamps/thumbs-up.json',  '/stamps/thumbnails/thumbs-up.png',  'builtin', null, null),
  ('ぱちぱち',   'lottie', '/stamps/clap.json',       '/stamps/thumbnails/clap.png',       'builtin', null, null),
  ('ばいばい',   'lottie', '/stamps/wave.json',       '/stamps/thumbnails/wave.png',       'builtin', null, null),
  ('おどる',     'lottie', '/stamps/dance.json',      '/stamps/thumbnails/dance.png',      'builtin', null, null),

  -- Objects (もの)
  ('ハート',     'lottie', '/stamps/heart.json',      '/stamps/thumbnails/heart.png',      'builtin', null, null),
  ('きらきら',   'lottie', '/stamps/star.json',       '/stamps/thumbnails/star.png',       'builtin', null, null),
  ('おはな',     'lottie', '/stamps/flower.json',     '/stamps/thumbnails/flower.png',     'builtin', null, null),
  ('おんぷ',     'lottie', '/stamps/music-note.json', '/stamps/thumbnails/music-note.png', 'builtin', null, null),

  -- Animals (どうぶつ)
  ('ねこ',       'lottie', '/stamps/cat.json',        '/stamps/thumbnails/cat.png',        'builtin', null, null),
  ('いぬ',       'lottie', '/stamps/dog.json',        '/stamps/thumbnails/dog.png',        'builtin', null, null),
  ('うさぎ',     'lottie', '/stamps/rabbit.json',     '/stamps/thumbnails/rabbit.png',     'builtin', null, null),
  ('くま',       'lottie', '/stamps/bear.json',       '/stamps/thumbnails/bear.png',       'builtin', null, null);
