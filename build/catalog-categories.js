/**
 * 广场目录分类（领域语义分类，按 kind 一组标准分类）。
 *
 * 远端源没有统一的目录分类（dsh-market 是 roleplay 等场景标签、GitHub 技能是
 * 目录结构、MCP Registry 什么都没有），这里用「关键词 → 标准分类」映射把
 * CatalogItem 归一到统一的目录分类，供广场的分类筛选条使用。
 *
 * 分类体系与主流智能体平台的应用市场目录保持同构（专家 15 类、技能 12 类）。
 */
/** 标准分类（顺序即展示顺序）。 */
const EXPERT_CATEGORIES = [
    '高校新生攻略',
    '产品设计',
    '技术工程',
    '金融投资',
    '全球发展',
    '教育学习',
    '游戏空间',
    '数据智能',
    '营销增长',
    '内容创作',
    '销售商务',
    '运营人力',
    '项目质量',
    '法务安全',
    '行业顾问',
];
const SKILL_CATEGORIES = [
    '办公协同',
    '开发工具',
    '投资理财',
    '效率工具',
    '内容创作',
    '信息资讯',
    '教育学习',
    '数据分析',
    '网站部署',
    '生活服务',
    '商业运营',
    '知识与学习',
];
const CONNECTOR_CATEGORIES = ['MCP 工具'];
/**
 * 插件目录分类：**运行时以 upstream 为准**。
 *
 * `awesome-dsh-plugin` 的 plugins.json 自带 categories 段（23 类，中英双语），
 * 这里只放一份同序兜底（拉取失败 / 尚未拉到时用），保证分类条不会空。
 */
export const PLUGIN_CATEGORIES = [
    'AGI 架构探索',
    'UI 增强',
    '用量与计费',
    '主题与外观',
    '模型与账号接入',
    '身份与通信',
    '会话与消息',
    '记忆',
    '工具与能力',
    'WSL 与 Windows 互操作',
    '浏览器与网页',
    '视觉与多模态',
    '语音与音频',
    '文档与渲染',
    '技能包',
    '工作流与自动化',
    'Git 与代码评审',
    '通知与集成',
    '开发与运行时',
    '安全与权限',
    '远程与移动端',
    '插件市场与管理',
    '娱乐',
];
/** 关键词 → 分类（小写匹配 name/description/tags/category 的并集文本；先命中先赢）。 */
const KEYWORD_RULES = [
    // —— 数据（先于办公：报表/图表/分析类词更专属，避免被 excel 等泛词抢走）
    {
        keywords: ['数据分析', '可视化', '图表', '报表', '统计', 'statistic', 'analytics', 'bi', 'etl', '洞察', 'insight', '爬虫', '爬取', 'scrape', 'crawling', 'pandas', 'numpy'],
        categories: { expert: '数据智能', skill: '数据分析' },
    },
    // —— 通用：办公 / 文档
    {
        keywords: ['doc', 'word', 'docx', 'ppt', '幻灯', 'slide', 'excel', '表格', 'spreadsheet', 'pdf', '文件', 'document', '办公', 'office', 'slack', 'teams', '飞书', 'notion', '协同', 'meeting', '会议', '日程', 'calendar', 'email', '邮件', 'mailbox'],
        categories: { expert: '运营人力', skill: '办公协同' },
    },
    // —— 开发
    {
        keywords: ['code', '代码', '编程', 'develop', '开发', 'github', 'gitlab', 'git', '工程', 'engineering', 'bug', '测试', 'test', 'debug', '前端', 'frontend', '后端', 'backend', 'api', 'sdk', 'cli', '终端', 'terminal', 'shell', '编译', 'deploy', '运维', 'sre', '容器', 'kubernetes', 'k8s', 'docker', '数据库', 'database', 'sql', 'postgres', 'mysql', 'redis', '框架', 'framework', 'react', 'vue', 'python', 'java', 'typescript', 'javascript', 'golang', 'rust', 'cpp', '算法', 'leetcode', 'mcp-builder', 'webapp-testing', 'migration'],
        categories: { expert: '技术工程', skill: '开发工具' },
    },
    // —— 产品 / 设计（专家有专门分类；技能里设计/品牌类归内容创作）
    {
        keywords: ['产品', 'product', '设计', 'design', 'ux', 'ui', '原型', 'prototype', '交互', '用户体验', '需求', 'prd', '画板', 'canvas', 'brand', '品牌', '风格', 'style', 'theme', '主题', 'algorithmic-art', 'art', '美术', '视觉'],
        categories: { expert: '产品设计', skill: '内容创作' },
    },
    // —— 金融
    {
        keywords: ['金融', '投资', '理财', '股票', 'stock', '基金', 'fund', 'etf', '债券', '市场', 'market', '交易', 'trading', '量化', 'quant', '风控', '财务', 'finance', '会计', 'accounting', '审计', '估值', '财富', 'wealth', 'crypto', '加密', '币', '证券'],
        categories: { expert: '金融投资', skill: '投资理财' },
    },
    // —— 全球 / 资讯
    {
        keywords: ['全球', '国际', '世界', '宏观', '经济', 'politics', '时政', '新闻', 'news', 'research', '调研', '情报', '情报', 'trend', '趋势', '行业报告', '报告', 'newsletter', 'rss', '资讯', 'media', '媒体'],
        categories: { expert: '全球发展', skill: '信息资讯' },
    },
    // —— 教育
    {
        keywords: ['教育', '学习', '教', '课程', 'course', '课程', 'academic', '学术', '论文', 'paper', '研究', 'study', 'student', '学生', '大学', 'university', '学院', 'school', '学校', '老师', 'teacher', '教授', 'k12', '英语', 'english', '语言', 'language', '翻译', 'translate', '词典', '词典', '知识', 'knowledge', '百科', 'wiki', '问答', '学习路径', 'curriculum', '教科书', 'textbook', '辅导', 'tutoring', '考试', 'exam', '高考', '考研'],
        categories: { expert: '教育学习', skill: '教育学习' },
    },
    // —— 游戏
    {
        keywords: ['游戏', 'game', '玩家', '攻略', 'playthrough', 'steam', 'switch', '主机', '电竞', 'esports', 'rpg', 'mmorpg', '射击', 'rts', '模拟', 'gameplay', '关卡', 'npc', '角色扮演', 'roleplay', 'rp', '对话', 'character', 'persona', '扮演', '沉浸', 'im4', 'oc', '酒馆', 'sillytavern'],
        categories: { expert: '游戏空间' },
    },
    // —— 营销
    {
        keywords: ['营销', 'market', '增长', 'growth', '获客', '渠道', 'channel', '广告', 'ad', 'advertising', '投放', 'campaign', 'seo', 'sem', '关键词', '社交媒体', 'social', '微博', '微信', '小红书', '抖音', 'tiktok', 'twitter', 'instagram', 'facebook', 'youtube', 'b站', '运营活动', '促销', '转化', 'conversion', '漏斗', 'funnel', '品牌营销', '文案营销', 'hacker news', 'producthunt', '爆款', '种草'],
        categories: { expert: '营销增长' },
    },
    // —— 内容
    {
        keywords: ['内容', '写作', 'write', 'writing', '文案', 'copywriting', '文章', 'article', '博客', 'blog', '创作', 'creative', '小说', 'novel', '故事', 'story', '诗歌', 'poem', '剧本', 'script', '编剧', 'video', '视频', '剪辑', '剪辑', '音频', 'audio', '播客', 'podcast', '图像', 'image', '图片', 'photo', 'photo', '摄影', 'illustration', '插画', '漫画', 'comic', 'manga', 'design', '字幕', 'subtitle', '配音', 'dub', 'tts', '语音', 'voice'],
        categories: { expert: '内容创作', skill: '内容创作' },
    },
    // —— 销售
    {
        keywords: ['销售', 'sale', 'sales', 'crm', '客户', 'customer', '线索', 'lead', '商机', '成交', '订单', 'order', 'bd', '商务', '拓展', '谈判', 'negotiation', '报价', 'quotation', '采购', 'procurement', '供应商', 'supply', 'supply chain', '供应链', '合同', 'contract'],
        categories: { expert: '销售商务' },
    },
    // —— 运营 / 人力
    {
        keywords: ['运营', '人力', 'hr', '招聘', 'recruit', '面试', 'interview', '简历', 'resume', 'cv', '人才', 'talent', '绩效', 'performance', '薪酬', 'salary', '组织', 'organization', 'culture', '文化', '员工', 'employee', '入职', 'onboarding', '培训', 'training', '项目管理', 'project', '排班', 'schedule', '考勤', 'attendance', '请假', '行政', 'admin'],
        categories: { expert: '运营人力' },
    },
    // —— 项目 / 质量
    {
        keywords: ['项目', 'project', '敏捷', 'agile', 'scrum', 'kanban', '看板', '迭代', 'sprint', 'backlog', 'roadmap', '路线图', '质量', 'quality', '测试', 'qa', '缺陷', 'defect', 'review', '评审', 'code review', '规范', 'standard', '流程', 'process', 'sop', '文档', 'documentation', '风险管理', '评审', '验收', 'acceptance', '合规', 'compliance', '审计', 'audit'],
        categories: { expert: '项目质量' },
    },
    // —— 法务 / 安全
    {
        keywords: ['法务', '法律', 'law', '律师', 'attorney', '合同审查', '协议', 'agreement', '诉讼', 'litigation', '仲裁', '合规', 'security', '安全', '漏洞', 'vulnerability', 'cve', '渗透', 'pentest', '加密', 'encryption', '隐私', 'privacy', 'gdpr', '等保', '审查', '资质', 'license', '知识产权', 'patent', '商标', 'trademark', '版权', 'copyright'],
        categories: { expert: '法务安全' },
    },
    // —— 行业顾问
    {
        keywords: ['顾问', 'consult', '咨询', 'advisory', '行业', 'industry', '专家', 'expert', '战略', 'strategy', '咨询顾问', 'coach', '教练', 'mentor', '导师', 'medical', '医疗', '健康', 'health', '医生', '医生', '律师', '老师', '心理咨询', 'psychology', 'hr 咨询', '财税', '房产', 'insurance', '保险', '职业', 'career', '职场', '咨询'],
        categories: { expert: '行业顾问' },
    },
    // —— 技能专属：效率 / 工具
    {
        keywords: ['效率', '快捷', 'automation', '自动化', 'workflow', '工作流', '快捷键', 'shortcut', '剪贴板', 'clipboard', '笔记', 'note', 'memo', '待办', 'todo', 'task', '任务', '提醒', 'remind', '日历', 'planner', '时间管理', 'productivity', '效率工具', '工具', 'tool', 'util', 'helper', 'assistant', '助手', 'snippet', '模板', 'template', 'boilerplate', '脚手架', 'scaffold', 'generator', '生成器'],
        categories: { skill: '效率工具' },
    },
    // —— 技能/连接器：生活
    {
        keywords: ['生活', '日常', '健康', 'health', '饮食', '菜谱', 'recipe', '食谱', '烹饪', '烹饪', '运动', '健身', 'fitness', '锻炼', '旅行', 'travel', '地图', 'map', '导航', '天气', 'weather', '交通', '出行', '购物', 'shopping', '快递', '物流', '快递', '家政', '预约', '挂号', '医疗', '健身', '睡眠', '睡眠', '冥想', '宠物', 'plant', '植物', '园艺', '风水', '星座', '运势', '算命', '塔罗', 'tarot', '占卜'],
        categories: { skill: '生活服务' },
    },
    // —— 技能：网站部署
    {
        keywords: ['部署', 'deploy', 'hosting', '服务器', 'server', 'vercel', 'netlify', 'nginx', 'apache', 'cdn', '域名', 'domain', 'dns', 'ssl', '证书', '网站', 'website', 'web', 'site', 'html', 'css', 'landing', '静态', 'static', 'web-artifacts', 'builder', '站点', '上线', '发布', 'publish'],
        categories: { skill: '网站部署' },
    },
    // —— 技能：商业运营
    {
        keywords: ['商业', 'business', '创业', 'startup', '商业模式', 'bizmodel', '商业计划', 'bp', '融资', 'fundraising', 'vc', '投资机构', '估值', '竞品', 'competitor', '市场分析', 'swot', '定价', 'pricing', '营收', 'revenue', 'monetization', '变现', '运营策略', '增长策略', '电商', 'ecommerce', '淘宝', '京东', '拼多多', '亚马逊', 'amazon', 'shopify', '跨境电商', '直播带货', '供应链管理', '企业', 'enterprise', 'erp', 'oa', '中台'],
        categories: { skill: '商业运营' },
    },
    // —— 技能：知识与学习
    {
        keywords: ['知识', 'knowledge', '百科', 'wikipedia', 'wiki', '词典', 'dictionary', 'glossary', '术语', '概念', '学习笔记', 'note', 'anki', '记忆', 'memory', '记忆宫殿', '思维导图', 'mindmap', '大纲', 'outline', '总结', 'summary', '摘要', 'abstract', '读书', 'reading', '书评', 'book review', '书单', '书库', '推荐书', '学习'],
        categories: { skill: '知识与学习' },
    },
    // —— 角色扮演类（专家）：游戏空间兜底
    {
        keywords: ['角色', 'roleplay', 'character', '扮演', 'persona', '对话角色', 'npc', 'ai 角色', '人设'],
        categories: { expert: '游戏空间' },
    },
];
/** 连接器的兜底分类（命中不了任何规则时归入默认分类）。 */
const CONNECTOR_FALLBACK = CONNECTOR_CATEGORIES[0];
/** 各 kind 的标准分类列表。 */
export function categoryList(kind) {
    if (kind === 'expert')
        return [...EXPERT_CATEGORIES];
    if (kind === 'skill')
        return [...SKILL_CATEGORIES];
    if (kind === 'plugin')
        return [...PLUGIN_CATEGORIES];
    return [...CONNECTOR_CATEGORIES];
}
/** 归一一个条目的目录分类。 */
export function normalizeCategory(item) {
    // 连接器：目前只有单一默认分类（要细分时在这里接入关键词规则即可）。
    if (item.kind === 'connector')
        return CONNECTOR_FALLBACK;
    // 源自带的标准分类直接透传
    const raw = item.category;
    if (raw !== undefined && raw !== '' && categoryList(item.kind).includes(raw))
        return raw;
    // 关键词匹配
    const text = [
        item.name,
        item.nameEn ?? '',
        item.description,
        item.descriptionEn ?? '',
        raw ?? '',
        ...item.tags,
    ]
        .join(' ')
        .toLowerCase();
    for (const rule of KEYWORD_RULES) {
        const target = rule.categories[item.kind];
        if (target === undefined)
            continue;
        if (rule.keywords.some((keyword) => text.includes(keyword.toLowerCase())))
            return target;
    }
    // 源自带非标准分类 → 兜底
    if (raw !== undefined && raw !== '')
        return raw;
    return undefined;
}
