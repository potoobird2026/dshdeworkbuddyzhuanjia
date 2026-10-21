/**
 * 广场视图（技能 / 专家 / 连接器 / 插件共用）。
 *
 * 数据来自宿主的 `/catalog*`：宿主侧抓公开目录（GitHub 技能库、dsh-market 预设、
 * 官方 MCP Registry、自建目录、awesome-dsh-plugin），这里只负责展示、筛选与触发安装。
 *
 * 安装一律经过确认弹窗——四类内容分别会落成文件、宿主插件组合、MCP 进程、
 * profile 插件包，确认框里展示的就是「将要发生什么」（文件清单 / 插件行 /
 * 连接参数 / 安装规格与红线能力）。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  api,
  ApiError,
  type CatalogInstallResult,
  type CatalogItem,
  type CatalogItemResponse,
  type CatalogPageResponse,
  type CatalogSubmitCandidate,
  type CatalogSubmitResult,
} from './api.js';
import {
  ActionButton,
  Banner,
  CardMenu,
  useNotice,
  Chips,
  Empty,
  Field,
  Loading,
  Modal,
  SectionHead,
  SortSegments,
  Tag,
  Tile,
  toneOf,
  type T,
} from './components.js';
import { IconConnector, IconDownload, IconExpert, IconFavorite, IconPlugin, IconPlus, IconRefresh, IconSkill } from './icons.js';

/** 广场支持的种类（含插件包）。 */
export type PlazaKind = 'skill' | 'expert' | 'connector' | 'plugin';

/** 可提交到广场的种类（与广场种类一致：四类都能提交）。 */
export type SubmitKind = PlazaKind;

/** 属性。 */
export interface PlazaViewProps {
  kind: PlazaKind;
  t: T;
  /** 顶栏搜索词。 */
  query: string;
  /** 安装/卸载成功后的回调（父级刷新本地视图）。 */
  onChanged: () => void;
}

/** 提交弹窗（提交本地条目到广场）。 */
export function SubmitModal({
  kind,
  t,
  onClose,
  onSubmitted,
}: {
  kind: SubmitKind;
  t: T;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [candidates, setCandidates] = useState<CatalogSubmitCandidate[] | undefined>();
  const [picked, setPicked] = useState<string | undefined>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [done, setDone] = useState<CatalogSubmitResult | undefined>();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const response = await api.catalogSubmitCandidates(kind);
        if (!alive) return;
        setCandidates(response.candidates);
      } catch (failure) {
        if (!alive) return;
        setError(failure instanceof ApiError ? failure.message : String(failure));
      }
    })();
    return () => {
      alive = false;
    };
  }, [kind]);

  const pickedCandidate = candidates?.find((entry) => entry.id === picked);

  const doSubmit = async (): Promise<void> => {
    if (picked === undefined) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await api.catalogSubmit({
        kind,
        id: picked,
        ...(name.trim() === '' ? {} : { name: name.trim() }),
        ...(description.trim() === '' ? {} : { description: description.trim() }),
        ...(tags.trim() === '' ? {} : { tags: tags.split(/[,，]/).map((tag) => tag.trim()).filter((tag) => tag !== '') }),
      });
      setDone(result);
      onSubmitted();
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`${t('plaza.submit.title')} · ${t(`plaza.submit.${kind}`)}`}
      onClose={onClose}
      t={t}
      footer={
        done === undefined ? (
          <ActionButton primary disabled={busy || picked === undefined} onClick={() => void doSubmit()}>
            {t('plaza.submit.go')}
          </ActionButton>
        ) : (
          <ActionButton primary onClick={onClose}>
            {t('action.close')}
          </ActionButton>
        )
      }
    >
      {error === undefined ? null : <Banner tone="error">{error}</Banner>}
      {done === undefined ? null : (
        <>
          <Banner tone="info">
            {`${t('plaza.submit.done')}: ${String(done.item['name'] ?? done.item['id'] ?? '')}`}
          </Banner>
          <Field label={t('plaza.submit.hintTitle')}>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {done.hints.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          </Field>
        </>
      )}
      {done !== undefined ? null : (
        <>
          <Field label={t('plaza.submit.pick')} hint={t(`plaza.submit.pickHint.${kind}`)}>
            {candidates === undefined ? (
              <div className="adk-pre">{t('panel.loading')}</div>
            ) : candidates.length === 0 ? (
              <div className="adk-pre">{t(`plaza.submit.empty.${kind}`)}</div>
            ) : (
              <select
                className="adk-select"
                value={picked ?? ''}
                onChange={(event) => {
                  setPicked(event.target.value === '' ? undefined : event.target.value);
                  const candidate = candidates.find((entry) => entry.id === event.target.value);
                  setName(candidate?.name ?? '');
                  setDescription(candidate?.description ?? '');
                }}
              >
                <option value="">{t('plaza.submit.pick')}</option>
                {candidates.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                    {entry.extra === undefined ? '' : ` · ${entry.extra}`}
                  </option>
                ))}
              </select>
            )}
          </Field>
          {pickedCandidate === undefined ? null : (
            <>
              <Field label={t('plaza.submit.name')}>
                <input className="adk-input" value={name} onChange={(event) => setName(event.target.value)} />
              </Field>
              <Field label={t('plaza.submit.description')}>
                <textarea
                  className="adk-textarea"
                  rows={2}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </Field>
              <Field label={t('plaza.submit.tags')} hint={t('plaza.submit.tagsHint')}>
                <input className="adk-input" value={tags} onChange={(event) => setTags(event.target.value)} />
              </Field>
            </>
          )}
        </>
      )}
    </Modal>
  );
}

/** 提交下拉菜单（顶栏 / 广场共用）：展开后选择要提交的种类。 */
export function SubmitMenu({
  kind,
  t,
  onPick,
}: {
  /** 当前页签对应的种类（排下拉第一位）。 */
  kind: SubmitKind;
  t: T;
  onPick: (next: SubmitKind) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocumentClick = (event: MouseEvent): void => {
      if (ref.current !== null && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocumentClick);
    return () => document.removeEventListener('mousedown', onDocumentClick);
  }, [open]);

  const order: SubmitKind[] = [kind, ...(KINDS.filter((entry) => entry !== kind))];
  return (
    <div className="adk-menu-wrap" ref={ref}>
      <button
        type="button"
        className="adk-action"
        data-primary="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <IconPlus size={14} />
        {t('plaza.submit.menu')}
        <span className="adk-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div className="adk-menu adk-menu-compact" role="menu">
          {order.map((entry) => (
            <button
              key={entry}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onPick(entry);
              }}
            >
              <span className="adk-menu-icon" aria-hidden="true">
                {entry === 'skill' ? (
                  <IconSkill size={14} />
                ) : entry === 'expert' ? (
                  <IconExpert size={14} />
                ) : entry === 'plugin' ? (
                  <IconPlugin size={14} />
                ) : (
                  <IconConnector size={14} />
                )}
              </span>
              {t(`plaza.submit.button.${entry}`)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** 提交支持的种类（下拉排序用；四个页签一致）。 */
const KINDS: SubmitKind[] = ['skill', 'expert', 'connector', 'plugin'];

/** 计数展示（12345 → 1.2万；k/m 单位交给 locale 走中文）。 */
function formatCount(value: number): string {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1).replace(/\.0$/, '')}亿`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(1).replace(/\.0$/, '')}万`;
  return String(value);
}

/** 广场视图。 */
export function PlazaView({ kind, t, query, onChanged }: PlazaViewProps) {
  const [data, setData] = useState<CatalogPageResponse | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  // 通知 3 秒自动消失。
  const [notice, setNotice] = useNotice();
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<'default' | 'hot' | 'new'>('default');
  /** 标准目录分类（宿主侧统一归一）。 */
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<CatalogItemResponse | undefined>();
  const [installing, setInstalling] = useState<CatalogItem | undefined>();
  const [enableAfter, setEnableAfter] = useState(false);
  const [envValues, setEnvValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [cursor, setCursor] = useState<string | undefined>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setData(
        await api.catalog({
          kind,
          ...(category === 'all' ? {} : { category }),
          ...(query.trim() === '' ? {} : { q: query.trim() }),
          sort,
          ...(cursor === undefined ? {} : { cursor }),
        }),
      );
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : String(failure));
    } finally {
      setLoading(false);
    }
  }, [kind, query, category, sort, cursor]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = data?.items ?? [];

  // 标准目录分类（切换 kind 时重拉；失败时退化为当前页数据里出现的分类）。
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const response = await api.catalogCategories(kind);
        if (alive) setCategoryOptions(response.categories);
      } catch {
        if (alive) setCategoryOptions([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [kind]);

  const categories = categoryOptions;

  /** 安装（带确认）。 */
  const doInstall = async (): Promise<void> => {
    if (installing === undefined) return;
    setBusy(true);
    setError(undefined);
    try {
      const result: CatalogInstallResult = await api.catalogInstall({
        source: installing.sourceId,
        id: installing.id,
        ...(installing.kind === 'skill' ? { enable: enableAfter } : {}),
        ...(Object.keys(envValues).length === 0 ? {} : { env: envValues }),
      });
      const extra = result.warnings.length === 0 ? '' : `（${result.warnings.join('；')}）`;
      setNotice(`${t('plaza.installed')}: ${installing.name}${extra}`);
      setInstalling(undefined);
      setDetail(undefined);
      setEnvValues({});
      onChanged();
      await load();
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  /** 卸载。 */
  const doUninstall = async (item: CatalogItem): Promise<void> => {
    const key = item.installed?.key;
    if (key === undefined) return;
    if (!window.confirm(`${t('plaza.uninstall')}: ${item.name}?`)) return;
    setBusy(true);
    setError(undefined);
    try {
      await api.catalogUninstall(item.kind, key);
      setNotice(`${t('plaza.uninstalled')}: ${item.name}`);
      onChanged();
      await load();
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  /** 打开详情（同时作为安装确认）。 */
  const openDetail = async (item: CatalogItem): Promise<void> => {
    setBusy(true);
    setError(undefined);
    try {
      const response = await api.catalogItem(item.sourceId, item.id);
      setDetail(response);
      setInstalling(item);
      setEnableAfter(false);
      setEnvValues(
        Object.fromEntries(
          (item.install.kind === 'connector' ? (item.install.envRequired ?? []) : []).map((name) => [name, '']),
        ),
      );
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  /** 插件安装规格：只有 plugin 条目才有（其他条目/不支持时为 undefined）。 */
  const pluginInstall = installing?.install.kind === 'plugin' ? installing.install : undefined;

  return (
    <div>
      {error === undefined ? null : (
        <Banner tone="error">
          {error}
          <button type="button" className="adk-action" style={{ marginLeft: 8 }} onClick={() => void load()}>
            {t('panel.retry')}
          </button>
        </Banner>
      )}
      {notice === undefined ? null : <Banner>{notice}</Banner>}
      {(data?.sources ?? []).filter((entry) => entry.ok === false).length === 0 ? null : (
        <Banner>
          {(data?.sources ?? [])
            .filter((entry) => entry.ok === false)
            .map((entry) => `${entry.label}: ${entry.lastError ?? ''}`)
            .join('\n')}
        </Banner>
      )}

      <SectionHead title={t('plaza.title')} count={data?.total ?? items.length}>
        <SortSegments
          items={[
            { key: 'default', label: t('plaza.sort.default') },
            { key: 'hot', label: t('plaza.sort.hot') },
            { key: 'new', label: t('plaza.sort.new') },
          ]}
          value={sort}
          onChange={(next) => {
            setCursor(undefined);
            setPage(0);
            setSort(next);
          }}
        />
        <ActionButton onClick={() => void load()}>
          <IconRefresh size={14} />
          {t('panel.refresh')}
        </ActionButton>
      </SectionHead>

      {/* 目录分类筛选：标准分类全量展示（不看是否有数据）；MCP 目前单一默认分类，只显示「全部」。 */}
      {categories.length === 0 && kind !== 'connector' ? null : (
        <Chips
          items={
            kind === 'connector'
              ? [{ key: 'all', label: t('skills.filter.all') }]
              : [{ key: 'all', label: t('skills.filter.all') }, ...categories.map((key) => ({ key, label: key }))]
          }
          value={category}
          onChange={(next) => {
            setCursor(undefined);
            setPage(0);
            setCategory(next);
          }}
        />
      )}

      {loading ? (
        <Loading t={t} />
      ) : items.length === 0 ? (
        <Empty t={t} />
      ) : (
        <div className="adk-grid">
          {items.map((item) => (
            <div className="adk-card" key={`${item.sourceId}:${item.id}`}>
              <div className="adk-card-head">
                <button
                  type="button"
                  className="adk-card-hit"
                  title={item.name}
                  onClick={() => void openDetail(item)}
                >
                  <Tile tone={toneOf(item.id)}>{item.name.slice(0, 1).toUpperCase()}</Tile>
                  <span className="adk-card-hitblock">
                    <span className="adk-card-title-line">
                      <span className="adk-card-title-text">{item.name}</span>
                      {item.trust?.official === true ? <Tag tone="accent">{t('plaza.official')}</Tag> : null}
                    </span>
                    <span className="adk-card-meta">
                      {item.stats?.downloads === undefined ? null : (
                        <span title={t('plaza.stats.downloads')}>
                          <IconDownload size={11} /> {formatCount(item.stats.downloads)}
                        </span>
                      )}
                      {item.stats?.favorites === undefined ? null : (
                        <span title={t('plaza.stats.favorites')}>
                          <IconFavorite size={11} /> {formatCount(item.stats.favorites)}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
                <CardMenu
                  label={t('action.more')}
                  items={[
                    { label: t('plaza.detail'), onSelect: () => void openDetail(item) },
                    ...(item.installed === undefined
                      ? []
                      : [{ label: t('plaza.uninstall'), onSelect: () => void doUninstall(item) }]),
                    ...(item.homepage === undefined
                      ? []
                      : [{ label: t('plaza.homepage'), onSelect: () => window.open(item.homepage, '_blank') }]),
                  ]}
                />
              </div>
              <div className="adk-card-desc" data-lines="3">
                {item.description === '' ? item.id : item.description}
              </div>
              <div className="adk-tags">
                {item.category === undefined ? null : <Tag>{item.category}</Tag>}
                {item.install.kind === 'unsupported' ? <Tag tone="error">{t('plaza.unsupported')}</Tag> : null}
                {item.installed === undefined ? null : <Tag tone="ok">{t('plaza.installedBadge')}</Tag>}
                {item.tags.slice(0, 2).map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {data?.nextCursor === undefined ? null : (
        <div className="adk-inline" style={{ justifyContent: 'center', marginTop: 14 }}>
          <ActionButton
            onClick={() => {
              setCursor(data.nextCursor);
              setPage((value) => value + 1);
            }}
          >
            {`${t('plaza.more')} (#${String(page + 2)})`}
          </ActionButton>
        </div>
      )}

      {detail === undefined || installing === undefined ? null : (
        <Modal
          title={`${t('plaza.confirmTitle')} · ${installing.name}`}
          subtitle={t(`plaza.risk.${installing.kind}`)}
          onClose={() => {
            setDetail(undefined);
            setInstalling(undefined);
          }}
          t={t}
          footer={
            <ActionButton primary disabled={busy} onClick={() => void doInstall()}>
              {installing.installed === undefined ? t('plaza.install') : t('plaza.reinstall')}
            </ActionButton>
          }
        >
          {/* 发布人 / 版本等完整信息只在详情里展示。 */}
          <div className="adk-detail-meta">
            {installing.author === undefined || installing.author === '' ? null : (
              <span title={t('plaza.author')}>
                {t('plaza.author')}: {installing.author}
              </span>
            )}
            {installing.version === undefined || installing.version === '' ? null : (
              <span title={t('plaza.version')}>
                {t('plaza.version')}: {installing.version}
              </span>
            )}
            {installing.stats?.stars === undefined ? null : (
              <span title={t('plaza.stats.stars')}>★ {formatCount(installing.stats.stars)}</span>
            )}
            {installing.stats?.downloads === undefined ? null : (
              <span title={t('plaza.stats.downloads')}>
                <IconDownload size={11} /> {formatCount(installing.stats.downloads)}
              </span>
            )}
            {installing.stats?.favorites === undefined ? null : (
              <span title={t('plaza.stats.favorites')}>
                <IconFavorite size={11} /> {formatCount(installing.stats.favorites)}
              </span>
            )}
          </div>

          {installing.description === '' ? undefined : (
            <Field label={t('plaza.description')}>
              <div className="adk-detail-desc">{installing.description}</div>
            </Field>
          )}

          {installing.kind === 'skill' ? (
            <>
              <Field label={t('plaza.files')} hint={`${String(detail.files?.length ?? 0)} ${t('plaza.fileCount')}`}>
                <div className="adk-pre" style={{ maxHeight: 120 }}>
                  {(detail.files ?? []).map((file) => file.path).join('\n')}
                </div>
              </Field>
              {detail.preview === undefined ? null : (
                <Field label="SKILL.md">
                  <div className="adk-pre" style={{ maxHeight: 180 }}>
                    {detail.preview}
                  </div>
                </Field>
              )}
              <label className="adk-check">
                <input
                  type="checkbox"
                  checked={enableAfter}
                  onChange={(event) => setEnableAfter(event.target.checked)}
                />
                {t('plaza.enableAfter')}
              </label>
            </>
          ) : null}

          {installing.kind === 'expert' ? (
            <>
              {(installing.install.kind === 'expert' ? (installing.install.pluginRows ?? []) : []).length === 0 ? null : (
                <Field label={t('plaza.pluginRows')}>
                  <div className="adk-pre" style={{ maxHeight: 120 }}>
                    {(installing.install.kind === 'expert' ? (installing.install.pluginRows ?? []) : []).join('\n')}
                  </div>
                </Field>
              )}
              <Field label={t('plaza.composition')}>
                <div className="adk-pre" style={{ maxHeight: 220 }}>
                  {detail.compositionPreview ?? ''}
                </div>
              </Field>
            </>
          ) : null}

          {installing.kind === 'connector' ? (
            <>
              <Field label={t('connectors.transport')}>
                <div className="adk-mono">
                  {installing.install.kind === 'connector' ? installing.install.transport : ''}
                </div>
              </Field>
              {installing.install.kind === 'connector' && installing.install.url !== undefined ? (
                <Field label="URL">
                  <div className="adk-mono">{installing.install.url}</div>
                </Field>
              ) : null}
              {installing.install.kind === 'connector' && installing.install.command !== undefined ? (
                <Field label={t('connectors.command')}>
                  <div className="adk-mono">{installing.install.command}</div>
                </Field>
              ) : null}
              {(installing.install.kind === 'connector' ? (installing.install.envRequired ?? []) : []).map((name) => (
                <Field key={name} label={name} hint={t('plaza.secretHint')}>
                  <input
                    className="adk-input"
                    value={envValues[name] ?? ''}
                    onChange={(event) => setEnvValues({ ...envValues, [name]: event.target.value })}
                  />
                </Field>
              ))}
            </>
          ) : null}

          {/* 插件包：展示「将要发生什么」——安装规格 / 上游命令 / 能力 / 红线。 */}
          {installing.kind === 'plugin' ? (
            pluginInstall === undefined ? (
              <Banner tone="error">
                {`${t('plaza.unsupported')}: ${installing.install.kind === 'unsupported' ? installing.install.reason : ''}`}
              </Banner>
            ) : (
              <>
                <Field label={t('plaza.pluginPackage')}>
                  <div className="adk-mono">{pluginInstall.package}</div>
                </Field>
                {(pluginInstall.version ?? installing.version) === undefined ? null : (
                  <Field label={t('plaza.version')}>
                    <div className="adk-mono">{pluginInstall.version ?? installing.version}</div>
                  </Field>
                )}
                {pluginInstall.command === undefined || pluginInstall.command === '' ? null : (
                  <Field
                    label={t('plaza.pluginCommand')}
                    hint={
                      pluginInstall.profile === undefined || pluginInstall.profile === ''
                        ? undefined
                        : `${t('plaza.pluginProfile')}: ${pluginInstall.profile}`
                    }
                  >
                    <div className="adk-pre" style={{ maxHeight: 120 }}>
                      {pluginInstall.command}
                    </div>
                  </Field>
                )}
                {/* 桌面端 profile 由 App 独占：CLI 会拒绝这条命令，必须说清楚。 */}
                {pluginInstall.managed === true ? (
                  <Banner>{t('plaza.pluginManaged')}</Banner>
                ) : null}
                {pluginInstall.upstreamCommand === undefined ||
                pluginInstall.upstreamCommand === '' ? null : (
                  <Field label={t('plaza.pluginUpstreamCommand')}>
                    <div className="adk-mono">{pluginInstall.upstreamCommand}</div>
                  </Field>
                )}
                {(pluginInstall.capabilities ?? []).length === 0 ? null : (
                  <Field label={t('plaza.pluginCapabilities')}>
                    <div className="adk-tags">
                      {(pluginInstall.capabilities ?? []).map((capability) => (
                        <Tag key={capability}>{capability}</Tag>
                      ))}
                    </div>
                  </Field>
                )}
                {(pluginInstall.redLines ?? []).length === 0 ? null : (
                  <Field label={t('plaza.pluginRedLines')}>
                    <div className="adk-tags">
                      {(pluginInstall.redLines ?? []).map((redLine) => (
                        <Tag key={redLine} tone="error">
                          {redLine}
                        </Tag>
                      ))}
                    </div>
                  </Field>
                )}
                <Banner tone="info">{t('plaza.pluginEffect')}</Banner>
              </>
            )
          ) : null}
        </Modal>
      )}
    </div>
  );
}
