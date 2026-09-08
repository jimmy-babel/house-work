# 家庭助手

基于 `UniApp + Vue3 + Vite + uView Plus + Supabase` 的家务记录应用，支持：

- 家庭成员使用邮箱 + 密码注册和登录
- 通过家庭码加入同一个家庭
- 从 `源数据.xlsx` 同步家务源数据到 Supabase
- 在小程序和 Web 端记录已完成家务
- 对比家庭成员在不同时间范围内的完成次数

## 1. 环境准备

- Node.js 20+
- 一个 Supabase 项目
- 建议在 Supabase 控制台里关闭邮箱确认：
  `Authentication -> Providers -> Email -> Confirm email`

## 2. 安装依赖

```bash
npm install
```

## 3. 配置环境变量

复制 `.env.example` 为 `.env.local`，然后填写以下变量：

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

说明：

- `VITE_SUPABASE_URL`：前端和导入脚本共用
- `VITE_SUPABASE_ANON_KEY`：只给前端使用
- `SUPABASE_SERVICE_ROLE_KEY`：只给本地导入脚本使用，不要暴露到前端

## 4. 初始化 Supabase

在 Supabase SQL Editor 中执行：

```sql
-- 直接粘贴并执行以下文件内容
-- supabase/schema.sql
```

该脚本会创建：

- `families`
- `profiles`
- `chore_catalog`
- `chore_completion_records`
- `household_items`
- `source_import_runs`

同时会创建：

- 家庭码生成函数 `generate_join_code()`
- 当前用户家庭函数 `my_family_id()`
- 创建家庭 / 加入家庭 RPC
- 完成记录快照触发器
- RLS 策略

## 5. 首次导入家务源数据

项目根目录已经包含 `源数据.xlsx`，首次初始化数据库后执行：

```bash
npm run sync:source
```

脚本会：

- 读取 `家务LIST` 工作表
- 忽略第一列序号列与最后一列说明列
- 解析分类、名称、频率标记
- upsert 到 `chore_catalog`
- 把 Excel 中已删除的旧项标记为 `is_active = false`
- 写入 `source_import_runs`

## 6. 以后如何更新 xlsx 源数据

你的维护流程固定如下：

1. 修改项目根目录下的 `源数据.xlsx`
2. 保存文件
3. 重新执行：

```bash
npm run sync:source
```

结果：

- 新增家务：新增到 `chore_catalog`
- 修改家务文案：更新原位置记录
- 删除家务：原记录改为 `inactive`
- 历史完成记录不会被覆盖，因为完成表保留了快照字段

如果你以后希望“调换 Excel 行顺序也不影响任务身份”，下一版建议在 xlsx 增加稳定任务 ID 列；当前版本仍按“工作表 + 分类列 + 行号”识别。

## 7. 本地开发

### 启动 Web

```bash
npm run dev:h5
```

### 启动微信小程序开发

```bash
npm run dev:mp-weixin
```

### 构建 Web

```bash
npm run build:h5
```

### 构建微信小程序

```bash
npm run build:mp-weixin
```

## 8. 页面说明

### 登录 / 注册页

- 登录：邮箱 + 密码
- 注册：邮箱 + 密码 + 昵称
- 注册时可选择：
  - 创建家庭
  - 加入家庭

### 记录家务页

- 按 `厨房 / 厕所 / 客厅 / 卧室 / 洗衣机房 / 其他` 顺序展示家务
- 点击家务项加入底部待确认列表
- 支持删除待确认标签
- 选择日期后点击确认，批量写入 `chore_completion_records`

### 物品记录页

- 分为 `消耗物品 / 常规物品` 两列
- 两列都支持新增物品与删除物品
- 消耗物品支持数量 `- / +` 调整，数量减到 `0` 仍保留在列表中
- 常规物品不记录数量

### 完成对比页

- 支持 `今日 / 近7天 / 近30天 / 自定义`
- 展示成员总次数对比
- 展示分类矩阵对比
- 展示时间倒序的明细流水

### 我的家庭页

- 查看家庭名、家庭码、成员列表
- 支持退出登录

## 9. 当前数据口径

- 同一成员、同一项家务、同一天允许记录多次
- 统计统一按“完成次数”计算
- 完成记录确认后不支持编辑或撤销
- 一个账号只属于一个家庭

## 10. 目录说明

```text
src/
  pages/
    index/         登录与注册
    dashboard/     家务记录 / 完成对比 / 我的家庭
    items/         物品记录
  services/        Supabase 查询与认证封装
  composables/     会话状态管理
  components/      共享页面壳与状态组件
supabase/
  schema.sql       数据库结构、函数、RLS
scripts/
  import-source-xlsx.mjs
```
