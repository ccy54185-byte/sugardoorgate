# 迭代日志 - 唐门 SUGARDOOR

## v1.0.0 - 2026-08-15

### 🎉 首次发布

#### 用户系统
- 用户注册/登录/登出
- 头像上传
- JWT Token 认证（7天有效期）

#### 通知系统
- 导航栏通知铃铛（登录后显示）
- 未读红点计数
- 通知面板：展示所有通知
- 支持标记单条/全部已读
- 30秒自动刷新

#### 申请入门
- 在线申请表单（填写保人昵称 + 申请理由）
- 保人确认/拒绝流程
- 双向通知：申请人收到保人确认/拒绝通知，保人收到担保请求通知
- 申请状态：等待保人确认 → 待审核 → 已通过/已拒绝

#### 身份登记
- 登记表单（选择身份、填写头衔、简介）
- 后台审批机制
- 登记人收到"等待审批"通知
- 审批后收到"通过/未通过"通知
- 支持身份：门主、唐主、道官、财政管理人员、长老、内门弟子、外门弟子

#### 一门之内各安其位
- 动态加载已批准成员
- 按身份分类展示（7个等级）
- 显示成员头像、昵称、头衔、简介
- 点击展开/收起成员列表（默认收起）
- 修复：展开/收起不再需要两次点击

### 技术栈
- 前端：原生 HTML/CSS/JS
- 后端：Cloudflare Pages Functions
- 数据库：Cloudflare D1 (SQLite)
- 部署：Cloudflare Pages
- 源码托管：GitHub

### API 端点
| 端点 | 方法 | 作用 |
|------|------|------|
| /api/auth/register | POST | 用户注册 |
| /api/auth/login | POST | 用户登录 |
| /api/auth/logout | POST | 用户登出 |
| /api/auth/me | GET | 获取当前用户信息 |
| /api/auth/avatar | POST | 上传头像 |
| /api/notifications | GET | 获取通知列表 + 未读数 |
| /api/notifications | POST | 标记已读 |
| /api/applications | POST | 提交入门申请 |
| /api/applications | GET | 查看我的申请 |
| /api/guarantor | POST | 保人确认/拒绝 |
| /api/guarantor | GET | 查看待确认保人请求 |
| /api/members | POST | 提交身份登记 |
| /api/members | GET | 获取已批准成员 |
| /api/members?status=pending | GET | 获取待审核登记 |
| /api/members | PUT | 审批身份登记 |

### 数据库表
- users - 用户表
- applications - 申请表（含保人机制）
- notifications - 通知表
- member_registrations - 身份登记表
