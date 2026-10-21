/**
 * 连接器页签：拆成两个视图。
 *
 *   - ConnectorsTab（默认）：MCP 广场（PlazaView）。
 *   - MyConnectorsPage：本地连接器管理 —— MCP 服务器卡片网格 + profile 只读列表，
 *     从顶栏「我的 MCP」进入。
 *
 * 卡片主操作（圆形按钮）= 启用/停用（运行时挂载/卸载官方 dsh-mcp-client，
 * 立即生效）；⋯ 菜单里是 测试 / 重连 / 编辑 / 删除。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, type ConnectorsResponse } from './api.js';
import {
  ActionButton,
  Banner,
  useNotice,
  CardMenu,
  Checkbox,
  Empty,
  Field,
  Loading,
  Modal,
  SectionHead,
  Tag,
  Tile,
  linesToRecord,
  recordToLines,
  toneOf,
  type T,
} from './components.js';
import { IconPlus } from './icons.js';
import { PlazaView } from './plaza.js';
import type { ConnectorRow } from '../types.js';

/** 表单状态。 */
interface ConnectorForm {
  mode: 'create' | 'edit';
  id: string;
  label: string;
  description: string;
  transport: 'stdio' | 'streamable-http';
  serverName: string;
  command: string;
  args: string;
  env: string;
  cwd: string;
  url: string;
  headers: string;
  toolCallTimeoutMs: number;
  failOnStartupError: boolean;
  enabled: boolean;
}

/** 空表单。 */
function emptyForm(): ConnectorForm {
  return {
    mode: 'create',
    id: '',
    label: '',
    description: '',
    transport: 'stdio',
    serverName: '',
    command: '',
    args: '',
    env: '',
    cwd: '',
    url: '',
    headers: '',
    toolCallTimeoutMs: 60000,
    failOnStartupError: false,
    enabled: true,
  };
}

/** MCP 广场（默认视图）。 */
export function ConnectorsTab({ t, query }: { t: T; query: string }) {
  return <PlazaView kind="connector" t={t} query={query} onChanged={() => undefined} />;
}

/** 我的连接器页面（顶栏「我的 MCP」进入；「自定义连接器」按钮也在本页顶栏）。 */
export function MyConnectorsPage({
  t,
  query,
  addOpen,
  onCloseAdd,
}: {
  t: T;
  query: string;
  /** 顶栏「自定义连接器」的开关（打开即弹新建表单）。 */
  addOpen: boolean;
  onCloseAdd: () => void;
}) {
  const [data, setData] = useState<ConnectorsResponse | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<ConnectorForm | undefined>();
  // 通知 3 秒自动消失。
  const [notice, setNotice] = useNotice();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setData(await api.connectors());
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : String(failure));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // 顶栏「自定义连接器」：置位 addOpen 即刻打开空表单（仅消费一次上升沿）。
  const lastAddSignal = useRef(false);
  useEffect(() => {
    if (addOpen && !lastAddSignal.current) {
      lastAddSignal.current = true;
      setForm(emptyForm());
    }
    if (!addOpen) lastAddSignal.current = false;
  }, [addOpen]);

  const needle = query.trim().toLowerCase();
  const rows = useMemo(() => {
    const list = data?.connectors ?? [];
    if (needle === '') return list;
    return list.filter((row) =>
      [row.label, row.serverName, row.description].some((field) => field.toLowerCase().includes(needle)),
    );
  }, [data, needle]);

  const run = async (action: () => Promise<unknown>, message?: string): Promise<void> => {
    setBusy(true);
    setError(undefined);
    if (message !== undefined) setNotice(message);
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
    const payload = {
      label: form.label,
      description: form.description,
      transport: form.transport,
      serverName: form.serverName,
      command: form.command,
      args: form.args
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== ''),
      env: linesToRecord(form.env),
      cwd: form.cwd,
      url: form.url,
      headers: linesToRecord(form.headers),
      toolCallTimeoutMs: Number(form.toolCallTimeoutMs),
      failOnStartupError: form.failOnStartupError,
      enabled: form.enabled,
    };
    setBusy(true);
    setError(undefined);
    try {
      if (form.mode === 'create') await api.connectorCreate(payload);
      else await api.connectorUpdate({ ...payload, id: form.id });
      setForm(undefined);
      onCloseAdd();
      await load();
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (row: ConnectorRow): void => {
    setForm({
      mode: 'edit',
      id: row.id,
      label: row.label,
      description: row.description,
      transport: row.transport,
      serverName: row.serverName,
      command: row.command,
      args: row.args.join('\n'),
      env: recordToLines(row.env),
      cwd: row.cwd,
      url: row.url,
      headers: recordToLines(row.headers),
      toolCallTimeoutMs: row.toolCallTimeoutMs,
      failOnStartupError: row.failOnStartupError,
      enabled: row.enabled,
    });
  };

  const test = async (row: ConnectorRow): Promise<void> => {
    await run(async () => {
      const result = await api.connectorTest({ id: row.id });
      setNotice(
        `${row.label}: ${result.ok ? t('connectors.testOk') : t('connectors.testFail')}` +
          (result.tools.length === 0 ? '' : ` — ${result.tools.join(', ')}`),
      );
    });
  };

  return (
    <div>
      {data?.available === false ? <Banner>{t('connectors.unavailable')}</Banner> : null}
      {error === undefined ? null : <Banner tone="error">{error}</Banner>}
      {notice === undefined ? null : <Banner>{notice}</Banner>}

      {loading ? (
        <Loading t={t} />
      ) : (
        <>
          <div className="adk-section">
            <SectionHead title={t('connectors.title')} count={rows.length} />
            {rows.length === 0 ? (
              <Empty t={t} />
            ) : (
              <div className="adk-grid">
                {rows.map((row) => {
                  const state = row.status.state;
                  return (
                    <div
                      className="adk-card"
                      key={row.id}
                      data-broken={state === 'error' ? 'true' : 'false'}
                    >
                      <div className="adk-card-head">
                        <Tile tone={toneOf(row.serverName)}>{row.label.slice(0, 1).toUpperCase()}</Tile>
                        <div className="adk-card-titleblock">
                          <div className="adk-card-title" title={row.label}>
                            <span className="adk-dot" data-state={state} />
                            <span className="adk-card-title-text">{row.label}</span>
                            <CardMenu
                              label={t('action.more')}
                              items={[
                                {
                                  label: row.enabled ? t('action.disable') : t('action.enable'),
                                  onSelect: () => void run(() => api.connectorSetEnabled(row.id, !row.enabled)),
                                  disabled: busy || data?.available === false,
                                },
                                { label: t('action.test'), onSelect: () => void test(row), disabled: busy },
                                { label: t('action.reconnect'), onSelect: () => void run(() => api.connectorReconnect(row.id)), disabled: busy },
                                { label: t('action.edit'), onSelect: () => openEdit(row) },
                                {
                                  label: t('action.delete'),
                                  danger: true,
                                  onSelect: () => {
                                    if (window.confirm(`${t('action.delete')}: ${row.label}?`)) {
                                      void run(() => api.connectorDelete(row.id));
                                    }
                                  },
                                },
                              ]}
                            />
                          </div>
                          <div className="adk-card-meta">{`${row.transport} · mcp__${row.serverName}__*`}</div>
                        </div>
                      </div>
                      <div className="adk-card-desc">
                        {row.description === '' ? `${t('connectors.serverName')}: ${row.serverName}` : row.description}
                      </div>
                      {row.status.lastError === undefined ? null : (
                        <div className="adk-card-desc" data-lines="2" style={{ color: 'var(--adk-danger)' }}>
                          {row.status.lastError}
                        </div>
                      )}
                      <div className="adk-tags">
                        <Tag tone={state === 'connected' ? 'ok' : state === 'error' ? 'error' : undefined}>
                          {t(`connectors.state.${state}`)}
                        </Tag>
                        <Tag>{`${t('connectors.tools')} ${String(row.status.toolCount)}`}</Tag>
                        {row.status.tools.slice(0, 1).map((tool) => (
                          <Tag key={tool}>{tool}</Tag>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {(data?.profileConfigured ?? []).length === 0 ? null : (
            <div className="adk-section">
              <SectionHead title={t('connectors.profile')} count={(data?.profileConfigured ?? []).length} />
              <div className="adk-grid">
                {(data?.profileConfigured ?? []).map((row) => (
                  <div className="adk-card" key={`${row.source}:${row.entryId}`}>
                    <div className="adk-card-head">
                      <Tile tone={toneOf(row.serverName)}>{row.serverName.slice(0, 1).toUpperCase()}</Tile>
                      <div className="adk-card-titleblock">
                        <div className="adk-card-title">{row.serverName}</div>
                        <div className="adk-card-meta">{`${row.transport} · ${row.entryId}`}</div>
                      </div>
                      <Tag tone={row.enabled ? 'ok' : undefined}>
                        {row.enabled ? t('action.enable') : t('action.disable')}
                      </Tag>
                    </div>
                    <div className="adk-card-desc">{`${t('connectors.profile')}: ${row.source}`}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {form === undefined ? null : (

        <Modal
          title={form.mode === 'create' ? t('connectors.createTitle') : t('action.edit')}
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
          <Field label={t('connectors.transport')}>
            <select
              className="adk-select"
              value={form.transport}
              onChange={(event) =>
                setForm({ ...form, transport: event.target.value as ConnectorForm['transport'] })
              }
            >
              <option value="stdio">{t('connectors.transport.stdio')}</option>
              <option value="streamable-http">{t('connectors.transport.http')}</option>
            </select>
          </Field>
          <Field label={t('connectors.label')}>
            <input
              className="adk-input"
              value={form.label}
              onChange={(event) => setForm({ ...form, label: event.target.value })}
            />
          </Field>
          <Field label={t('connectors.serverName')}>
            <input
              className="adk-input"
              value={form.serverName}
              onChange={(event) => setForm({ ...form, serverName: event.target.value })}
            />
          </Field>
          <Field label={t('experts.description')}>
            <input
              className="adk-input"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </Field>
          {form.transport === 'stdio' ? (
            <>
              <Field label={t('connectors.command')}>
                <input
                  className="adk-input"
                  value={form.command}
                  placeholder="npx"
                  onChange={(event) => setForm({ ...form, command: event.target.value })}
                />
              </Field>
              <Field label={t('connectors.args')}>
                <textarea
                  className="adk-textarea"
                  value={form.args}
                  placeholder={'-y\n@modelcontextprotocol/server-filesystem\n/tmp'}
                  onChange={(event) => setForm({ ...form, args: event.target.value })}
                />
              </Field>
              <Field label={t('connectors.env')} hint={t('connectors.secretsHint')}>
                <textarea
                  className="adk-textarea"
                  value={form.env}
                  placeholder={'GITHUB_TOKEN=••••••'}
                  onChange={(event) => setForm({ ...form, env: event.target.value })}
                />
              </Field>
              <Field label={t('connectors.cwd')}>
                <input
                  className="adk-input"
                  value={form.cwd}
                  onChange={(event) => setForm({ ...form, cwd: event.target.value })}
                />
              </Field>
            </>
          ) : (
            <>
              <Field label={t('connectors.url')}>
                <input
                  className="adk-input"
                  value={form.url}
                  placeholder="http://localhost:3000/mcp"
                  onChange={(event) => setForm({ ...form, url: event.target.value })}
                />
              </Field>
              <Field label={t('connectors.headers')} hint={t('connectors.secretsHint')}>
                <textarea
                  className="adk-textarea"
                  value={form.headers}
                  placeholder={'Authorization=••••••'}
                  onChange={(event) => setForm({ ...form, headers: event.target.value })}
                />
              </Field>
            </>
          )}
          <Field label={t('connectors.timeout')}>
            <input
              className="adk-input"
              type="number"
              value={form.toolCallTimeoutMs}
              onChange={(event) => setForm({ ...form, toolCallTimeoutMs: Number(event.target.value) || 60000 })}
            />
          </Field>
          <div className="adk-checkrow">
            <Checkbox
              label={t('action.enable')}
              checked={form.enabled}
              onChange={(next) => setForm({ ...form, enabled: next })}
            />
            <Checkbox
              label={t('connectors.failOnStartup')}
              checked={form.failOnStartupError}
              onChange={(next) => setForm({ ...form, failOnStartupError: next })}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
