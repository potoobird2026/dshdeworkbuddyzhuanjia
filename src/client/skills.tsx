/**
 * 技能页签：拆成两个视图。
 *
 *   - SkillsTab（默认）：技能广场（PlazaView）。
 *   - MySkillsPage：本地技能管理 —— 推荐横滑区 + 分类 chips + 卡片网格，
 *     从顶栏「我的技能」进入。
 *
 * 卡片主操作（右上角圆形按钮）= 启用/停用（改写 SKILL.md 的
 * disable-model-invocation）；编辑 / 删除在 ⋯ 菜单里。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from './api.js';
import {
  ActionButton,
  Banner,
  useNotice,
  CardMenu,
  Chips,
  Empty,
  Field,
  Loading,
  Modal,
  SectionHead,
  Tag,
  Tile,
  toneOf,
  type T,
} from './components.js';
import { IconFolder, IconPlus, IconRefresh, IconSparkle } from './icons.js';
import { PlazaView } from './plaza.js';
import { sendPrompt } from './session.js';
import type { ClientCtx } from './context.js';
import type { SkillDetail, SkillRow } from '../types.js';

/** 上传表单状态。 */
interface UploadForm {
  root: 'user' | 'project';
  source: 'archive' | 'files' | 'markdown';
  dataBase64?: string;
  files?: Array<{ path: string; text?: string; base64?: string }>;
  fileName?: string;
  enable: boolean;
  label: string;
}

/** 可当文本读的扩展名。 */
const TEXT_FILE = /\.(md|markdown|txt|json|ya?ml|csv)$/i;

/** File → base64（不含 data: 前缀）。 */
async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

/** 分类 chips。 */
const FILTERS = ['all', 'project', 'user', 'custom', 'builtin', 'runtime'] as const;
type Filter = (typeof FILTERS)[number];

/** 行的来源是否属于分类。 */
function inFilter(row: SkillRow, filter: Filter): boolean {
  const source = String(row.source);
  switch (filter) {
    case 'all':
      return true;
    case 'project':
      return source.startsWith('project');
    case 'user':
      return source.startsWith('user');
    case 'custom':
      return source === 'custom';
    case 'builtin':
      return source === 'bundled';
    case 'runtime':
      return source === 'runtime';
    default:
      return true;
  }
}

/** 推荐区轮换种子。 */
function pickFeatured(rows: SkillRow[], page: number, size = 6): SkillRow[] {
  const priority = (row: SkillRow): number => {
    const source = String(row.source);
    if (source === 'custom') return 0;
    if (source.startsWith('user')) return 1;
    if (source.startsWith('project')) return 2;
    return 3;
  };
  const ordered = [...rows].sort(
    (a, b) => priority(a) - priority(b) || a.name.localeCompare(b.name),
  );
  if (ordered.length <= size) return ordered;
  const offset = (page * size) % ordered.length;
  const rotated = [...ordered.slice(offset), ...ordered.slice(0, offset)];
  return rotated.slice(0, size);
}

/** 新建/编辑表单状态。 */
interface SkillForm {
  mode: 'create' | 'edit';
  name: string;
  description: string;
  whenToUse: string;
  content: string;
  root: 'user' | 'project';
  path: string;
  cwd: string;
  warnings: string[];
}

/** 技能广场（默认视图）。 */
export function SkillsTab({ t, query }: { t: T; query: string }) {
  return <PlazaView kind="skill" t={t} query={query} onChanged={() => undefined} />;
}

/** 我的技能页面（顶栏「我的技能」进入；「添加技能」按钮也在本页顶栏）。 */
export function MySkillsPage({
  t,
  query,
  cwd,
  addOpen,
  onCloseAdd,
  ctx,
}: {
  t: T;
  query: string;
  cwd?: string;
  /** 顶栏「添加技能」的开关（打开即弹三选一）。 */
  addOpen: boolean;
  onCloseAdd: () => void;
  ctx: ClientCtx;
}) {
  const [rows, setRows] = useState<SkillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [filter, setFilter] = useState<Filter>('all');
  const [form, setForm] = useState<SkillForm | undefined>();
  const [busy, setBusy] = useState(false);
  // 通知 3 秒自动消失。
  const [notice, setNotice] = useNotice();
  const [page, setPage] = useState(0);
  const [upload, setUpload] = useState<UploadForm | undefined>();
  const [dragOver, setDragOver] = useState(false);
  const [creator, setCreator] = useState<
    | {
        requirement: string;
        prompt: string;
        skill: string;
        available: boolean;
        note?: string;
      }
    | undefined
  >();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setRows((await api.skills(cwd)).skills);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : String(failure));
    } finally {
      setLoading(false);
    }
  }, [cwd]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (!inFilter(row, filter)) return false;
      if (needle === '') return true;
      return (
        row.name.toLowerCase().includes(needle) ||
        row.description.toLowerCase().includes(needle) ||
        (row.whenToUse ?? '').toLowerCase().includes(needle)
      );
    });
  }, [rows, filter, query]);

  const featured = useMemo(() => pickFeatured(rows, page, 5), [rows, page]);

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

  const toggle = async (row: SkillRow): Promise<void> => {
    const path = row.path;
    if (path === undefined) return;
    await run(() => api.skillSetEnabled({ name: row.name, path, cwd, enabled: row.disabled }));
  };

  const openEdit = async (row: SkillRow): Promise<void> => {
    if (row.path === undefined) return;
    setBusy(true);
    try {
      const detail: SkillDetail = await api.skillRead(row.name, row.path, cwd);
      setForm({
        mode: 'edit',
        name: detail.name,
        description: detail.description,
        whenToUse: detail.whenToUse ?? '',
        content: detail.content,
        root: 'user',
        path: detail.path,
        cwd: cwd ?? '',
        warnings: detail.warnings,
      });
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: SkillRow): Promise<void> => {
    const path = row.path;
    if (path === undefined) return;
    if (!window.confirm(`${t('action.delete')}: ${row.name}?\n${t('skills.deleteHint')}`)) return;
    await run(() => api.skillDelete({ name: row.name, path, cwd }));
  };

  const submit = async (): Promise<void> => {
    if (form === undefined) return;
    setBusy(true);
    setError(undefined);
    try {
      if (form.mode === 'create') {
        await api.skillCreate({
          root: form.root,
          cwd: form.cwd === '' ? undefined : form.cwd,
          name: form.name,
          description: form.description,
          whenToUse: form.whenToUse === '' ? undefined : form.whenToUse,
          content: form.content,
        });
      } else {
        await api.skillUpdate({
          name: form.name,
          path: form.path,
          cwd: form.cwd === '' ? undefined : form.cwd,
          description: form.description,
          whenToUse: form.whenToUse === '' ? undefined : form.whenToUse,
          content: form.content,
        });
      }
      setForm(undefined);
      onCloseAdd();
      await load();
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  /** 选择上传文件：zip / 单个 .md / 文件夹（取相对路径）。 */
  const pickFiles = async (files: File[]): Promise<void> => {
    if (files.length === 0 || upload === undefined) return;
    const zip = files.find((file) => file.name.toLowerCase().endsWith('.zip'));
    if (zip !== undefined) {
      const dataBase64 = await fileToBase64(zip);
      setUpload({
        ...upload,
        source: 'archive',
        dataBase64,
        files: undefined,
        fileName: zip.name,
        label: `${zip.name}（${String(Math.max(1, Math.round(zip.size / 1024)))} KB）`,
      });
      return;
    }
    if (files.length === 1 && /\.(md|markdown)$/i.test(files[0]?.name ?? '')) {
      const file = files[0] as File;
      const text = await file.text();
      setUpload({
        ...upload,
        source: 'markdown',
        dataBase64: undefined,
        files: [{ path: 'SKILL.md', text }],
        fileName: file.name,
        label: file.name,
      });
      return;
    }
    const entries: Array<{ path: string; text?: string; base64?: string }> = [];
    let folder = '';
    for (const file of files.slice(0, 200)) {
      const relative = (
        (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? file.name
      ).replace(/\\/g, '/');
      if (!relative.includes('/')) continue; // 文件夹上传必须带相对路径
      folder ||= relative.split('/')[0] ?? '';
      if (TEXT_FILE.test(relative)) entries.push({ path: relative, text: await file.text() });
      else if (file.size <= 256 * 1024) entries.push({ path: relative, base64: await fileToBase64(file) });
    }
    if (entries.length === 0) {
      setError(t('skills.dropHint'));
      return;
    }
    setUpload({
      ...upload,
      source: 'files',
      dataBase64: undefined,
      files: entries,
      fileName: undefined,
      label: `${folder === '' ? t('skills.pickFolder') : folder}（${String(entries.length)} 个文件）`,
    });
  };

  /** 执行导入。 */
  const submitUpload = async (): Promise<void> => {
    if (upload === undefined) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await api.skillImport({
        root: upload.root,
        cwd: cwd === '' ? undefined : cwd,
        source: upload.source,
        ...(upload.dataBase64 === undefined ? {} : { dataBase64: upload.dataBase64 }),
        ...(upload.files === undefined ? {} : { files: upload.files }),
        ...(upload.fileName === undefined ? {} : { fileName: upload.fileName }),
        enable: upload.enable,
      });
      setNotice(
        `${t('skills.imported')}: ${result.name} → ${result.path}` +
          (result.warnings.length === 0 ? '' : `（${result.warnings.join('; ')}）`),
      );
      setUpload(undefined);
      onCloseAdd();
      await load();
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  /** 生成（或刷新）创建技能的提示词。 */
  const generatePrompt = async (
    requirement: string,
  ): Promise<{ prompt: string; skill: string } | undefined> => {
    try {
      const info = await api.skillCreatorPrompt(requirement);
      const note = info.available ? undefined : t('skills.creatorMissing');
      setCreator({
        requirement,
        prompt: info.prompt,
        skill: info.skill,
        available: info.available,
        ...(note === undefined ? {} : { note }),
      });
      return { prompt: info.prompt, skill: info.skill };
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : String(failure));
      return undefined;
    }
  };

  /** AI 创建：取提示词 → 投递到当前会话。 */
  const runCreator = async (): Promise<void> => {
    if (creator === undefined) return;
    const requirement = creator.requirement.trim();
    if (requirement === '') return;
    setBusy(true);
    try {
      const prepared =
        creator.prompt === ''
          ? await generatePrompt(requirement)
          : { prompt: creator.prompt, skill: creator.skill };
      if (prepared === undefined) return;
      const outcome = await sendPrompt(ctx, prepared.prompt);
      if (outcome.ok && outcome.mode === 'sent') {
        setNotice(`${t('skills.sentToSession')}${prepared.skill === '' ? '' : `（${prepared.skill}）`}`);
        setCreator(undefined);
        onCloseAdd();
      } else if (outcome.ok) {
        setNotice(t('skills.copiedPrompt'));
      } else {
        setError(outcome.error ?? t('panel.error'));
      }
    } finally {
      setBusy(false);
    }
  };

  /** 一张技能卡片。 */
  const card = (row: SkillRow, inStrip: boolean) => (
    <div className="adk-card" key={`${inStrip ? 'strip' : 'grid'}-${row.name}`}>
      <div className="adk-card-head">
        <Tile tone={toneOf(row.name)}>{row.name.slice(0, 1).toUpperCase()}</Tile>
        <div className="adk-card-titleblock">
          <div className="adk-card-title" title={row.name}>
            <span className="adk-card-title-text">{row.name}</span>
            <CardMenu
              label={t('action.more')}
              items={[
                ...(row.toggleable
                  ? [{ label: row.disabled ? t('action.enable') : t('action.disable'), onSelect: () => void toggle(row) }]
                  : []),
                ...(row.path === undefined ? [] : [{ label: t('action.edit'), onSelect: () => void openEdit(row) }]),
                ...(row.path === undefined ? [] : [{ label: t('action.delete'), onSelect: () => void remove(row), danger: true }]),
              ]}
            />
          </div>
          <div className="adk-card-meta">{`${String(row.source)} · ${row.provider}`}</div>
        </div>
      </div>
      <div className="adk-card-desc" data-lines={inStrip ? '2' : '3'}>
        {row.description === '' ? '—' : row.description}
      </div>
      <div className="adk-tags">
        {row.disabled ? <Tag tone="error">{t('skills.disabled')}</Tag> : null}
        {row.invocation.userInvocable ? null : <Tag>user:off</Tag>}
        {row.path === undefined ? <Tag tone="accent">{t('skills.readonly')}</Tag> : null}
        {row.whenToUse === undefined ? null : <Tag>{row.whenToUse}</Tag>}
      </div>
    </div>
  );

  return (
    <div>
      {error === undefined ? null : (
        <Banner tone="error">{error}</Banner>
      )}
      {notice === undefined ? null : <Banner>{notice}</Banner>}

      {loading ? (
        <Loading t={t} />
      ) : (
        <>
          <div className="adk-section">
            <SectionHead title={t('skills.featured')}>
              <ActionButton onClick={() => setPage((value) => value + 1)}>
                <IconRefresh size={14} />
                {t('skills.shuffle')}
              </ActionButton>
            </SectionHead>
            {featured.length === 0 ? <Empty t={t} /> : <div className="adk-strip">{featured.map((row) => card(row, true))}</div>}
          </div>

          <div className="adk-section">
            <SectionHead title={t('skills.title')} count={visible.length} />
            <Chips
              items={FILTERS.map((key) => ({ key, label: t(`skills.filter.${key}`) }))}
              value={filter}
              onChange={setFilter}
            />
            {visible.length === 0 ? <Empty t={t} /> : <div className="adk-grid">{visible.map((row) => card(row, false))}</div>}
          </div>
        </>
      )}

      {form === undefined ? null : (
        <Modal
          title={form.mode === 'create' ? t('skills.createTitle') : t('action.edit')}
          onClose={() => {
            setForm(undefined);
            onCloseAdd();
          }}
          t={t}
          footer={
            <ActionButton primary disabled={busy} onClick={() => void submit()}>
              {t('action.save')}
            </ActionButton>
          }
        >
          {form.warnings.length === 0 ? null : <Banner>{form.warnings.join('\n')}</Banner>}
          <div className="adk-inline">
            <div style={{ flex: 1, minWidth: 220 }}>
              <Field label={t('skills.name')}>
                <input
                  className="adk-input"
                  value={form.name}
                  readOnly={form.mode === 'edit'}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </Field>
            </div>
            {form.mode === 'create' ? (
              <div style={{ marginBottom: 12 }}>
                <div className="adk-hint" style={{ marginBottom: 6 }}>
                  {t('skills.root')}
                </div>
                <div className="adk-checkrow">
                  <label className="adk-check">
                    <input
                      type="radio"
                      checked={form.root === 'user'}
                      onChange={() => setForm({ ...form, root: 'user' })}
                    />
                    {t('skills.root.user')}
                  </label>
                  <label className="adk-check">
                    <input
                      type="radio"
                      checked={form.root === 'project'}
                      onChange={() => setForm({ ...form, root: 'project' })}
                    />
                    {t('skills.root.project')}
                  </label>
                </div>
              </div>
            ) : null}
          </div>
          <Field label={t('skills.description')}>
            <input
              className="adk-input"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </Field>
          <Field label={t('skills.whenToUse')}>
            <input
              className="adk-input"
              value={form.whenToUse}
              onChange={(event) => setForm({ ...form, whenToUse: event.target.value })}
            />
          </Field>
          <Field label={t('skills.content')} hint={form.path === '' ? undefined : form.path}>
            <textarea
              className="adk-textarea"
              data-tall="true"
              value={form.content}
              onChange={(event) => setForm({ ...form, content: event.target.value })}
            />
          </Field>
          {form.path === '' ? null : (
            <div className="adk-mono">
              <IconFolder size={12} /> {form.path}
            </div>
          )}
        </Modal>
      )}

      {/* 添加技能：上传 / AI 创建 / 手动创建（顶栏按钮控制，三项选择后各自弹窗） */}
      {addOpen ? (
        <Modal title={t('skills.add')} onClose={onCloseAdd} t={t}>
          <div className="adk-choices">
            <button
              type="button"
              className="adk-choice"
              onClick={() => {
                onCloseAdd();
                setUpload({ root: 'user', source: 'archive', enable: true, label: '' });
              }}
            >
              <IconFolder size={18} />
              <span className="adk-choice-title">{t('skills.import')}</span>
              <span className="adk-choice-desc">{t('skills.importDesc')}</span>
            </button>
            <button
              type="button"
              className="adk-choice"
              onClick={() => {
                onCloseAdd();
                setCreator({ requirement: '', prompt: '', skill: '', available: false });
              }}
            >
              <IconSparkle size={18} />
              <span className="adk-choice-title">{t('skills.createByAi')}</span>
              <span className="adk-choice-desc">{t('skills.createByAiDesc')}</span>
            </button>
            <button
              type="button"
              className="adk-choice"
              onClick={() => {
                onCloseAdd();
                setForm({
                  mode: 'create',
                  name: '',
                  description: '',
                  whenToUse: '',
                  content: '',
                  root: 'user',
                  path: '',
                  cwd: cwd ?? '',
                  warnings: [],
                });
              }}
            >
              <IconPlus size={18} />
              <span className="adk-choice-title">{t('skills.createManual')}</span>
              <span className="adk-choice-desc">{t('skills.createManualDesc')}</span>
            </button>
          </div>
        </Modal>
      ) : null}

      {/* 导入技能（zip / 文件夹 / .md） */}
      {upload === undefined ? null : (
        <Modal
          title={t('skills.import')}
          onClose={() => {
            setUpload(undefined);
            onCloseAdd();
          }}
          t={t}
          footer={
            <ActionButton
              primary
              disabled={busy || upload.label === ''}
              onClick={() => void submitUpload()}
            >
              {t('skills.importAction')}
            </ActionButton>
          }
        >
          <div
            className="adk-drop"
            data-over={dragOver ? 'true' : 'false'}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              void pickFiles(Array.from(event.dataTransfer.files));
            }}
          >
            <IconFolder size={26} />
            <div className="adk-drop-title">
              {upload.label === '' ? t('skills.dropHint') : upload.label}
            </div>
            <div className="adk-hint">{t('skills.dropFormats')}</div>
            <div className="adk-inline" style={{ justifyContent: 'center', marginTop: 10 }}>
              <label className="adk-action">
                {t('skills.pickZip')}
                <input
                  type="file"
                  accept=".zip,application/zip"
                  style={{ display: 'none' }}
                  onChange={(event) => void pickFiles(Array.from(event.target.files ?? []))}
                />
              </label>
              <label className="adk-action">
                {t('skills.pickMd')}
                <input
                  type="file"
                  accept=".md,text/markdown"
                  style={{ display: 'none' }}
                  onChange={(event) => void pickFiles(Array.from(event.target.files ?? []))}
                />
              </label>
              <label className="adk-action">
                {t('skills.pickFolder')}
                <input
                  type="file"
                  multiple
                  style={{ display: 'none' }}
                  {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
                  onChange={(event) => void pickFiles(Array.from(event.target.files ?? []))}
                />
              </label>
            </div>
          </div>

          <div className="adk-inline" style={{ marginTop: 12 }}>
            <div>
              <div className="adk-hint" style={{ marginBottom: 6 }}>
                {t('skills.root')}
              </div>
              <div className="adk-checkrow">
                <label className="adk-check">
                  <input
                    type="radio"
                    checked={upload.root === 'user'}
                    onChange={() => setUpload({ ...upload, root: 'user' })}
                  />
                  {t('skills.root.user')}
                </label>
                <label className="adk-check">
                  <input
                    type="radio"
                    checked={upload.root === 'project'}
                    onChange={() => setUpload({ ...upload, root: 'project' })}
                  />
                  {t('skills.root.project')}
                </label>
              </div>
            </div>
          </div>

          <label className="adk-check" style={{ marginTop: 10 }}>
            <input
              type="checkbox"
              checked={upload.enable}
              onChange={(event) => setUpload({ ...upload, enable: event.target.checked })}
            />
            {t('skills.autoEnable')}
          </label>

          <div className="adk-requirements">
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{t('skills.requirements')}</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>{t('skills.requirementArchive')}</li>
              <li>{t('skills.requirementMarkdown')}</li>
            </ul>
          </div>
        </Modal>
      )}

      {/* AI 创建技能（指名 creatorSkill） */}
      {creator === undefined ? null : (
        <Modal
          title={t('skills.createByAi')}
          onClose={() => {
            setCreator(undefined);
            onCloseAdd();
          }}
          t={t}
          footer={
            <>
              <ActionButton
                disabled={busy || creator.requirement.trim() === ''}
                onClick={() => void generatePrompt(creator.requirement)}
              >
                {t('skills.previewPrompt')}
              </ActionButton>
              <ActionButton
                primary
                disabled={busy || creator.requirement.trim() === ''}
                onClick={() => void runCreator()}
              >
                {t('skills.createByAiAction')}
              </ActionButton>
            </>
          }
        >
          <label className="adk-composer">
            <span className="adk-skill-chip">
              <IconSparkle size={13} />
              {creator.skill === '' ? t('skills.creatorSkill') : creator.skill}
            </span>
            <input
              className="adk-composer-input"
              autoFocus
              value={creator.requirement}
              placeholder={t('skills.requirementPlaceholder')}
              onChange={(event) => setCreator({ ...creator, requirement: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void runCreator();
              }}
            />
          </label>
          {creator.note === undefined ? null : (
            <div className="adk-hint" style={{ marginTop: 6 }}>
              {creator.note}
            </div>
          )}
          {creator.prompt === '' ? null : <div className="adk-pre" style={{ marginTop: 12 }}>{creator.prompt}</div>}
        </Modal>
      )}
    </div>
  );
}
