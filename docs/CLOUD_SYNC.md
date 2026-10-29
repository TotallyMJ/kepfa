# Kepfa cloud sync (phase 4)

เปิด browser/เครื่องไหนก็เห็นฟ้าของตัวเองเหมือนกัน โดย **local-first**: เก็บฟ้าได้ทันทีแบบเดิม (ไม่ล็อกอิน = อยู่ในเครื่องล้วน เหมือนก่อนหน้านี้) แล้ว **ชวนล็อกอินเพื่อ sync ข้ามเครื่อง** ล็อกอินด้วย Google/Apple ข้อมูลเก็บบน Supabase (เฉพาะของเจ้าของ ผ่าน RLS)

> การเปลี่ยนแปลงนี้ทำให้รูปถูกอัปขึ้นเซิร์ฟเวอร์เมื่อผู้ใช้เลือก sync (ต่างจากเดิมที่รูปไม่เคยออกจากเครื่อง) ต้องปรับหัวข้อ "ความเป็นส่วนตัว" ใน README ตอนจบเฟส

## Backend (Supabase)

- Project: **kepfa** `bosbwrdkyrglsmrytekj` · org TotallyMJ (free) · region ap-southeast-1 (Singapore)
- API URL: `https://bosbwrdkyrglsmrytekj.supabase.co`
- Publishable key (client-safe, RLS ป้องกันข้อมูล): `sb_publishable_tEYTakmNrRU0Eq82wm7J7A_6i1YAVzM`
- Schema อยู่ใน `supabase/migrations/` (applied แล้ว):
  - `profiles` (id = auth user, `stamps` jsonb, `saved_at`) — เก็บแสตมป์/จดหมายที่เคยอยู่ใน localStorage `kepfa.stamps`
  - `skies` (id = client id แบบ text, `user_id`, metadata, `palette` jsonb, `photo_path`/`thumb_path`/`live_path`, `updated_at`, `deleted_at`)
  - RLS: แต่ละคนเห็น/แก้ได้เฉพาะแถวของตัวเอง
  - Storage buckets `photos`, `live` (private) path = `{user_id}/{sky_id}/...` ล็อกสิทธิ์รายคน
  - trigger สร้าง `profiles` ให้อัตโนมัติตอนสมัคร
- Security advisor: ผ่าน (ไม่มี warning)

## Sync model

- IndexedDB เดิม = cache ออฟไลน์ (คงไว้ ใช้ได้โดยไม่ต้องล็อกอิน)
- ล็อกอินแล้ว sync สองทาง รวมด้วย `id`: อัปของใหม่ขึ้น, ดึงของเครื่องอื่นลง
- last-write-wins ด้วย `updated_at`
- ลบใช้ **soft-delete** (`deleted_at`) เพื่อให้ลบเครื่องนึงแล้วอีกเครื่องหายตาม

## เฟส

- [x] **0** — สร้าง Supabase project + schema + Storage + RLS
- [ ] **1** — เพิ่ม `supabase-js` (CDN) + Google sign-in + UI บัญชี (local-first: เก็บฟ้าได้ก่อนล็อกอิน)
- [ ] **2** — sync engine: metadata + รูป (local-first, reconcile, soft-delete)
- [ ] **3** — sync คลิป Live + แสตมป์/จดหมาย (profiles.stamps)
- [ ] **4** — Apple sign-in + เขียนหัวข้อ "ความเป็นส่วนตัว" ใน README ใหม่

## ด่านที่เจ้าของต้องทำเอง (ก่อนเฟส 1 ใช้งานได้จริง)

### Google sign-in
1. ไป Google Cloud Console → สร้าง/เลือกโปรเจกต์ → **APIs & Services → OAuth consent screen** (External, กรอกชื่อแอป Kepfa, อีเมลติดต่อ)
2. **Credentials → Create credentials → OAuth client ID → Web application**
   - Authorized redirect URI: `https://bosbwrdkyrglsmrytekj.supabase.co/auth/v1/callback`
3. ได้ **Client ID** กับ **Client secret**
4. Supabase Dashboard → Authentication → Providers → **Google** → เปิด แล้ววาง Client ID/secret → Save
5. Authentication → URL Configuration → เพิ่ม Site URL / Redirect URLs ของแอป (`https://kepfa.vibethebloom.com`, `http://localhost:5173`)

### Apple sign-in (เฟส 4)
ต้องมี **Apple Developer ($99/ปี)** → Service ID + Sign in with Apple key แล้วตั้งค่าใน Supabase provider Apple (ทำทีหลัง)

## หมายเหตุ
- เพิ่ม `supabase-js` = dependency ตัวแรกของแอป (เดิม zero-dep) โหลดจาก CDN แบบ pin เวอร์ชัน
- ค่า Storage/Bandwidth: free tier มีลิมิต คลิป Live หนักสุด เฝ้าดูตอนคนใช้เยอะ
