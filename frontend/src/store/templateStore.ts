import { create } from 'zustand';
import type { Column, Field, Rule, Template, TemplateOptions } from '../api/types';
import { nextColor } from '../lib/colors';
import { uniqueId } from '../lib/slugify';
import { blankTemplate } from '../lib/template';

export interface SelectedLine {
  page: number;
  n: number;
  text: string;
}

interface TemplateState {
  template: Template;
  selectedRuleId: string | null;
  selectedLine: SelectedLine | null;
  selectedColumnId: string | null;
  dirty: boolean;

  load: (t: Template) => void;
  reset: () => void;
  markSaved: (t: Template) => void;
  setMeta: (patch: Partial<Pick<Template, 'name' | 'description'>>) => void;
  setOptions: (patch: Partial<TemplateOptions>) => void;

  selectRule: (id: string | null) => void;
  selectLine: (line: SelectedLine | null) => void;
  selectColumn: (id: string | null) => void;

  addRule: (partial: Partial<Rule> & { name: string }) => string;
  updateRule: (id: string, patch: Partial<Rule>) => void;
  removeRule: (id: string) => void;
  moveRule: (from: number, to: number) => void;

  addField: (ruleId: string, field: Omit<Field, 'key'> & { key?: string }) => string;
  updateField: (ruleId: string, key: string, patch: Partial<Field>) => void;
  removeField: (ruleId: string, key: string) => void;

  addColumn: (source: string, header: string, index?: number) => string;
  addSourceToColumn: (columnId: string, source: string) => void;
  removeSourceFromColumn: (columnId: string, source: string) => void;
  moveSource: (columnId: string, from: number, to: number) => void;
  updateColumn: (id: string, patch: Partial<Column>) => void;
  removeColumn: (id: string) => void;
  moveColumn: (from: number, to: number) => void;
}

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const copy = arr.slice();
  if (from < 0 || from >= copy.length || to < 0 || to >= copy.length) return copy;
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export const useTemplateStore = create<TemplateState>((set, get) => {
  const mutate = (fn: (t: Template) => Template) =>
    set((s) => ({ template: fn(s.template), dirty: true }));
  const mapRule = (t: Template, id: string, fn: (r: Rule) => Rule): Template => ({
    ...t,
    rules: t.rules.map((r) => (r.id === id ? fn(r) : r)),
  });

  return {
    template: blankTemplate(),
    selectedRuleId: null,
    selectedLine: null,
    selectedColumnId: null,
    dirty: false,

    load: (t) =>
      set({
        template: t,
        selectedRuleId: t.rules[0]?.id ?? null,
        selectedColumnId: null,
        selectedLine: null,
        dirty: false,
      }),
    reset: () =>
      set({
        template: blankTemplate(),
        selectedRuleId: null,
        selectedLine: null,
        selectedColumnId: null,
        dirty: false,
      }),
    markSaved: (t) => set((s) => ({ template: { ...s.template, ...t }, dirty: false })),
    setMeta: (patch) => mutate((t) => ({ ...t, ...patch })),
    setOptions: (patch) => mutate((t) => ({ ...t, options: { ...t.options, ...patch } })),

    selectRule: (id) => set({ selectedRuleId: id }),
    selectLine: (line) => set({ selectedLine: line }),
    selectColumn: (id) => set({ selectedColumnId: id }),

    addRule: (partial) => {
      const t = get().template;
      const id = uniqueId(
        partial.id || partial.name,
        t.rules.map((r) => r.id),
      );
      const rule: Rule = {
        action: 'row',
        match: { type: 'regex', value: '' },
        fields: [],
        clears: [],
        enabled: true,
        ...partial,
        id,
        color: partial.color ?? nextColor(t.rules.map((r) => r.color)),
      };
      mutate((tt) => ({ ...tt, rules: [...tt.rules, rule] }));
      set({ selectedRuleId: id });
      return id;
    },
    updateRule: (id, patch) =>
      mutate((t) => {
        const newId = patch.id && patch.id !== id ? patch.id : id;
        const renamed = mapRule(t, id, (r) => ({ ...r, ...patch, id: newId }));
        if (newId === id) return renamed;
        // Renombrar referencias en columnas y en `clears` / `check.group`.
        return {
          ...renamed,
          rules: renamed.rules.map((r) => ({
            ...r,
            clears: r.clears?.map((c) => (c === id ? newId : c)),
            check: r.check && r.check.group === id ? { ...r.check, group: newId } : r.check,
          })),
          columns: renamed.columns.map((c) => ({
            ...c,
            sources: c.sources.map((s) =>
              s.startsWith(`${id}.`) ? newId + s.slice(id.length) : s,
            ),
          })),
        };
      }),
    removeRule: (id) => {
      mutate((t) => ({
        ...t,
        rules: t.rules
          .filter((r) => r.id !== id)
          .map((r) => ({ ...r, clears: r.clears?.filter((c) => c !== id) })),
        columns: t.columns.map((c) => ({
          ...c,
          sources: c.sources.filter((s) => !s.startsWith(`${id}.`)),
        })),
      }));
      if (get().selectedRuleId === id) set({ selectedRuleId: get().template.rules[0]?.id ?? null });
    },
    moveRule: (from, to) => mutate((t) => ({ ...t, rules: arrayMove(t.rules, from, to) })),

    addField: (ruleId, field) => {
      const rule = get().template.rules.find((r) => r.id === ruleId);
      if (!rule) throw new Error(`Regla inexistente: ${ruleId}`);
      const key = uniqueId(
        field.key || field.label || 'campo',
        rule.fields.map((f) => f.key),
      );
      mutate((t) =>
        mapRule(t, ruleId, (r) => ({ ...r, fields: [...r.fields, { ...field, key }] })),
      );
      return key;
    },
    updateField: (ruleId, key, patch) =>
      mutate((t) => {
        const next = mapRule(t, ruleId, (r) => ({
          ...r,
          fields: r.fields.map((f) => (f.key === key ? { ...f, ...patch } : f)),
        }));
        if (!patch.key || patch.key === key) return next;
        const oldSrc = `${ruleId}.${key}`;
        const newSrc = `${ruleId}.${patch.key}`;
        return {
          ...next,
          columns: next.columns.map((c) => ({
            ...c,
            sources: c.sources.map((s) => (s === oldSrc ? newSrc : s)),
          })),
        };
      }),
    removeField: (ruleId, key) =>
      mutate((t) => ({
        ...mapRule(t, ruleId, (r) => ({ ...r, fields: r.fields.filter((f) => f.key !== key) })),
        columns: t.columns.map((c) => ({
          ...c,
          sources: c.sources.filter((s) => s !== `${ruleId}.${key}`),
        })),
      })),

    addColumn: (source, header, index) => {
      const t = get().template;
      const id = uniqueId(
        header || source.replace(/[@.]/g, '_'),
        t.columns.map((c) => c.id),
      );
      const col: Column = { id, header: header || id, sources: [source], enabled: true };
      mutate((tt) => {
        const columns = tt.columns.slice();
        columns.splice(index ?? columns.length, 0, col);
        return { ...tt, columns };
      });
      set({ selectedColumnId: id });
      return id;
    },
    addSourceToColumn: (columnId, source) =>
      mutate((t) => ({
        ...t,
        columns: t.columns.map((c) =>
          c.id === columnId && !c.sources.includes(source)
            ? { ...c, sources: [...c.sources, source] }
            : c,
        ),
      })),
    removeSourceFromColumn: (columnId, source) =>
      mutate((t) => ({
        ...t,
        columns: t.columns.map((c) =>
          c.id === columnId ? { ...c, sources: c.sources.filter((s) => s !== source) } : c,
        ),
      })),
    moveSource: (columnId, from, to) =>
      mutate((t) => ({
        ...t,
        columns: t.columns.map((c) =>
          c.id === columnId ? { ...c, sources: arrayMove(c.sources, from, to) } : c,
        ),
      })),
    updateColumn: (id, patch) =>
      mutate((t) => ({
        ...t,
        columns: t.columns.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      })),
    removeColumn: (id) => {
      mutate((t) => ({ ...t, columns: t.columns.filter((c) => c.id !== id) }));
      if (get().selectedColumnId === id) set({ selectedColumnId: null });
    },
    moveColumn: (from, to) => mutate((t) => ({ ...t, columns: arrayMove(t.columns, from, to) })),
  };
});
