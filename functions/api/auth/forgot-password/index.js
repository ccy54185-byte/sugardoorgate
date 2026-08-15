// /api/auth/forgot-password/index.js
// 找回密码 - 发起重置请求

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const { nickname } = body;

    if (!nickname) {
      return new Response(JSON.stringify({ success: false, error: '请输入昵称' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    // 查找用户
    const user = await env.DB.prepare('SELECT id, nickname FROM users WHERE nickname = ?').bind(nickname).first();
    if (!user) {
      // 安全考虑：不暴露用户是否存在
      return new Response(JSON.stringify({ success: true, message: '如果该用户存在，已发送重置通知' }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    // 生成重置 token（有效期 30 分钟）
    const encoder = new TextEncoder();
    const tokenData = encoder.encode(user.id + ':' + Date.now() + ':' + Math.random().toString(36));
    const hashBuffer = await crypto.subtle.digest('SHA-256', tokenData);
    const resetToken = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    // 存储 token（用通知表的 content 字段携带）
    const resetUrl = '/reset-password.html?token=' + resetToken;

    // 发送通知给用户
    await env.DB.prepare(
      'INSERT INTO notifications (user_id, type, title, content, related_id) VALUES (?, ?, ?, ?, ?)'
    ).bind(
      user.id,
      'password_reset',
      '密码重置请求',
      '您请求了密码重置。请点击<a href="' + resetUrl + '" style="color:var(--gold);text-decoration:underline;">重置密码</a>，链接30分钟内有效。如果这不是您本人操作，请忽略此消息。',
      0
    ).run();

    // 存储 token 到数据库（用 member_registrations 的 bio 字段临时存储，或新建表）
    // 简单方案：用 notifications 的 related_id 存储 token 的 hash
    // 更好的方案：创建 password_resets 表
    await env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS password_resets (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token TEXT NOT NULL, expires_at DATETIME NOT NULL, used INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)'
    ).run();

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await env.DB.prepare(
      'INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)'
    ).bind(user.id, resetToken, expiresAt).run();

    return new Response(JSON.stringify({ success: true, message: '如果该用户存在，已发送重置通知' }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: '请求失败: ' + error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
