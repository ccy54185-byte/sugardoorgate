// /api/auth/avatar.js
// 头像上传接口

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    // 验证登录状态
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        success: false,
        error: '请先登录'
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
    
    // 解析表单数据
    const formData = await request.formData();
    const avatarFile = formData.get('avatar');
    
    if (!avatarFile) {
      return new Response(JSON.stringify({
        success: false,
        error: '请选择头像文件'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(avatarFile.type)) {
      return new Response(JSON.stringify({
        success: false,
        error: '只支持 JPG、PNG、GIF、WebP 格式'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 验证文件大小 (最大 2MB)
    if (avatarFile.size > 2 * 1024 * 1024) {
      return new Response(JSON.stringify({
        success: false,
        error: '头像大小不能超过 2MB'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 将图片转换为 base64
    const arrayBuffer = await avatarFile.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const avatarUrl = `data:${avatarFile.type};base64,${base64}`;
    
    // 更新用户头像
    await env.DB.prepare(
      'UPDATE users SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE nickname = ?'
    ).bind(avatarUrl, user.nickname).run();
    
    return new Response(JSON.stringify({
      success: true,
      avatar_url: avatarUrl
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: '上传头像失败: ' + error.message
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
    
    const payloadData = JSON.parse(atob(payload));
    if (payloadData.exp < Date.now()) return null;
    
    return payloadData;
  } catch {
    return null;
  }
}
