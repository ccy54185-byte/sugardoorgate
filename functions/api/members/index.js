// /api/members/index.js
// 身份登记 & 获取成员列表

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

// POST - 提交身份登记
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
    const userInfo = await env.DB.prepare('SELECT id, nickname, avatar_url FROM users WHERE nickname = ?').bind(user.nickname).first();
    if (!userInfo) {
      return new Response(JSON.stringify({ success: false, error: '用户不存在' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const body = await request.json();
    const { role, title, bio } = body;

    const validRoles = ['门主', '唐主', '道官', '财政管理人员', '长老', '内门弟子', '外门弟子'];
    if (!role || !validRoles.includes(role)) {
      return new Response(JSON.stringify({ success: false, error: '请选择有效的身份' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // 检查是否已有待审核的登记
    const existing = await env.DB.prepare(
      "SELECT id, status FROM member_registrations WHERE user_id = ? ORDER BY created_at DESC LIMIT 1"
    ).bind(userInfo.id).first();

    if (existing && existing.status === 'pending') {
      return new Response(JSON.stringify({ success: false, error: '您已有待审核的登记，请等待审批' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // 创建登记
    const result = await env.DB.prepare(
      'INSERT INTO member_registrations (user_id, nickname, role, title, bio, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(userInfo.id, userInfo.nickname, role, title || '', bio || '', 'pending').run();

    // 给登记人发送等待审批通知
    await env.DB.prepare(
      'INSERT INTO notifications (user_id, type, title, content, related_id) VALUES (?, ?, ?, ?, ?)'
    ).bind(userInfo.id, 'registration_pending', '身份登记已提交', '您的 ' + role + ' 身份登记已提交，等待后台审批', result.meta.last_row_id).run();

    return new Response(JSON.stringify({ success: true, message: '身份登记已提交，等待审批' }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: '提交失败: ' + error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// GET - 获取已批准的成员列表（公开）或待审核列表（需登录）
export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status');

    // 如果请求待审核列表，需要验证管理员身份
    if (statusFilter === 'pending') {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ success: false, error: '未登录' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      const user = await verifyToken(authHeader.substring(7), env);
      if (!user) {
        return new Response(JSON.stringify({ success: false, error: 'token无效' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      const pending = await env.DB.prepare(
        "SELECT * FROM member_registrations WHERE status = 'pending' ORDER BY created_at DESC"
      ).all();
      return new Response(JSON.stringify({ success: true, members: pending.results || [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // 获取已批准的成员（公开接口）
    const approved = await env.DB.prepare(
      "SELECT mr.nickname, mr.role, mr.title, mr.bio, u.avatar_url, mr.created_at FROM member_registrations mr LEFT JOIN users u ON mr.user_id = u.id WHERE mr.status = 'approved' ORDER BY CASE mr.role WHEN '门主' THEN 1 WHEN '唐主' THEN 2 WHEN '道官' THEN 3 WHEN '财政管理人员' THEN 4 WHEN '长老' THEN 5 WHEN '内门弟子' THEN 6 WHEN '外门弟子' THEN 7 ELSE 8 END, mr.created_at ASC"
    ).all();

    return new Response(JSON.stringify({ success: true, members: approved.results || [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: '获取成员失败' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// PUT - 审批身份登记（管理员）
export async function onRequestPut(context) {
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

    const body = await request.json();
    const { registration_id, action } = body; // action: 'approve' 或 'reject'

    if (!registration_id || !['approve', 'reject'].includes(action)) {
      return new Response(JSON.stringify({ success: false, error: '参数错误' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const reg = await env.DB.prepare(
      "SELECT * FROM member_registrations WHERE id = ? AND status = 'pending'"
    ).bind(registration_id).first();

    if (!reg) {
      return new Response(JSON.stringify({ success: false, error: '登记不存在或已处理' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    await env.DB.prepare(
      'UPDATE member_registrations SET status = ?, reviewer_id = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(newStatus, user.nickname, registration_id).run();

    // 通知登记人
    const notifType = action === 'approve' ? 'registration_approved' : 'registration_rejected';
    const notifTitle = action === 'approve' ? '身份登记已通过' : '身份登记未通过';
    const notifContent = action === 'approve'
      ? '您的 ' + reg.role + ' 身份登记已通过审批，信息已展示在一门之内各安其位栏目'
      : '您的 ' + reg.role + ' 身份登记未通过审批';

    await env.DB.prepare(
      'INSERT INTO notifications (user_id, type, title, content, related_id) VALUES (?, ?, ?, ?, ?)'
    ).bind(reg.user_id, notifType, notifTitle, notifContent, registration_id).run();

    return new Response(JSON.stringify({ success: true, message: action === 'approve' ? '已通过' : '已拒绝' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: '审批失败: ' + error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
