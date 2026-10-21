# 内容目录（catalog/）

广场里的内容全部来自本目录与本仓库的几个约定位置。想改内容 = 改这里的文件并推送，
30 分钟缓存（`catalogTtlMs`）后自动生效，无需重装插件。

## 目录结构

```
dshdeworkbuddyzhuanjia/
├── catalog/
│   ├── plaza.json           # square-catalog/1 自建目录：连接器 / 插件 / 专家 / 技能
│   └── skills-market.json   # 单文件技能源（条目指向任意 GitHub 上的 SKILL.md）
├── skills/                  # 技能源：每个含 SKILL.md 的目录 = 一个技能
│   └── <skill-name>/SKILL.md
├── divisions.json           # 专家分区声明（agency-agents 格式）
└── <分区目录>/xxx.md         # 专家人设（frontmatter + 正文）
```

## 1. 技能（skills/）

- 每个技能 = 一个目录，内含 `SKILL.md`（可选 references/、scripts/ 等附属文件）
- 广场自动扫描本仓库所有含 `SKILL.md` 的目录
- 从 skillhub 迁移：用 SkillHub 插件下载技能 zip → 解压到 `skills/<名字>/` → 提交推送

## 2. 专家（divisions.json + 分区目录）

- `divisions.json` 声明分区：`{"divisions": {"分区键": {"label": "显示名"}}}`
- 人设文件放在**分区键命名的目录**下（支持多级），文件名只能用 ASCII 字母数字与 `._-`
- 文件格式：

```markdown
---
name: 显示名称
description: 一句话简介
emoji: 🛠️
---

（人设正文：角色定义、工作方式、擅长领域、输出习惯……）
```

## 3. 连接器与插件（catalog/plaza.json）

`square-catalog/1` 格式，每条 item 的关键字段：

| 字段 | 说明 |
|---|---|
| `id` / `kind` | 唯一 id；`skill` / `expert` / `connector` / `plugin` |
| `name` / `description` / `tags` | 展示信息 |
| `files` | 技能文件：`[{ "path": "SKILL.md", "url": "raw地址" }]` 或 `"text": "内联文本"` |
| `mcp` | 连接器：`{ "transport": "stdio", "command": "...", "envRequired": [] }` 或 `streamable-http` + `url` |
| `package` | 插件安装规格：`github:owner/repo` 或 npm 包名 |
| `composition` | 专家的「组合预览」文本 |

## 4. 单文件技能源（catalog/skills-market.json）

`{"items": [...]}`，每条：`id`、`raw`（SKILL.md 的 raw 地址）、`title`、`description`、
`repo`、`path`、`tags`。适合收录**别的仓库**里的技能（如从 skillhub 看中但源码在 GitHub 的）。

## 隐私与可见性

内容源走 `raw.githubusercontent.com` 匿名拉取，**本仓库必须保持 Public**
（或在 DSH 进程环境里设置 `GITHUB_TOKEN`）。
