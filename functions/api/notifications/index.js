// /api/notifications/index.js
// 获取通知列表 & 标记已读

async function verifyToken(token, env) {
  try {
    const [header, payload, signature] = token.split('.');
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(env.JWT_SECRET || 'tangmen-secret-key'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const sigArray = [];
    for (let i = 0; i < signature.length; i += 2) {
      sigArray.push(parseInt(signature.substr(i, 2), 16));
    }
    const valid = await crypto.subtle.verify('HMAC', key, new Uint8Array(sigArray), encoder.encode(header + '.' + payload));
    if (!valid) return null;
    const payloadData = JSON.parse(atob(payload));
    if (payloadData.exp < Date.now()) return null;
    return payloadData;
  } catch {
    return null;
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: '未登录' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    const token = authHeader.substring(7);
    const user = await verifyToken(token, env);
    if (!user) {
      return new Response(JSON.stringify({ success: false, error: 'token无效' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    const userInfo = await env.DB.prepare('SELECT id FROM users WHERE nickname = ?').bind(user.nickname).first();
    if (!userInfo) {
      return new Response(JSON.stringify({ success: false, error: '用户不存在' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }
    const unreadCount = await env.DB.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').bind(userInfo.id).first();
    const notifications = await env.DB.prepare(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
    ).bind(userInfo.id).all();
    return new Response(JSON.stringify({
      success: true,
      unread_count: unreadCount.count,
      notifications: notifications.results || []
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: '获取通知失败' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: '未登录' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    const token = authHeader.substring(7);
    const user = await verifyToken(token, env);
    if (!user) {
      return new Response(JSON.stringify({ success: false, error: 'token无效' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    const userInfo = await env.DB.prepare('SELECT id FROM users WHERE nickname = ?').bind(user.nickname).first();
    if (!userInfo) {
      return new Response(JSON.stringify({ success: false, error: '用户不存在' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }
    const body = await request.json();
    const { notification_id, mark_all } = body;
    if (mark_all) {
      await env.DB.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').bind(userInfo.id).run();
    } else if (notification_id) {
      await env.DB.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').bind(notification_id, userInfo.id).run();
    }
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: '操作失败' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
