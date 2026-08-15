// /api/applications/index.js
// 提交申请 & 查看申请状态

async function verifyToken(token, env) {
  try {
    const [header, payload, signature] = token.split('.');
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(env.JWT_SECRET || 'tangmen-secret-key'), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sigArray = [];
    for (let i = 0; i < signature.length; i += 2) sigArray.push(parseInt(signature.substr(i, 2), 16));
    const valid = await crypto.subtle.verify('HMAC', key, new Uint8Array(sigArray), encoder.encode(header + '.' + payload));
    if (!valid) return null;
    const payloadData = JSON.parse(atob(payload));
    if (payloadData.exp < Date.now()) return null;
    return payloadData;
  } catch { return null; }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: '未登录' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    const user = await verifyToken(authHeader.substring(7), env);
    if (!user) {
      return new Response(JSON.stringify({ success: false, error: 'token无效' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    const userInfo = await env.DB.prepare('SELECT id, nickname FROM users WHERE nickname = ?').bind(user.nickname).first();
    if (!userInfo) {
      return new Response(JSON.stringify({ success: false, error: '用户不存在' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }
    const body = await request.json();
    const { guarantor_name, reason } = body;

    const existingApp = await env.DB.prepare(
      "SELECT id FROM applications WHERE applicant_id = ? AND status IN ('pending_guarantor', 'pending_review')"
    ).bind(userInfo.id).first();
    if (existingApp) {
      return new Response(JSON.stringify({ success: false, error: '您已有待处理的申请' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    let guarantorId = null;
    let guarantorName = '';
    let status = 'pending_review';

    if (guarantor_name) {
      const guarantor = await env.DB.prepare('SELECT id, nickname FROM users WHERE nickname = ?').bind(guarantor_name).first();
      if (!guarantor) {
        return new Response(JSON.stringify({ success: false, error: '保人不存在，请检查昵称' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      if (guarantor.id === userInfo.id) {
        return new Response(JSON.stringify({ success: false, error: '不能指定自己为保人' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      guarantorId = guarantor.id;
      guarantorName = guarantor.nickname;
      status = 'pending_guarantor';
    }

    const result = await env.DB.prepare(
      'INSERT INTO applications (applicant_id, applicant_name, guarantor_id, guarantor_name, reason, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(userInfo.id, userInfo.nickname, guarantorId, guarantorName, reason || '', status).run();
    const appId = result.meta.last_row_id;

    await env.DB.prepare(
      'INSERT INTO notifications (user_id, type, title, content, related_id) VALUES (?, ?, ?, ?, ?)'
    ).bind(userInfo.id, 'application_submitted', '申请已提交', guarantorName ? '等待保人 ' + guarantorName + ' 确认' : '申请已提交，等待审核', appId).run();

    if (guarantorId) {
      await env.DB.prepare(
        'INSERT INTO notifications (user_id, type, title, content, related_id) VALUES (?, ?, ?, ?, ?)'
      ).bind(guarantorId, 'guarantor_request', userInfo.nickname + ' 请求您做保人', '申请人：' + userInfo.nickname + '\n理由：' + (reason || '无'), appId).run();
    }

    return new Response(JSON.stringify({ success: true, application_id: appId }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: '提交申请失败: ' + error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: '未登录' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    const user = await verifyToken(authHeader.substring(7), env);
    if (!user) {
      return new Response(JSON.stringify({ success: false, error: 'token无效' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    const userInfo = await env.DB.prepare('SELECT id FROM users WHERE nickname = ?').bind(user.nickname).first();
    if (!userInfo) {
      return new Response(JSON.stringify({ success: false, error: '用户不存在' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }
    const myApps = await env.DB.prepare(
      'SELECT * FROM applications WHERE applicant_id = ? ORDER BY created_at DESC'
    ).bind(userInfo.id).all();
    return new Response(JSON.stringify({ success: true, applications: myApps.results || [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: '获取申请失败' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
