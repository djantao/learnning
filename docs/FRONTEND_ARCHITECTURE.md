# MindForge 前端架构风格指南

> "静锻·Quiet Forge" — 深沉青碧 × 温暖铜色 × 匠人质感

---

## 1. 设计哲学

MindForge 的视觉语言建立在 **三个核心原则** 之上：

### 1.1 静而非燥 (Calm over Noise)
学习是深度工作。界面应当安静、不抢戏。用留白、柔和的色彩层级、克制的动效来营造"专注感"。

### 1.2 匠而非工 (Craft over Factory)
每一个交互细节都经过考量。圆角、阴影、hover 状态、过渡动画——这些都是"匠人工具"，不是装饰。

### 1.3 异而非同 (Distinctive over Generic)
不用模板蓝 (`#007AFF`)。MindForge 的签名色是 **深沉青碧** (`#1B6B5A`)，搭配 **温暖铜色** (`#D4834A`) 作为"火花"点缀。

---

## 2. 设计 Token 系统

### 2.1 颜色层级

```
Surface 层 (从低到高):
  background → card → popover

语义色:
  primary    — 青碧色，主交互
  copper     — 暖铜色，亮点/火花
  destructive — 红色，删除/警告
  success    — 绿色，完成/通过
  warning    — 橙色，注意/待处理

文本层级:
  foreground      — 主要文本
  muted-foreground — 次要文本/说明
```

### 2.2 排版层级

| 层级 | 类名 | 用途 |
|------|------|------|
| 页面标题 | `text-xl sm:text-2xl font-bold` | 页面主标题 |
| 区块标题 | `text-base font-semibold` | 卡片标题 |
| 正文 | `text-sm` | 常规内容 |
| 辅助文本 | `text-xs text-muted-foreground` | 说明/时间戳 |
| 微型文本 | `text-[10px] text-muted-foreground` | Badge/标签 |

### 2.3 间距系统

```
section gap:  space-y-6 sm:space-y-8  (页面区块间距)
card padding: p-4 sm:p-5              (卡片内边距)
item gap:     gap-3 sm:gap-4          (列表项间距)
dense gap:    gap-2                   (紧凑间距)
```

### 2.4 圆角系统

| Token | 值 | 用途 |
|-------|-----|------|
| `rounded-lg` | ~14px | 小元素 (icon容器, badge) |
| `rounded-xl` | ~19px | 按钮、输入框、小卡片 |
| `rounded-2xl` | ~25px | 卡片、面板 |
| `rounded-full` | 50% | Pill/Avatar |

---

## 3. 组件架构模式

### 3.1 组合模式 (Compound Components)

```tsx
// ✅ 推荐：可组合
<Card>
  <CardHeader>
    <CardTitle>标题</CardTitle>
  </CardHeader>
  <CardContent>内容</CardContent>
</Card>

// ❌ 避免：过度封装单一组件
<CustomCard title="标题" content="内容" />
```

### 3.2 状态分层

```
┌─────────────────────────────┐
│  Server State (RSC)         │  ← 数据直取 Prisma，无客户端 JS
├─────────────────────────────┤
│  Client Cache (React Query) │  ← 客户端数据缓存、自动刷新
├─────────────────────────────┤
│  Client State (Zustand)     │  ← 跨组件共享状态
├─────────────────────────────┤
│  UI State (useState/URL)    │  ← 组件本地状态
└─────────────────────────────┘
```

### 3.3 服务端优先 (RSC First)

仪表盘页面是典型案例：
1. 所有数据查询在服务端并行执行 (`Promise.all`)
2. 页面直接渲染 HTML，无需客户端水合
3. 仅交互组件 (`KnowledgePulse`, `StreakCalendar`) 使用 `"use client"`

### 3.4 原子化样式

```tsx
// ✅ 使用设计 Token (语义化)
<Card className="rounded-2xl border bg-card p-5">

// ❌ 避免硬编码颜色
<Card className="rounded-2xl border bg-[#FFFFFF] p-5">
```

---

## 4. 签名设计元素

### 4.1 Forge Glow (锻造辉光)

在关键交互元素上使用**温暖铜色辉光**作为 hover/focus 反馈：

```css
.forge-glow {
  transition: box-shadow 0.4s ease, border-color 0.4s ease;
}
.forge-glow:hover {
  box-shadow: 0 0 0 4px var(--copper-glow);
  border-color: var(--copper);
}
```

适用场景：
- 主操作按钮（"继续学习"、"开始复习"）
- KnowledgePulse 组件
- 重要的可点击卡片

### 4.2 KnowledgePulse (知识脉动)

这是 MindForge 的**签名视觉元素**。它不是冷冰冰的图表，而是一个"有生命的"学习状态指示器：

- **0级 (静默)**：灰色静止圆点
- **1级 (微光)**：淡蓝光晕
- **2级 (活跃)**：青碧色呼吸
- **3级 (专注)**：青碧+铜色双光环
- **4级 (心流)**：完整的三层呼吸辉光 + 温暖铜色

### 4.3 非对称 Hero 布局

仪表盘使用 **2/3 + 1/3 非对称网格**替代传统的均匀网格：

```
┌──────────────────────────┬──────────┐
│                          │          │
│   Continue Learning      │ Knowledge│
│   (Hero Card + Stats)    │  Pulse   │
│                          │          │
├──────────────────────────┴──────────┤
│   Streak Calendar    │  Daily List  │
└─────────────────────────────────────┘
```

---

## 5. 暗色模式

暗色模式不是简单的"黑色背景+白色文字"。MindForge 的暗色模式：

- **暖黑底色** (`#191715`) — 不是纯黑，带微暖色调
- **卡片** (`#24211D`) — 比背景稍亮，有层次
- **青碧色更亮** (`#4DAD95`) — 在暗背景下保持足够的对比度
- **铜色** (`#E89868`) — 暖色调在暗模式下更柔和

---

## 6. 动效规范

| 类型 | 时长 | 用途 |
|------|------|------|
| 微交互 | 150-200ms | hover、active 状态 |
| 过渡 | 300-400ms | 主题切换、展开/折叠 |
| 呼吸动画 | 2-3s | 持续性状态指示 |
| 辉光动画 | 2.5-3s | 签名元素的环境光效 |

原则：**动效服务于信息传递，不是装饰。**

---

## 7. 响应式策略

| 断点 | 布局 |
|------|------|
| 移动端 (< lg) | 单列 + 底部标签栏 + 汉堡菜单 |
| 桌面端 (≥ lg) | 侧边栏 + 多列网格 |
| 宽屏 (≥ xl) | 更大的间距和留白 |

---

## 8. 如何扩展

### 创建新页面时：
1. 用 `bg-background` 作为底色
2. 用 `Card` 组件包裹内容区
3. 用 `space-y-6 sm:space-y-8` 控制区块间距
4. 卡片标题统一用 `text-base font-semibold`
5. 图标容器用 `rounded-lg bg-{color}/10` 样式

### 创建新组件时：
1. 所有颜色从设计 Token 读取，不硬编码
2. 使用 `cn()` 合并条件样式
3. 交互元素要有 `transition-all duration-200`
4. 考虑暗色模式
5. 考虑移动端适配

---

*最后更新：2026-06-16*
*设计系统版本：v2.0 "Quiet Forge"*
