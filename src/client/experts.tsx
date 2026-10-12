/**
 * 专家页签：拆成两个视图。
 *
 *   - ExpertsTab（默认）：专家广场（PlazaView）。
 *   - MyExpertsPage：本地专家管理 —— 我的专家（可编辑，注册成真实 Agent Preset）
 *     + 专家团（官方预设，只读），从顶栏「我的专家」进入。
 *
 * 卡片主操作（圆形按钮）= 设为默认；⋯ 菜单里是 编辑 / 复制 / 查看组合 / 删除。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, type ExpertsResponse } from './api.js';
import {
  ActionButton,
  Banner,
  CardMenu,
  Checkbox,
  Chips,
  Empty,
  Field,
  Loading,
  Modal,
  SectionHead,
  Subtabs,
  Tag,
  Tile,
  splitList,
  toneOf,
  type T,
} from './components.js';
import { IconPlus } from './icons.js';
import { PlazaView } from './plaza.js';
import type { ConnectorRow, ExpertCapabilities, ExpertRecord, SkillRow } from '../types.js';

/** 能力开关定义。 */
const CAPABILITIES: Array<keyof ExpertCapabilities> = [
  'shell',
  'fs',
  'skills',
  'todo',
  'web',
  'ask',
  'subagents',
  'compaction',
];

/** 表单状态。 */
interface ExpertForm {
  mode: 'create' | 'edit';
  id: string;
  name: string;
  icon: string;
  description: string;
  tags: string;
  systemPrompt: string;
  capabilities: ExpertCapabilities;
  skillNames: string[];
  connectorIds: string[];
}

/** 新建时的默认能力。 */
function defaultCaps(): ExpertCapabilities {
  return {
    shell: true,
    fs: true,
    skills: true,
    todo: true,
    web: true,
    ask: true,
    subagents: false,
    compaction: true,
  };
}

/** 专家广场（默认视图）。 */
export function ExpertsTab({ t, query }: { t: T; query: string }) {
  return <PlazaView kind="expert" t={t} query={query} onChanged={() => undefined} />;
}

/** 我的专家页面（顶栏「我的专家」进入；「新建专家」按钮也在本页顶栏）。 */
export function MyExpertsPage({
  t,
  query,
  addOpen,
  onCloseAdd,
}: {
  t: T;
  query: string;
  /** 顶栏「新建专家」的开关（打开即弹新建表单）。 */
  addOpen: boolean;
  onCloseAdd: () => void;
}) {
  const [data, setData] = useState<ExpertsResponse | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<ExpertForm | undefined>();
  const [detail, setDetail] = useState<{ title: string; body: string } | undefined>();
  const [tag, setTag] = useState<string>('all');
  // 子视图：「我的专家」/「官方预设」两个独立页面。
  const [view, setView] = useState<'mine' | 'official'>('mine');
  const [options, setOptions] = useState<{ skills: SkillRow[]; connectors: ConnectorRow[] }>({
    skills: [],
    connectors: [],
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setData(await api.experts());
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : String(failure));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // 顶栏「新建专家」：置位 addOpen 即刻打开空表单（仅消费一次上升沿）。
  const lastAddSignal = useRef(false);
  useEffect(() => {
    if (addOpen && !lastAddSignal.current) {
      lastAddSignal.current = true;
      void openCreate();
    }
    if (!addOpen) lastAddSignal.current = false;
  }, [addOpen]);

  const needle = query.trim().toLowerCase();
  const match = useCallback(
    (...fields: Array<string | undefined>): boolean =>
      needle === '' || fields.some((field) => (field ?? '').toLowerCase().includes(needle)),
    [needle],
  );

  const mineAll = data?.mine ?? [];
  const officialAll = data?.official ?? [];

  const tagItems = useMemo(() => {
    const found = new Set<string>();
    for (const row of mineAll) for (const item of row.tags) found.add(item);
    return [
      { key: 'all', label: t('skills.filter.all') },
      ...[...found].sort((a, b) => a.localeCompare(b)).map((key) => ({ key, label: key })),
    ];
  }, [mineAll, t]);

  const mine = useMemo(
    () =>
      mineAll.filter(
        (row) => match(row.name, row.description, row.tags.join(' ')) && (tag === 'all' || row.tags.includes(tag)),
      ),
    [mineAll, match, tag],
  );
  const official = useMemo(
    () => officialAll.filter((row) => match(row.id, row.name, row.description)),
    [officialAll, match],
  );

  const loadOptions = async (): Promise<void> => {
    try {
      const [skills, connectors] = await Promise.all([api.skills(), api.connectors()]);
      setOptions({ skills: skills.skills, connectors: connectors.connectors });
    } catch (failure) {
      console.warn('[square] option load failed', failure);
    }
  };

  const openCreate = async (): Promise<void> => {
    await loadOptions();
    setForm({
      mode: 'create',
      id: '',
      name: '',
      icon: '🤖',
      description: '',
      tags: '',
      systemPrompt: '',
      capabilities: defaultCaps(),
      skillNames: [],
      connectorIds: [],
    });
  };

  const openEdit = async (row: ExpertRecord): Promise<void> => {
    await loadOptions();
    setForm({
      mode: 'edit',
      id: row.id,
      name: row.name,
      icon: row.icon,
      description: row.description,
      tags: row.tags.join(', '),
      systemPrompt: row.systemPrompt,
      capabilities: row.capabilities,
      skillNames: row.skillNames,
      connectorIds: row.connectorIds,
    });
  };

  const run = async (action: () => Promise<unknown>): Promise<void> => {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      await load();
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (): Promise<void> => {
    if (form === undefined) return;
    setBusy(true);
    setError(undefined);
    const payload: Partial<ExpertRecord> = {
      name: form.name,
      icon: form.icon,
      description: form.description,
      tags: splitList(form.tags),
      systemPrompt: form.systemPrompt,
      capabilities: form.capabilities,
      skillNames: form.skillNames,
      connectorIds: form.connectorIds,
    };
    try {
      if (form.mode === 'create') await api.expertCreate(payload);
      else await api.expertUpdate({ ...payload, id: form.id });
      setForm(undefined);
      onCloseAdd();
      await load();
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  const showOfficialDetail = async (id: string): Promise<void> => {
    setBusy(true);
    try {
      const response = await api.expertRead(id);
      setDetail({ title: id, body: response.official?.compositionYaml ?? '—' });
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  /** 我的专家卡片。 */
  const mineCard = (row: ExpertRecord) => {
    const broken = data?.broken[row.id];
    const isDefault = data?.defaultId === `square-${row.id}`;
    return (
      <div className="adk-card" key={row.id} data-broken={broken === undefined ? 'false' : 'true'}>
        <div className="adk-card-head">
          <Tile tone={toneOf(row.id)}>{row.icon === '' ? '🤖' : row.icon}</Tile>
          <div className="adk-card-titleblock">
            <div className="adk-card-title" title={row.name}>
              <span className="adk-card-title-text">{row.name}</span>
              {isDefault ? <Tag tone="accent">{t('experts.default')}</Tag> : null}
              <CardMenu
                label={t('action.more')}
                items={[
                  ...(isDefault
                    ? []
                    : [{ label: t('action.setDefault'), onSelect: () => void run(() => api.expertSetDefault(`square-${row.id}`)) }]),
                  { label: t('action.edit'), onSelect: () => void openEdit(row) },
                  { label: t('action.duplicate'), onSelect: () => void run(() => api.expertDuplicate(row.id)) },
                  {
                    label: t('action.delete'),
                    danger: true,
                    onSelect: () => {
                      if (window.confirm(`${t('action.delete')}: ${row.name}?`)) {
                        void run(() => api.expertDelete(row.id));
                      }
                    },
                  },
                ]}
              />
            </div>
            <div className="adk-card-meta">
              {`${String(row.skillNames.length)} ${t('experts.skillUnit')} · ${String(row.connectorIds.length)} ${t('experts.connectorUnit')}`}
            </div>
          </div>
        </div>
        <div className="adk-card-desc">{row.description === '' ? row.systemPrompt : row.description}</div>
        <div className="adk-tags">
          {row.tags.map((item) => (
            <Tag key={item}>{item}</Tag>
          ))}
          {broken === undefined ? null : <Tag tone="error">{`${t('experts.broken')}: ${broken}`}</Tag>}
        </div>
      </div>
    );
  };

  /** 官方预设卡片。 */
  const officialCard = (row: ExpertsResponse['official'][number]) => (
    <div className="adk-card" key={row.id} data-broken={row.broken === undefined ? 'false' : 'true'}>
      <div className="adk-card-head">
        <Tile tone={toneOf(row.id)}>{(row.name ?? row.id).slice(0, 1).toUpperCase()}</Tile>
        <div className="adk-card-titleblock">
          <div className="adk-card-title" title={row.id}>
            <span className="adk-card-title-text">{row.name ?? row.id}</span>
            {row.isDefault ? <Tag tone="accent">{t('experts.default')}</Tag> : null}
            <CardMenu
              label={t('action.more')}
              items={[
                ...(row.isDefault
                  ? []
                  : [{ label: t('action.setDefault'), onSelect: () => void run(() => api.expertSetDefault(row.id)) }]),
                { label: t('action.detail'), onSelect: () => void showOfficialDetail(row.id) },
                { label: t('action.duplicate'), onSelect: () => void run(() => api.expertDuplicate(row.id)) },
              ]}
            />
          </div>
          <div className="adk-card-meta">{row.id}</div>
        </div>
      </div>
      <div className="adk-card-desc">{row.description ?? t('experts.officialHint')}</div>
      <div className="adk-tags">
        {row.broken === undefined ? <Tag tone="ok">{t('experts.active')}</Tag> : <Tag tone="error">{row.broken}</Tag>}
      </div>
    </div>
  );

  return (
    <div>
      {error === undefined ? null : <Banner tone="error">{error}</Banner>}

      {loading ? (
        <Loading t={t} />
      ) : (
        <>
          <div className="adk-section">
            <Subtabs
              items={[
                { key: 'mine', label: t('experts.tab.mine') },
                { key: 'official', label: t('experts.tab.official') },
              ]}
              value={view}
              onChange={setView}
            />
          </div>

          {view === 'mine' ? (
            <div className="adk-section">
              <SectionHead title={t('experts.title')} count={mine.length} />
              {tagItems.length > 2 ? (
                <Chips items={tagItems} value={tag} onChange={setTag} />
              ) : null}
              {mine.length === 0 ? (
                <Empty t={t} />
              ) : (
                <div className="adk-grid">{mine.map((row) => mineCard(row))}</div>
              )}
            </div>
          ) : (
            <div className="adk-section">
              <SectionHead title={t('experts.official')} count={official.length} />
              {official.length === 0 ? (
                <Empty t={t} />
              ) : (
                <div className="adk-grid">{official.map((row) => officialCard(row))}</div>
              )}
            </div>
          )}
        </>
      )}

      {detail === undefined ? null : (
        <Modal title={`${t('experts.composition')} — ${detail.title}`} onClose={() => setDetail(undefined)} t={t}>
          <div className="adk-pre">{detail.body}</div>
        </Modal>
      )}

      {/* 新建/编辑专家（顶栏「新建专家」与卡片「编辑」共用同一表单） */}
      {form === undefined ? null : (
        <Modal
          title={form.mode === 'create' ? t('experts.create') : t('action.edit')}
          onClose={() => {
            setForm(undefined);
            onCloseAdd();
          }}
          t={t}
          footer={
            <ActionButton primary disabled={busy} onClick={() => void submit()}>
              <IconPlus size={14} />
              {t('action.save')}
            </ActionButton>
          }
        >
          <div className="adk-inline">
            <div style={{ width: 92 }}>
              <Field label={t('experts.icon')}>
                <input
                  className="adk-input"
                  value={form.icon}
                  onChange={(event) => setForm({ ...form, icon: event.target.value })}
                />
              </Field>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <Field label={t('experts.name')}>
                <input
                  className="adk-input"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </Field>
            </div>
          </div>
          <Field label={t('experts.description')}>
            <input
              className="adk-input"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </Field>
          <Field label={t('experts.tags')}>
            <input
              className="adk-input"
              value={form.tags}
              onChange={(event) => setForm({ ...form, tags: event.target.value })}
            />
          </Field>
          <Field label={t('experts.prompt')}>
            <textarea
              className="adk-textarea"
              data-tall="true"
              value={form.systemPrompt}
              onChange={(event) => setForm({ ...form, systemPrompt: event.target.value })}
            />
          </Field>
          <Field label={t('experts.capabilities')}>
            <div className="adk-checkrow">
              {CAPABILITIES.map((key) => (
                <Checkbox
                  key={key}
                  label={t(`cap.${key}`)}
                  checked={form.capabilities[key]}
                  onChange={(next) => setForm({ ...form, capabilities: { ...form.capabilities, [key]: next } })}
                />
              ))}
            </div>
          </Field>
          <Field label={t('experts.boundSkills')}>
            <div className="adk-checkrow">
              {options.skills.length === 0 ? (
                <span className="adk-hint">—</span>
              ) : (
                options.skills.slice(0, 80).map((skill) => (
                  <Checkbox
                    key={skill.name}
                    label={skill.name}
                    checked={form.skillNames.includes(skill.name)}
                    onChange={(next) =>
                      setForm({
                        ...form,
                        skillNames: next
                          ? [...form.skillNames, skill.name]
                          : form.skillNames.filter((name) => name !== skill.name),
                      })
                    }
                  />
                ))
              )}
            </div>
          </Field>
          <Field label={t('experts.boundConnectors')}>
            <div className="adk-checkrow">
              {options.connectors.length === 0 ? (
                <span className="adk-hint">—</span>
              ) : (
                options.connectors.map((connector) => (
                  <Checkbox
                    key={connector.id}
                    label={connector.label}
                    checked={form.connectorIds.includes(connector.id)}
                    onChange={(next) =>
                      setForm({
                        ...form,
                        connectorIds: next
                          ? [...form.connectorIds, connector.id]
                          : form.connectorIds.filter((id) => id !== connector.id),
                      })
                    }
                  />
                ))
              )}
            </div>
          </Field>
        </Modal>
      )}
    </div>
  );
}
