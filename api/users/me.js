// api/users/me.js
// GET /api/users/me
// 현재 로그인한 유저의 프로필 + 잔여 크레딧 반환

import { getSessionUserId } from '../../lib/session.js';
import { supabase } from '../../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');

  const userId = getSessionUserId(req);
  if (!userId) {
    return res.status(401).json({ authenticated: false });
  }

  const { data: user, error: uerr } = await supabase
    .from('users')
    .select('id, nickname, email, profile_image_url, role, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (uerr || !user) {
    return res.status(404).json({ authenticated: false, error: 'user_not_found' });
  }

  const { data: bal } = await supabase
    .from('user_balance')
    .select('credits_remaining, total_charged, total_used')
    .eq('user_id', userId)
    .maybeSingle();

  res.status(200).json({
    authenticated: true,
    user: {
      id: user.id,
      nickname: user.nickname,
      email: user.email,
      profile_image_url: user.profile_image_url,
      role: user.role
    },
    balance: bal || { credits_remaining: 0, total_charged: 0, total_used: 0 }
  });
}
