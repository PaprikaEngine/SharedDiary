# SharedDiary セットアップガイド

## 前提条件

- Node.js 20+
- Rust 1.86+
- Cloudflare アカウント（無料）
- Supabase アカウント（無料）

## 1. Cloudflare セットアップ

### 1.1 Cloudflare にログイン
```bash
npx wrangler login
```

### 1.2 R2 バケット作成
```bash
cd backend
npx wrangler r2 bucket create shared-diary-media
```

### 1.3 R2 CORS 設定
Cloudflare ダッシュボード > R2 > shared-diary-media > Settings > CORS policy:
```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://your-domain.com"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

## 2. Supabase セットアップ

### 2.1 プロジェクト作成
1. https://supabase.com でプロジェクト作成
2. Project Settings > API から URL と anon key をコピー

### 2.2 スキーマ適用
Supabase ダッシュボード > SQL Editor で `supabase/migrations/00001_initial_schema.sql` を実行

### 2.3 Google OAuth 設定（オプション）
1. Google Cloud Console で OAuth クライアント作成
2. Supabase > Authentication > Providers > Google を有効化
3. Client ID と Secret を設定

## 3. 環境変数設定

### Frontend (.env.local)
```bash
cd frontend
cp .env.local.example .env.local
# 編集して Supabase の値を設定
```

### Backend
```bash
cd backend
# wrangler.toml の vars セクションに環境変数を追加
# または wrangler secret put で秘密情報を設定
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

## 4. 開発サーバー起動

### Frontend
```bash
cd frontend
npm run dev
# http://localhost:3000
```

### Backend
```bash
cd backend
npm run dev
# http://localhost:8787
```

## 5. デプロイ

### Frontend (Cloudflare Pages)
```bash
cd frontend
npm run build:cloudflare
npm run deploy
```

### Backend (Cloudflare Workers)
```bash
cd backend
npm run deploy
```

## 無料枠の制限

| サービス | 無料枠 |
|---------|-------|
| Cloudflare Pages | 500ビルド/月 |
| Cloudflare Workers | 100,000 req/日、10ms CPU |
| Cloudflare R2 | 10GB、10M ops/月 |
| Supabase | 500MB DB、1GB Storage |
| Resend | 100通/日 |
