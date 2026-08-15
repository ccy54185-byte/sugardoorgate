// /api/auth/register.js
// 用户注册接口

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const body = await request.json();
    const { nickname, password, avatar_url } = body;
    
    // 验证输入
    if (!nickname || !password) {
      return new Response(JSON.stringify({
        success: false,
        error: '昵称和密码不能为空'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (nickname.length < 2 || nickname.length > 20) {
      return new Response(JSON.stringify({
        success: false,
        error: '昵称长度需要在2-20个字符之间'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (password.length < 6) {
      return new Response(JSON.stringify({
        success: false,
        error: '密码长度至少6个字符'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 检查昵称是否已存在
    const existingUser = await env.DB.prepare(
      'SELECT id FROM users WHERE nickname = ?'
    ).bind(nickname).first();
    
    if (existingUser) {
      return new Response(JSON.stringify({
        success: false,
        error: '该昵称已被使用'
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 密码加密 (使用 Web Crypto API)
    const encoder = new TextEncoder();
    const data = encoder.encode(password + nickname); // 简单加盐
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // 插入用户
    const result = await env.DB.prepare(
      'INSERT INTO users (nickname, password_hash, avatar_url) VALUES (?, ?, ?)'
    ).bind(nickname, passwordHash, avatar_url || '').run();
    
    // 生成 session token
    const token = await generateToken(nickname, env);
    
    return new Response(JSON.stringify({
      success: true,
      user: {
        id: result.meta?.last_row_id,
        nickname,
        avatar_url: avatar_url || ''
      },
      token
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: '注册失败: ' + error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 生成 JWT-like token
async function generateToken(nickname, env) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    nickname,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7天过期
  }));
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(env.JWT_SECRET || 'tangmen-secret-key'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${header}.${payload}`)
  );
  
  const sigArray = Array.from(new Uint8Array(signature));
  const sig = sigArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `${header}.${payload}.${sig}`;
}
