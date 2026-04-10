# SharedDiary

懐かしい交換日記を、もう一度。

テキストだけでなく、画像・動画・パラパラアニメ・動くスタンプで「あの頃の創作の楽しさ」をデジタルで再現するサービス。

## 技術スタック

- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS → Cloudflare Pages
- **Backend**: Rust + workers-rs → Cloudflare Workers
- **Database**: Supabase (PostgreSQL + Auth)
- **Storage**: Cloudflare R2

## ディレクトリ構成

```
SharedDiary/
├── frontend/          # Next.js フロントエンド
├── backend/           # Rust Workers バックエンド
├── supabase/          # Supabase マイグレーション
├── claude.md          # プロジェクト仕様書
└── SETUP.md           # セットアップガイド
```

## 開発

```bash
# Frontend
cd frontend && npm run dev

# Backend
cd backend && npm run dev
```

詳細は [SETUP.md](./SETUP.md) を参照。
