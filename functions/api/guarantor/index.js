// /api/guarantor/index.js
// 保人确认/拒绝

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
    const { application_id, action } = body;

    if (!application_id || !['confirm', 'reject'].includes(action)) {
      return new Response(JSON.stringify({ success: false, error: '参数错误' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const app = await env.DB.prepare(
      'SELECT * FROM applications WHERE id = ? AND guarantor_id = ? AND status = ?'
    ).bind(application_id, userInfo.id, 'pending_guarantor').first();
    if (!app) {
      return new Response(JSON.stringify({ success: false, error: '申请不存在或已处理' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    if (action === 'confirm') {
      await env.DB.prepare(
        "UPDATE applications SET status = 'pending_review', guarantor_confirmed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).bind(application_id).run();
      await env.DB.prepare(
        'INSERT INTO notifications (user_id, type, title, content, related_id) VALUES (?, ?, ?, ?, ?)'
      ).bind(app.applicant_id, 'guarantor_confirmed', '保人 ' + userInfo.nickname + ' 已确认', '您的申请已进入审核阶段', application_id).run();
      return new Response(JSON.stringify({ success: true, message: '已确认保人' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } else {
      await env.DB.prepare(
        "UPDATE applications SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).bind(application_id).run();
      await env.DB.prepare(
        'INSERT INTO notifications (user_id, type, title, content, related_id) VALUES (?, ?, ?, ?, ?)'
      ).bind(app.applicant_id, 'guarantor_rejected', '保人 ' + userInfo.nickname + ' 已拒绝', '您的申请已被保人拒绝', application_id).run();
      return new Response(JSON.stringify({ success: true, message: '已拒绝保人请求' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: '操作失败: ' + error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
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
    const pendingRequests = await env.DB.prepare(
      "SELECT * FROM applications WHERE guarantor_id = ? AND status = 'pending_guarantor' ORDER BY created_at DESC"
    ).bind(userInfo.id).all();
    return new Response(JSON.stringify({ success: true, requests: pendingRequests.results || [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: '获取请求失败' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
