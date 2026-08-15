# 登录功能部署说明

## 已创建的文件

### 后端API (Cloudflare Pages Functions)
- `functions/api/auth/register.js` - 用户注册
- `functions/api/auth/login.js` - 用户登录
- `functions/api/auth/me.js` - 获取用户信息
- `functions/api/auth/avatar.js` - 头像上传
- `functions/api/auth/logout.js` - 用户登出

### 前端页面
- `login.html` - 登录/注册页面

### 配置文件
- `wrangler.toml` - Cloudflare 配置
- `schema.sql` - 数据库表结构

## 部署步骤

### 1. 创建 D1 数据库

```bash
# 登录 Cloudflare
wrangler login

# 创建数据库
wrangler d1 create tangmen-users
```

复制输出的 database_id，更新 `wrangler.toml` 中的 `YOUR_DATABASE_ID`

### 2. 初始化数据库表

```bash
wrangler d1 execute tangmen-users --file=schema.sql
```

### 3. 部署到 Cloudflare Pages

```bash
# 在项目目录执行
wrangler pages deploy .
```

### 4. 配置 Pages 绑定

在 Cloudflare Dashboard 中：
1. 进入 Pages 项目设置
2. 找到 "Functions" > "D1 database bindings"
3. 添加绑定：
   - Variable name: `DB`
   - D1 database: `tangmen-users`

### 5. 设置环境变量（可选）

在 Cloudflare Dashboard > Pages > Settings > Environment variables 中添加：
- `JWT_SECRET`: 用于签名 token 的密钥（默认使用内置密钥）

## 功能特性

### 注册
- 自定义昵称（2-20个字符）
- 密码（至少6个字符）
- 可选头像上传（支持 JPG/PNG/GIF/WebP，最大 2MB）

### 登录
- 昵称 + 密码登录
- Token 有效期 7 天
- 自动保持登录状态

### 安全特性
- 密码使用 SHA-256 加盐哈希
- JWT token 认证
- 输入验证和错误处理

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/auth/register` | POST | 用户注册 |
| `/api/auth/login` | POST | 用户登录 |
| `/api/auth/me` | GET | 获取用户信息 |
| `/api/auth/avatar` | POST | 上传头像 |
| `/api/auth/logout` | POST | 用户登出 |

## 测试

部署后访问：
- 登录页面：`https://your-domain.pages.dev/login.html`
- 首页：`https://your-domain.pages.dev/`

登录后，首页导航栏会显示用户昵称。
