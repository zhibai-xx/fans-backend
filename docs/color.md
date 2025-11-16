* **默认浅色主题：杂志 / 画册感**
* **深色主题：夜间霓虹感**
  两套共用同一套“语义色”命名，只是值不同，这样前端实现深浅主题切换也更舒服。

下面我分 3 部分说：

1. 颜色设计细化（Light / Dark 两套变量）
2. 关键组件配色规范（按钮 / 卡片 / 导航 / 标签等）
3. 建议的实现方式（CSS 变量 + Tailwind/全局样式）

---

## **1. 颜色设计细化**

### **1.1 通用品牌色（两套主题共用）**

> 你的应援色 = 品牌主色

```
Brand 主色核心
--brand-pink          #FE8DA1    // 品牌主色，应援粉
--brand-pink-strong   #F45A78    // 更深一点，用于 hover / Active
--brand-pink-soft     #FFE6EC    // 很浅的粉色背景，用于 tag / badge 背景
--brand-pink-outline  #F7BAC7    // 粉色描边、细线
```

---

### **1.2 浅色主题——“杂志白盒子”**

```
:root[data-theme='light'] {
  /* 背景 & 容器 */
  --bg-body:        #F5F5F7;  /* 页面整体背景，微灰 */
  --bg-surface:     #FFFFFF;  /* 卡片、主内容区 */
  --bg-subtle:      #E6E7EB;  /* 侧栏、二级背景 */
  --bg-soft-pink:   #FFE6EC;  /* 柔和粉色块（小面积） */

  /* 文本 */
  --text-primary:   #18181C;  /* 主正文 */
  --text-secondary: #5A5D67;  /* 次级信息 */
  --text-muted:     #9A9DA7;  /* 说明文字、占位提示 */

  /* 边框 & 分割线 */
  --border-subtle:  #E0E1E6;
  --border-strong:  #C6C8D0;
  --border-pink:    #F7BAC7;

  /* 品牌按钮相关 */
  --btn-primary-bg:       #FE8DA1;
  --btn-primary-bg-hover: #F45A78;
  --btn-primary-text:     #FFFFFF;

  /* 中性色按钮 */
  --btn-neutral-bg:       #18181C;
  --btn-neutral-bg-hover: #101017;
  --btn-neutral-text:     #FFFFFF;

  /* 警告/状态（可后续扩展） */
  --state-success: #16A34A;
  --state-danger:  #DC2626;

  /* 辅助色（增强专业感） */
  --accent-ink:    #1F2937;  /* 深蓝灰，用于标题/按钮 */
  --accent-navy:   #324154;  /* Tab 选中线/小 icon */
}
```

**视觉重点：**

* 整页大背景用 **--bg-body**，所有内容都“装进”白色卡片 **--bg-surface**。
* 大部分文字是深灰/墨色（**--text-primary**），**不是粉色**，粉色只做高光。
* 粉色块只出现在：主 CTA 按钮 / 重要 tag / 小面积 Banner 背景。

---

### **1.3 深色主题——“夜间霓虹”**

```
:root[data-theme='dark'] {
  /* 背景 & 容器 */
  --bg-body:        #040510;  /* 整页深蓝黑 */
  --bg-surface:     #0E1020;  /* 卡片背景 */
  --bg-subtle:      #181A2B;  /* 侧栏/底部播放器 */
  --bg-soft-pink:   #361724;  /* 有一点粉的深色，用于块状背景 */

  /* 文本 */
  --text-primary:   #F9FAFB;
  --text-secondary: #A4A8C0;
  --text-muted:     #6F7390;

  /* 边框 & 分割线 */
  --border-subtle:  #262A3E;
  --border-strong:  #3B4160;
  --border-pink:    #F45A78;

  /* 品牌按钮相关 */
  --btn-primary-bg:       #FE8DA1;
  --btn-primary-bg-hover: #F5477A;
  --btn-primary-text:     #FFFFFF;

  /* 中性色按钮 / 轮廓按钮 */
  --btn-neutral-bg:       #1F2937;
  --btn-neutral-bg-hover: #111827;
  --btn-neutral-text:     #E5E7EB;

  /* 霓虹辅色 */
  --accent-cyan:   #3CF2FF;  /* 统计数字 / 在线状态 */
  --accent-purple: #9B8CFF;  /* Tab 下划线 / 小徽标 */

  /* 状态色 */
  --state-success: #22C55E;
  --state-danger:  #F97373;
}
```

**视觉重点：**

* 背景是深蓝黑 + 卡片略浅，像夜间演唱会的屏幕。
* 粉色 + 青色 + 紫色的组合，主要在按钮、Tab 高亮、数据数字里出现。
* 主文案仍用白色/浅灰，不用粉色，以免变得“甜”。

---

## **2. 关键组件配色规范**

下面写的是**语义级规范**，你可以很容易翻译成 Tailwind 或组件库里的样式。

### **2.1 页面框架（Header / Sidebar / Main）**

**浅色主题 B：**

* body** 背景：**--bg-body
* **顶部导航栏：背景 **--bg-surface**，底部一条分割线 **1px solid var(--border-subtle)
* 左侧导航（如果有）：
  * **背景：**--bg-surface** 或 **--bg-subtle
  * **选中项：左侧粉色竖条 **4px** + 文本 **--text-primary** + 背景浅灰 **rgba(254,141,161,0.06)

**深色主题 C：**

* body** 背景：**--bg-body
* **顶部导航：背景 **--bg-surface**，底边 **var(--border-subtle)
* 侧边栏：背景 **--bg-subtle**，选中项：
  * **左侧粉色竖条 + 背景 **rgba(54,23,36,0.9)** + 文本 **--text-primary

---

### **2.2 按钮（Button）**

#### **Primary Button（最主要操作，比如“发布内容”）**

> 始终是 **粉色实心**，保证品牌识别度。

**默认样式：**

```
.btn-primary {
  background: var(--btn-primary-bg);
  color: var(--btn-primary-text);
  border-radius: 999px;
  padding: 0.6rem 1.4rem;
  font-weight: 600;
  border: none;
  box-shadow: 0 8px 20px rgba(254, 141, 161, 0.25);
}

.btn-primary:hover {
  background: var(--btn-primary-bg-hover);
  box-shadow: 0 10px 24px rgba(254, 141, 161, 0.35);
}

.btn-primary:active {
  transform: translateY(1px);
  box-shadow: 0 4px 12px rgba(254, 141, 161, 0.25);
}

.btn-primary:disabled {
  background: rgba(254, 141, 161, 0.4);
  box-shadow: none;
  cursor: not-allowed;
}
```

#### **Secondary Button（次级操作，如“管理收藏”、“更多筛选”）**

> 不用粉色填充，以避免页面太娘。

**浅色主题建议：** 深色实心按钮，略偏专业工具感。

```
.btn-secondary {
  background: var(--btn-neutral-bg);
  color: var(--btn-neutral-text);
}
.btn-secondary:hover {
  background: var(--btn-neutral-bg-hover);
}
```

**深色主题：**

* 可以用透明背景 + 粉色描边：

```
.btn-outline {
  background: transparent;
  border: 1px solid var(--border-pink);
  color: var(--btn-primary-bg);
}
.btn-outline:hover {
  background: rgba(254, 141, 161, 0.08);
}
```

---

### **2.3 标签 / Chip / 分类 Pill**

> 用来显示“热门话题 / 活动 / 标签”，这里是非常适合用浅粉色的地方。

```
.tag {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 12px;
  line-height: 1.2;
  border: 1px solid var(--border-pink);
  background: var(--bg-soft-pink);
  color: var(--brand-pink-strong);
}
.tag--outline {
  background: transparent;
  border-color: var(--border-pink);
  color: var(--brand-pink-strong);
}
```

**深色主题特例：**

* 背景改用 **--bg-soft-pink**（那种带粉的深色），文字保持 **--brand-pink**，这样不会太亮但有氛围。

---

### **2.4 卡片（内容列表：视频 / 图文）**

**浅色主题：**

```
.card {
  background: var(--bg-surface);
  border-radius: 16px;
  border: 1px solid var(--border-subtle);
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04);
}

.card-header-title {
  color: var(--text-primary);
  font-weight: 600;
}

.card-meta {
  color: var(--text-secondary);
  font-size: 12px;
}
```

**深色主题：**

```
.card {
  background: var(--bg-surface);
  border-radius: 16px;
  border: 1px solid var(--border-subtle);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
}
.card-header-title {
  color: var(--text-primary);
}
.card-meta {
  color: var(--text-secondary);
}
```

> 图片上可以加轻微的渐变遮罩，从下往上：

> linear-gradient(0deg, rgba(4,5,16,0.9) 0%, transparent 60%)

> 这样标题文字在图上也容易看清。

---

### **2.5 导航 Tabs（首页 / Explore / 通知）**

浅色主题：

```
.tabs {
  border-bottom: 1px solid var(--border-subtle);
}
.tab-item {
  padding: 0.6rem 0.8rem;
  color: var(--text-secondary);
}
.tab-item--active {
  color: var(--text-primary);
  font-weight: 600;
  border-bottom: 2px solid var(--brand-pink);
}
```

深色主题：

* 选中下划线可以用**粉 - 紫 渐变**增加氛围：

```
.tab-item--active {
  color: var(--text-primary);
  font-weight: 600;
  border-bottom: 2px solid transparent;
  background-image: linear-gradient(90deg, #fe8da1, #9b8cff);
  background-origin: border-box;
  background-clip: border-box;
}
```

---

### **2.6 输入框 / 搜索框**

浅色：

```
.input {
  background: #ffffff;
  border-radius: 999px;
  border: 1px solid var(--border-subtle);
  padding: 0.5rem 0.9rem;
  color: var(--text-primary);
}
.input::placeholder {
  color: var(--text-muted);
}
.input:focus {
  outline: 2px solid rgba(254, 141, 161, 0.35);
  outline-offset: 0;
  border-color: var(--border-pink);
}
```

深色：

```
.input {
  background: #050618;
  border-radius: 999px;
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
}
.input:focus {
  outline: 2px solid rgba(60, 242, 255, 0.5); /* 用青色做焦点环 */
  border-color: var(--accent-cyan);
}
```

---

### **2.7 头像边框 / 用户等级**

* 默认头像背景：

  * **浅色： **background: linear-gradient(135deg, #FE8DA1, #FFE6EC);
  * **深色： **background: linear-gradient(135deg, #FE8DA1, #9B8CFF);
