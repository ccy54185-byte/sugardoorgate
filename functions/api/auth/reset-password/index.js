// /api/auth/reset-password/index.js
// 重置密码

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const { token, new_password } = body;

    if (!token || !new_password) {
      return new Response(JSON.stringify({ success: false, error: '参数不完整' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    if (new_password.length < 6) {
      return new Response(JSON.stringify({ success: false, error: '密码长度至少6个字符' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    // 确保表存在
    await env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS password_resets (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token TEXT NOT NULL, expires_at DATETIME NOT NULL, used INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)'
    ).run();

    // 查找有效的 token
    const reset = await env.DB.prepare(
      "SELECT * FROM password_resets WHERE token = ? AND used = 0 AND expires_at > datetime('now')"
    ).bind(token).first();

    if (!reset) {
      return new Response(JSON.stringify({ success: false, error: '链接无效或已过期' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取用户信息
    const user = await env.DB.prepare('SELECT id, nickname FROM users WHERE id = ?').bind(reset.user_id).first();
    if (!user) {
      return new Response(JSON.stringify({ success: false, error: '用户不存在' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }

    // 加密新密码
    const encoder = new TextEncoder();
    const data = encoder.encode(new_password + user.nickname);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const passwordHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    // 更新密码
    await env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(passwordHash, user.id).run();

    // 标记 token 已使用
    await env.DB.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').bind(reset.id).run();

    // 发送通知：密码已重置
    await env.DB.prepare(
      'INSERT INTO notifications (user_id, type, title, content, related_id) VALUES (?, ?, ?, ?, ?)'
    ).bind(user.id, 'password_changed', '密码已重置', '您的密码已成功重置，请使用新密码登录。', 0).run();

    return new Response(JSON.stringify({ success: true, message: '密码重置成功，请登录' }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: '重置失败: ' + error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
