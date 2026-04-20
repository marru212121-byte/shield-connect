// api/oauth/callback.js
// 겸용 엔드포인트:
//   - GET /api/oauth/callback (code 없음) → 카페24 authorize URL 생성해서 리다이렉트 (설치 시작)
//   - GET /api/oauth/callback?code=xxx    → 토큰 교환 후 DB 저장 (설치 완료)
//
// 형님은 브라우저로 https://shield-connect.vercel.app/api/oauth/callback 한 번 접속하면 됨.
// 그러면 카페24 인증 페이지로 리다이렉트 → 승인 → 다시 이 엔드포인트로 돌아와 토큰 저장.

import crypto from 'crypto';
import {
  buildInstallUrl,
  exchangeCodeForToken,
  saveInstallToken
} from '../../lib/cafe24.js';
import { getTempCookie, setTempCookie, clearTempCookie } from '../../lib/session.js';

// 앱 등록 때 선택한 권한과 맞아야 함
const SCOPES = [
  'mall.read_application',
  'mall.read_order',
  'mall.read_customer',
  'mall.read_privacy'
];

function htmlPage(title, body) {
  return `<!doctype html>
<html lang="ko"><head>
<meta charset="utf-8">
<title>${title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
       max-width:520px;margin:60px auto;padding:0 20px;line-height:1.6;color:#222}
  h1{font-size:20px;margin-bottom:16px}
  .ok{color:#0a7c3f}
  .err{color:#b42318}
  .box{padding:20px;border:1px solid #eee;border-radius:12px;background:#fafafa}
  code{background:#f0f0f0;padding:2px 6px;border-radius:4px;font-size:13px}
</style>
</head><body><div class="box">${body}</div></body></html>`;
}

export default async function handler(req, res) {
  const { code, state, error } = req.query || {};

  // 케이스 1: 에러
  if (error) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(htmlPage(
      '인증 거부',
      `<h1 class="err">❌ 카페24 인증 거부됨</h1><p>사유: ${error}</p>`
    ));
  }

  // 케이스 2: code 없음 → authorize URL로 리다이렉트 (설치 시작)
  if (!code) {
    const newState = crypto.randomBytes(16).toString('hex');
    setTempCookie(res, 'cafe24_oauth_state', newState, 600);
    const authorizeUrl = buildInstallUrl(newState, SCOPES);
    res.writeHead(302, { Location: authorizeUrl });
    return res.end();
  }

  // 케이스 3: code 있음 → 토큰 교환 + 저장
  const savedState = getTempCookie(req, 'cafe24_oauth_state');
  if (!savedState || savedState !== state) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(htmlPage(
      'state 불일치',
      `<h1 class="err">❌ state 불일치</h1>
       <p>CSRF 검증 실패. <code>/api/oauth/callback</code>를 처음부터 다시 열어주세요.</p>`
    ));
  }
  clearTempCookie(res, 'cafe24_oauth_state');

  try {
    const tokenResponse = await exchangeCodeForToken(code);
    const norm = await saveInstallToken(tokenResponse);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(htmlPage(
      '설치 완료',
      `<h1 class="ok">✅ 쉴드 커넥트 앱 설치 완료</h1>
       <p>카페24 주문 조회 권한이 정상 연결되었습니다.</p>
       <p style="color:#666;font-size:13px">
         Access Token 만료: ${new Date(norm.access_token_expires_at).toLocaleString('ko-KR')}<br>
         Refresh Token 만료: ${new Date(norm.refresh_token_expires_at).toLocaleString('ko-KR')}<br>
         (Access Token은 자동 갱신됩니다)
       </p>
       <p>이제 이 창은 닫으셔도 됩니다.</p>`
    ));
  } catch (err) {
    console.error('[cafe24 install] 실패:', err);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(htmlPage(
      '설치 실패',
      `<h1 class="err">❌ 설치 실패</h1>
       <p>${err.message}</p>
       <p>다시 시도: <a href="/api/oauth/callback">/api/oauth/callback</a></p>`
    ));
  }
}
