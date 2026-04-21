// lib/supabase.js
// shield 서버 전용 Supabase 클라이언트
// Secret Key (service_role)를 사용해 RLS 우회하므로
// 반드시 서버 (api/) 코드에서만 import 할 것 — 프론트엔드 금지
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !secretKey) {
  console.error('[supabase] SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수 없음');
}

// 기존 방식: import { supabase } 쓸 수 있도록 유지
export const supabase = createClient(url, secretKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

// 신규: import { getSupabase } 쓰는 새 v24 코드용
export function getSupabase() {
  return supabase;
}
