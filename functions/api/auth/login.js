// /api/auth/login.js
// 用户登录接口

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const body = await request.json();
    const { nickname, password } = body;
    
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
    
    // 查找用户
    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE nickname = ?'
    ).bind(nickname).first();
    
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: '用户不存在'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 验证密码
    const encoder = new TextEncoder();
    const data = encoder.encode(password + nickname);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    if (passwordHash !== user.password_hash) {
      return new Response(JSON.stringify({
        success: false,
        error: '密码错误'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 生成 token
    const token = await generateToken(nickname, env);
    
    return new Response(JSON.stringify({
      success: true,
      user: {
        id: user.id,
        nickname: user.nickname,
        avatar_url: user.avatar_url
      },
      token
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: '登录失败: ' + error.message
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
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000
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
