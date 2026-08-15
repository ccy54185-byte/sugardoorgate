// /api/auth/logout.js
// 用户登出接口

export async function onRequestPost(context) {
  // 简单返回成功，前端清除 token 即可
  return new Response(JSON.stringify({
    success: true,
    message: '已登出'
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
