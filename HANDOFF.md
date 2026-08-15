# 唐门网站项目交接文档

## 一、项目概况

- **项目名称**: sugardoorgate (唐门官网)
- **本地路径**: C:\Users\16600\tangmen-website\
- **GitHub仓库**: https://github.com/ccy54185-byte/sugardoorgate.git
- **线上地址**: https://sugardoorbeta.pages.dev/
- **Cloudflare Pages项目名**: sugardoorbeta
- **D1数据库**: sugardoorgate-db (ID: 84b1a342-6cf1-4516-b519-6cff71077bac)
- **GitHub账号**: ccy54185-byte（已登录浏览器）
- **Cloudflare账号**: 已登录浏览器

## 二、用户要求完成的功能清单

1. ✅ 通知系统（登录后显示通知铃铛，查看申请信息）- 代码已写
2. ✅ 申请入门（填写保人+理由，保人确认流程）- 代码已写
3. ✅ 身份登记（后台审批，通知流转）- 代码已写
4. ✅ 成员展示（各安其位栏目动态加载）- 代码已写
5. ✅ 找回密码功能 - 代码已写
6. ✅ 购买新品按钮（跳转火莲页面）- 已完成
7. ✅ 星辰流星背景效果（火莲页面）- 已完成
8. ❌ **头像功能 - 用户明确说要取消**
9. ❌ **通知功能 - 不工作的根本原因未修复**
10. ❌ **后台管理 - 不存在，需要创建**

## 三、核心未修复的BUG

### BUG 1：checkLoginStatus() 从未被调用（最关键）

index.html 中有两个 document.addEventListener('DOMContentLoaded', ...) 回调。
- 第一个回调（第1807行）：主要页面初始化逻辑
- 第二个回调（第2278行）：包含 checkLoginStatus() 调用

第二个回调在 DOM 已加载后才注册，永远不会触发。

**修复方案**：
1. 把第二个回调中的代码移到第一个回调末尾（约第1921行的 }); 之前）
2. 删除第二个回调（第2278-2287行）

需要添加到第一个回调末尾的代码：
```javascript
    loadApprovedMembers();
    const token = localStorage.getItem('token');
    if (token) {
      document.getElementById('registerBtn').style.display = 'inline-block';
    }
    checkLoginStatus();
```

### BUG 2：需要移除头像功能

checkLoginStatus() 函数中包含 avatarHtml 头像渲染逻辑，用户要求取消。

简化后的函数：
```javascript
async function checkLoginStatus() {
    const token = localStorage.getItem('token');
    const loginNavItem = document.getElementById('loginNavItem');
    const notifNavItem = document.getElementById('notifNavItem');
    if (token) {
      try {
        const response = await fetch('/api/auth/me', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await response.json();
        if (data.success && data.user) {
          loginNavItem.innerHTML = '<a href="login.html" class="nav-cta">' + data.user.nickname + '</a>';
          notifNavItem.style.display = 'block';
          loadNotifications();
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          notifNavItem.style.display = 'none';
        }
      } catch (error) {}
    } else {
      notifNavItem.style.display = 'none';
    }
  }
```

### BUG 3：后台管理不存在

需要创建 admin.html 真正的后台管理页面。

## 四、部署命令

```bash
cd C:\Users\16600\tangmen-website
npx wrangler pages deploy . --project-name=sugardoorbeta
git add -A && git commit -m "描述" && git push origin main
```

## 五、注意事项

- PowerShell 语言模式是 ConstrainedLanguage，不能用 [System.IO.File]，只能用 Set-Content
- index.html 有 75000+ 字符，约 2388 行
- GitHub 和 Cloudflare 账号都在浏览器中已登录，可以直接操控浏览器完成操作
- D1 数据库已创建，API 绑定名为 DB
