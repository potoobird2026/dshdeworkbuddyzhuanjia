/**
 * 主面板：胶囊页签 + 搜索胶囊 + 右行动作的顶栏，下接内容区。
 *
 * 交互模型（v2）：
 *   - 四个页签（专家 / 技能 / 连接器 / 插件）默认只展示**广场**数据。
 *   - 顶栏右上角「我的专家 / 我的技能 / 我的 MCP / 我的插件」按钮 → 进入独立子页面，
 *     查看本地已安装内容；子页面顶部有返回按钮回到广场。
 *   - 页签内部不再有「本地/广场」切换控件。
 */

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type CapabilitiesResponse } from './api.js';
import { ActionButton, Banner, PillTabs, SearchPill, type TabItem, type T } from './components.js';
import { MyConnectorsPage, ConnectorsTab } from './connectors.js';
import type { ClientCtx } from './context.js';
import { MyExpertsPage, ExpertsTab } from './experts.js';
import { IconConnector, IconExpert, IconPlugin, IconRefresh, IconSkill } from './icons.js';
import { MyPluginsPage, PluginsTab } from './plugins.js';
import { MySkillsPage, SkillsTab } from './skills.js';
import { SubmitMenu, SubmitModal, type SubmitKind } from './plaza.js';
import type { DeckStatus } from '../types.js';

type Tab = 'experts' | 'skills' | 'connectors' | 'plugins';

/** 工作目录记忆键（项目技能/预设解析基准）。 */
const CWD_KEY = 'dsh-squares.cwd';

/** 面板主体。 */
export function SquarePage({
  ctx,
  t,
  initialTab = 'plugins',
}: {
  ctx: ClientCtx;
  t: T;
  /** 初始页签（静态预览用，默认插件页）。 */
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [query, setQuery] = useState('');
  const [caps, setCaps] = useState<CapabilitiesResponse | undefined>();
  const [status, setStatus] = useState<DeckStatus | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [token, setToken] = useState(0);
  // 「添加」意图只用一个瞬时开关表达：打开即被对应的页签消费并关闭，
  // 因此切换页签（组件重挂载）绝不会再弹一次弹窗。
  const [addOpen, setAddOpen] = useState(false);
  // 子页面导航：undefined = 广场（默认）；'mine' = 本地已安装列表页。
  const [page, setPage] = useState<'plaza' | 'mine'>('plaza');
  /** 提交弹窗打开的种类（undefined = 关闭；由顶栏「提交」下拉触发）。 */
  const [submitKind, setSubmitKind] = useState<SubmitKind | undefined>();
  const [cwd, setCwd] = useState<string>(() => {
    try {
      return window.localStorage.getItem(CWD_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [, forceRender] = useState(0);

  // 语言切换时重渲染（t 内部读取当前语言）。
  useEffect(() => {
    try {
      const disposer = ctx.locale.subscribe?.(() => forceRender((value) => value + 1));
      return () => {
        if (typeof disposer === 'function') disposer();
      };
    } catch {
      return undefined;
    }
  }, [ctx]);

  const load = useCallback(async () => {
    setError(undefined);
    try {
      const [capabilities, deckStatus] = await Promise.all([api.capabilities(), api.status()]);
      setCaps(capabilities);
      setStatus(deckStatus);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : String(failure));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, token]);

  const saveCwd = (next: string): void => {
    setCwd(next);
    try {
      window.localStorage.setItem(CWD_KEY, next);
    } catch {
      /* 无 localStorage 时忽略 */
    }
    setToken((value) => value + 1);
  };

  const ui = caps?.ui ?? { skills: true, experts: true, connectors: true };
  const counts = status?.counts;

  // 页签不带数字角标（只保留图标 + 文案）。
  const tabs: Array<TabItem<Tab>> = [
    {
      key: 'plugins',
      label: t('tab.plugins'),
      icon: <IconPlugin size={16} />,
    },
    {
      key: 'skills',
      label: t('tab.skills'),
      icon: <IconSkill size={16} />,
    },
    {
      key: 'connectors',
      label: t('tab.connectors'),
      icon: <IconConnector size={16} />,
    },
    {
      key: 'experts',
      label: t('tab.experts'),
      icon: <IconExpert size={16} />,
    },
  ];

  /** 我的XX 按钮文案 + 计数。 */
  const mineLabel = (kind: Tab): string => {
    const count =
      kind === 'experts'
        ? counts?.myExperts
        : kind === 'skills'
          ? counts?.skills
          : kind === 'connectors'
            ? counts?.connectors
            : counts?.plugins;
    return count === undefined ? t(`mine.${kind}`) : `${t(`mine.${kind}`)} ${String(count)}`;
  };

  const switchTab = (next: Tab): void => {
    setTab(next);
    setQuery('');
    setAddOpen(false);
    setPage('plaza');
  };

  return (
    <section className="adk-root">
      <header className="adk-top">
        {page === 'mine' ? (
          // 子页面顶栏：返回 + 标题 + 搜索
          <>
            <button
              type="button"
              className="adk-back"
              title={t('panel.back')}
              onClick={() => setPage('plaza')}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9.5 3.5 5 8l4.5 4.5" />
              </svg>
              {t('panel.back')}
            </button>
            <span className="adk-page-title">
              {tab === 'experts'
                ? t('mine.experts')
                : tab === 'skills'
                  ? t('mine.skills')
                  : tab === 'connectors'
                    ? t('mine.connectors')
                    : t('mine.plugins')}
            </span>
          </>
        ) : (
          <PillTabs
            items={tabs}
            value={tab}
            onChange={(next) => {
              setTab(next);
              setQuery('');
              setAddOpen(false);
            }}
          />
        )}
        <span className="adk-top-right">
          <SearchPill
            value={query}
            onChange={setQuery}
            placeholder={
              tab === 'skills'
                ? t('panel.searchSkills')
                : tab === 'experts'
                  ? t('panel.searchExperts')
                  : tab === 'connectors'
                    ? t('panel.searchConnectors')
                    : t('panel.searchPlugins')
            }
          />
          {/* 「我的XX」入口：进入本地已安装内容子页面。 */}
          {page === 'plaza' ? (
            <ActionButton onClick={() => setPage('mine')} title={mineLabel(tab)}>
              {mineLabel(tab)}
            </ActionButton>
          ) : null}
          {/* 新建/添加按钮在「我的XX」子页面里。 */}
          {page === 'mine' && tab === 'skills' ? (
            <ActionButton primary onClick={() => setAddOpen(true)}>
              {t('skills.add')}
            </ActionButton>
          ) : null}
          {page === 'mine' && tab === 'experts' ? (
            <ActionButton primary onClick={() => setAddOpen(true)}>
              {t('experts.create')}
            </ActionButton>
          ) : null}
          {page === 'mine' && tab === 'connectors' ? (
            <ActionButton primary onClick={() => setAddOpen(true)}>
              {t('connectors.create')}
            </ActionButton>
          ) : null}
          {/* 广场态：顶栏刷新按钮位置换成「提交」下拉（提交技能/专家/MCP/插件，
              四个页签共有）。 */}
          {page === 'plaza' && caps?.ui?.plaza !== false ? (
            <SubmitMenu
              kind={
                tab === 'skills'
                  ? 'skill'
                  : tab === 'experts'
                    ? 'expert'
                    : tab === 'plugins'
                      ? 'plugin'
                      : 'connector'
              }
              t={t}
              onPick={(entry) => setSubmitKind(entry)}
            />
          ) : null}
          {/* 「我的」子页面保留面板刷新。 */}
          {page === 'mine' ? (
            <ActionButton onClick={() => setToken((value) => value + 1)} title={t('panel.refresh')}>
              <IconRefresh size={14} />
            </ActionButton>
          ) : null}
        </span>
      </header>

      {submitKind === undefined ? null : (
        <SubmitModal
          kind={submitKind}
          t={t}
          onClose={() => setSubmitKind(undefined)}
          onSubmitted={() => {
            setToken((value) => value + 1);
          }}
        />
      )}

      {error === undefined ? null : (
        <Banner tone="error">
          {error}
          <button type="button" className="adk-action" style={{ marginLeft: 8 }} onClick={() => void load()}>
            {t('panel.retry')}
          </button>
        </Banner>
      )}
      {(caps?.notes ?? []).length === 0 ? null : <Banner>{(caps?.notes ?? []).join('\n')}</Banner>}

      <div className="adk-body">
        {page === 'plaza' ? (
          <>
            {tab === 'skills' ? (
              ui.skills ? (
                <SkillsTab key={`skills-plaza-${String(token)}`} t={t} query={query} />
              ) : (
                <div className="adk-empty">{t('panel.disabledSkills')}</div>
              )
            ) : null}
            {tab === 'experts' ? (
              ui.experts ? (
                <ExpertsTab key={`experts-plaza-${String(token)}`} t={t} query={query} />
              ) : (
                <div className="adk-empty">{t('panel.disabledExperts')}</div>
              )
            ) : null}
            {tab === 'connectors' ? (
              ui.connectors ? (
                <ConnectorsTab key={`connectors-plaza-${String(token)}`} t={t} query={query} />
              ) : (
                <div className="adk-empty">{t('panel.disabledConnectors')}</div>
              )
            ) : null}
            {tab === 'plugins' ? (
              ui.plugins !== false ? (
                <PluginsTab key={`plugins-plaza-${String(token)}`} t={t} query={query} />
              ) : (
                <div className="adk-empty">{t('panel.disabledPlugins')}</div>
              )
            ) : null}
          </>
        ) : (
          <>
            {tab === 'skills' ? (
              ui.skills ? (
                <MySkillsPage
                  key={`skills-mine-${String(token)}`}
                  t={t}
                  ctx={ctx}
                  query={query}
                  addOpen={addOpen}
                  onCloseAdd={() => setAddOpen(false)}
                  {...(cwd === '' ? {} : { cwd })}
                />
              ) : (
                <div className="adk-empty">{t('panel.disabledSkills')}</div>
              )
            ) : null}
            {tab === 'experts' ? (
              ui.experts ? (
                <MyExpertsPage
                  key={`experts-mine-${String(token)}`}
                  t={t}
                  query={query}
                  addOpen={addOpen}
                  onCloseAdd={() => setAddOpen(false)}
                />
              ) : (
                <div className="adk-empty">{t('panel.disabledExperts')}</div>
              )
            ) : null}
            {tab === 'connectors' ? (
              ui.connectors ? (
                <MyConnectorsPage
                  key={`connectors-mine-${String(token)}`}
                  t={t}
                  query={query}
                  addOpen={addOpen}
                  onCloseAdd={() => setAddOpen(false)}
                />
              ) : (
                <div className="adk-empty">{t('panel.disabledConnectors')}</div>
              )
            ) : null}
            {tab === 'plugins' ? (
              ui.plugins !== false ? (
                <MyPluginsPage key={`plugins-mine-${String(token)}`} t={t} query={query} />
              ) : (
                <div className="adk-empty">{t('panel.disabledPlugins')}</div>
              )
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
