/**
 * 插件页签：拆成两个视图。
 *
 *   - PluginsTab（默认）：插件广场（PlazaView，kind='plugin'，
 *     数据来自 awesome-dsh-plugin 目录）。
 *   - MyPluginsPage：**自己装的**插件 —— 只列 profile 的 dependencies
 *     （宿主用 `mine` 标出来，App 自带的 bundle 不列）。卡片与广场同形：
 *     点卡片打开详情弹窗，启用/禁用、卸载都在弹窗里操作。
 *
 * 与技能/连接器的区别：插件行活在宿主进程里，启停写的是 profile 的
 * cordis.patch.yml，多数变更要重启 App 才生效，所以写操作结果里的
 * warnings / application 必须原样反馈给用户，不能只当作成功处理。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from './api.js';
import {
  ActionButton,
  Banner,
  CardMenu,
  Empty,
  Field,
  Loading,
  Modal,
  SectionHead,
  Tag,
  useNotice,
  type T,
} from './components.js';
import { PlazaView } from './plaza.js';
import type { PluginBundleRow, PluginChangeResult, PluginEntryRow, PluginsView } from '../types.js';

/** 插件广场（默认视图）。 */
export function PluginsTab({ t, query }: { t: T; query: string }) {
  return <PlazaView kind="plugin" t={t} query={query} onChanged={() => undefined} />;
}

/** PluginChangeResult.application 的已知取值（未知值原样展示，不臆造宿主行为）。 */
const APPLICATIONS: readonly string[] = ['applied', 'restart-required', 'overridden', 'failed', 'cancelled'];

/** 写操作结果 → 一行通知：warnings 与「需重启」都要显式说出来。 */
function describeResult(t: T, result: PluginChangeResult, subject: string): string {
  const parts = [
    result.changed ? `${t('plugins.changed')}: ${subject}` : `${t('plugins.unchanged')}: ${subject}`,
  ];
  if (result.warnings.length > 0) parts.push(`${t('plugins.warnings')}: ${result.warnings.join('；')}`);
  if (result.application === 'restart-required') {
    parts.push(t('plugins.restartRequired'));
  } else if (result.application !== 'applied' && result.application !== '') {
    // 未知取值原样展示，避免把宿主的自定义状态翻译成错误的文案。
    parts.push(
      APPLICATIONS.includes(result.application)
        ? t(`plugins.application.${result.application}`)
        : result.application,
    );
  }
  return parts.join(' · ');
}

/** 我的插件页面（顶栏「我的插件」进入）：只列自己装的插件。 */
export function MyPluginsPage({ t, query }: { t: T; query: string }) {
  const [data, setData] = useState<PluginsView | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  // 通知 3 秒自动消失。
  const [notice, setNotice] = useNotice();
  /** 详情弹窗里那一项（undefined = 关闭）。 */
  const [detail, setDetail] = useState<PluginBundleRow | undefined>();

  const load = useCallback(async (): Promise<PluginsView | undefined> => {
    setLoading(true);
    setError(undefined);
    try {
      const view = await api.plugins();
      setData(view);
      return view;
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : String(failure));
      return undefined;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** 宿主没有 pluginManager 时整页只读（与连接器页的 available 降级同形）。 */
  const readonlyDeployment = data?.available === false;
  /** 这一项为什么不能操作（undefined = 可操作）。 */
  const lockedReason = (readOnlyReason: string | undefined): string | undefined =>
    readOnlyReason ?? (readonlyDeployment ? t('plugins.unavailable') : undefined);
  /** 只读原因的人话版（宿主给的是 management-required / unaddressable 这类枚举）。 */
  const readOnlyText = (reason: string): string => {
    const text = t(`plugins.readOnly.${reason}`);
    return text === `plugins.readOnly.${reason}` ? reason : text;
  };

  /** 只列**自己装的**：profile 的 dependencies（宿主用 mine 标出来）。 */
  const mine = useMemo(() => (data?.bundles ?? []).filter((bundle) => bundle.mine === true), [data]);

  const needle = query.trim().toLowerCase();
  const visible = useMemo(() => {
    if (needle === '') return mine;
    return mine.filter((bundle) =>
      [bundle.name, bundle.title ?? '', bundle.description, bundle.spec ?? ''].some((field) =>
        field.toLowerCase().includes(needle),
      ),
    );
  }, [mine, needle]);

  /**
   * 统一写操作：置忙 → 执行 → 反馈结果 → 重新取数。
   *
   * 重新取数后把弹窗里的那一项同步成新数据（否则弹窗还显示旧状态）。
   */
  const run = async (action: () => Promise<PluginChangeResult>, subject: string): Promise<void> => {
    setBusy(true);
    setError(undefined);
    try {
      const result = await action();
      if (result.error !== undefined && result.error !== '') setError(result.error);
      setNotice(describeResult(t, result, subject));
      const view = await load();
      if (view === undefined || detail === undefined) return;
      setDetail(view.bundles.find((bundle) => bundle.name === detail.name));
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  /** 启用 / 禁用：选中或取消该插件在 profile 里的 bundle 层。 */
  const toggleEnabled = async (bundle: PluginBundleRow): Promise<void> => {
    await run(
      () => api.pluginBundleSetEnabled(bundle.name, !bundle.enabled).then((r) => r.result),
      bundle.title ?? bundle.name,
    );
  };

  /** 卸载：从 profile 清单移除依赖并跑 pnpm；成功后关掉弹窗（这一项没了）。 */
  const uninstall = async (bundle: PluginBundleRow): Promise<void> => {
    if (!window.confirm(`${t('plugins.uninstall')}: ${bundle.name}?\n${t('plugins.confirmRemove')}`)) return;
    const name = bundle.name;
    setBusy(true);
    setError(undefined);
    try {
      const result = await api.pluginRemove(name).then((r) => r.result);
      if (result.error !== undefined && result.error !== '') setError(result.error);
      setNotice(describeResult(t, result, bundle.title ?? name));
      setDetail(undefined);
      await load();
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  /** 该插件声明的插件行（宿主 listPlugins 的结果；匹配不到保留 id）。 */
  const findRow = (entryId: string): PluginEntryRow | undefined =>
    (data?.rows ?? []).find((row) => row.entryId === entryId);
  const rowsOf = (bundle: PluginBundleRow): Array<PluginEntryRow | undefined> =>
    bundle.rows.map((id) => findRow(id));

  /** 卡片：与广场同形 —— 整块可点开详情，⋯ 菜单给同样的几个动作。 */
  const renderCard = (bundle: PluginBundleRow) => {
    const locked = lockedReason(bundle.readOnlyReason);
    const title = bundle.title ?? bundle.name;
    return (
      <div
        className="adk-card"
        key={bundle.name}
        data-broken={bundle.error === undefined ? 'false' : 'true'}
      >
        <div className="adk-card-head">
          <button type="button" className="adk-card-hit" title={title} onClick={() => setDetail(bundle)}>
            <span className="adk-card-hitblock">
              <span className="adk-card-title-line">
                <span className="adk-card-title-text">{title}</span>
                <Tag tone={bundle.enabled ? 'ok' : undefined}>
                  {bundle.enabled ? t('plugins.rowEnabled') : t('plugins.rowDisabled')}
                </Tag>
              </span>
              <span className="adk-card-meta">
                <span className="adk-mono">{bundle.name}</span>
                {bundle.version === undefined || bundle.version === '' ? null : (
                  <span>{`v${bundle.version}`}</span>
                )}
              </span>
            </span>
          </button>
          <CardMenu
            label={t('action.more')}
            items={[
              { label: t('plugins.detail'), onSelect: () => setDetail(bundle) },
              {
                label: bundle.enabled ? t('plugins.disable') : t('plugins.enable'),
                disabled: busy || locked !== undefined,
                onSelect: () => void toggleEnabled(bundle),
              },
              {
                label: t('plugins.uninstall'),
                danger: true,
                disabled: busy || locked !== undefined,
                onSelect: () => void uninstall(bundle),
              },
            ]}
          />
        </div>
        {bundle.description === '' ? null : <div className="adk-card-desc">{bundle.description}</div>}
        {bundle.error === undefined ? null : <Banner tone="error">{bundle.error}</Banner>}
        {locked === undefined ? null : <div className="adk-hint">{readOnlyText(locked)}</div>}
      </div>
    );
  };

  /** 详情弹窗（与广场详情弹窗同形）：启用/禁用、卸载都放在 footer。 */
  const renderDetail = (bundle: PluginBundleRow) => {
    const locked = lockedReason(bundle.readOnlyReason);
    const declared = rowsOf(bundle);
    return (
      <Modal
        title={`${t('plugins.detailTitle')} · ${bundle.title ?? bundle.name}`}
        subtitle={bundle.name}
        onClose={() => setDetail(undefined)}
        t={t}
        footer={
          <>
            <ActionButton
              primary
              disabled={busy || locked !== undefined}
              title={locked === undefined ? undefined : readOnlyText(locked)}
              onClick={() => void toggleEnabled(bundle)}
            >
              {bundle.enabled ? t('plugins.disable') : t('plugins.enable')}
            </ActionButton>
            <ActionButton
              danger
              disabled={busy || locked !== undefined}
              title={locked === undefined ? undefined : readOnlyText(locked)}
              onClick={() => void uninstall(bundle)}
            >
              {t('plugins.uninstall')}
            </ActionButton>
          </>
        }
      >
        <div className="adk-detail-meta">
          <Tag tone={bundle.enabled ? 'ok' : undefined}>
            {bundle.enabled ? t('plugins.rowEnabled') : t('plugins.rowDisabled')}
          </Tag>
          {bundle.version === undefined || bundle.version === '' ? null : (
            <span>{`v${bundle.version}`}</span>
          )}
          <span>{locked === undefined ? t('plugins.removable') : t('plugins.readOnly')}</span>
        </div>

        <Field label={t('plugins.spec')}>
          <div className="adk-mono">{bundle.spec ?? bundle.name}</div>
        </Field>

        {bundle.description === '' ? null : (
          <Field label={t('plaza.description')}>
            <div className="adk-detail-desc">{bundle.description}</div>
          </Field>
        )}

        {bundle.error === undefined ? null : <Banner tone="error">{bundle.error}</Banner>}
        {locked === undefined ? null : <Banner>{readOnlyText(locked)}</Banner>}

        <Field
          label={t('plugins.rows')}
          hint={declared.length === 0 ? t('plugins.noRows') : t('plugins.rowsHint')}
        >
          {declared.length === 0 ? null : (
            <div className="adk-rows">
              {declared.map((row, index) =>
                // 宿主声明了行但 listPlugins 里没有（例如加载失败）：保留 id，别静默丢掉。
                row === undefined ? (
                  <div className="adk-row" key={`missing-${String(index)}`}>
                    <span className="adk-mono">{`${bundle.rows[index] ?? ''} · ${t('plugins.rowMissing')}`}</span>
                  </div>
                ) : (
                  <div className="adk-row" key={row.entryId}>
                    <div className="adk-row-head">
                      <span className="adk-row-title">{row.title === '' ? row.moduleName : row.title}</span>
                      <span className="adk-tags">
                        <Tag tone={row.enabled ? 'ok' : undefined}>
                          {row.enabled ? t('plugins.rowEnabled') : t('plugins.rowDisabled')}
                        </Tag>
                      </span>
                    </div>
                    <div className="adk-hint">{row.moduleName}</div>
                  </div>
                ),
              )}
            </div>
          )}
        </Field>

        {bundle.overrides.length === 0 ? null : (
          <Field label={t('plugins.overrides')} hint={t('plugins.overridesHint')}>
            <div className="adk-mono">{bundle.overrides.join(', ')}</div>
          </Field>
        )}
      </Modal>
    );
  };

  return (
    <div>
      {readonlyDeployment ? <Banner>{t('plugins.unavailable')}</Banner> : null}
      {(data?.notes ?? []).length === 0 ? null : <Banner>{(data?.notes ?? []).join('\n')}</Banner>}
      {error === undefined ? null : <Banner tone="error">{error}</Banner>}
      {notice === undefined ? null : <Banner>{notice}</Banner>}
      {(data?.pendingBuilds ?? []).length === 0 ? null : (
        <Banner tone="error">
          {`${t('plugins.pendingBuilds')}: ${(data?.pendingBuilds ?? []).join(', ')}`}
        </Banner>
      )}

      {loading ? (
        <Loading t={t} />
      ) : (
        <div className="adk-section">
          <SectionHead title={t('plugins.title')} count={visible.length} />
          {data === undefined ? null : (
            <div className="adk-hint" style={{ marginBottom: 12 }}>
              {`${t('plugins.mineHint')} · ${t('plugins.profile')}: ${data.profile.name} · ${t('plugins.dir')}: ${data.profile.dir}`}
            </div>
          )}
          {visible.length === 0 ? (
            <Empty t={t} />
          ) : (
            <div className="adk-grid">{visible.map((bundle) => renderCard(bundle))}</div>
          )}
        </div>
      )}

      {detail === undefined ? null : renderDetail(detail)}
    </div>
  );
}
