// /api/auth/me.js
// 获取当前用户信息

export async function onRequestGet(context) {
  const { request, env } = context;
  
  try {
    // 从 header 获取 token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        success: false,
        error: '未登录'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const token = authHeader.substring(7);
    const user = await verifyToken(token, env);
    
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'token无效或已过期'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 获取完整用户信息
    const userInfo = await env.DB.prepare(
      'SELECT id, nickname, avatar_url, created_at FROM users WHERE nickname = ?'
    ).bind(user.nickname).first();
    
    if (!userInfo) {
      return new Response(JSON.stringify({
        success: false,
        error: '用户不存在'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      user: userInfo
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: '获取用户信息失败'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 验证 token
async function verifyToken(token, env) {
  try {
    const [header, payload, signature] = token.split('.');
    
    // 验证签名
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
    
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      new Uint8Array(sigArray),
      encoder.encode(`${header}.${payload}`)
    );
    
    if (!valid) return null;
    
    // 检查过期
    const payloadData = JSON.parse(atob(payload));
    if (payloadData.exp < Date.now()) return null;
    
    return payloadData;
  } catch {
    return null;
  }
}
