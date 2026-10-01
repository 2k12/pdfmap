import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useDebouncedValue } from '../../lib/debounce';
import { cleanTemplate } from '../../lib/template';
import { useTemplateStore } from '../../store/templateStore';

export function usePage(fileId: string, page: number) {
  return useQuery({
    queryKey: ['page', fileId, page],
    queryFn: () => api.getPage(fileId, page),
    placeholderData: keepPreviousData,
  });
}

/** Anota la página con la regla que coincide en cada línea; se recalcula al cambiar la plantilla. */
export function useAnnotate(fileId: string, page: number) {
  const template = useTemplateStore((s) => s.template);
  const debounced = useDebouncedValue(template, 350);
  return useQuery({
    queryKey: ['annotate', fileId, page, debounced],
    queryFn: ({ signal }) => api.annotate(fileId, cleanTemplate(debounced), page, signal),
    enabled: debounced.rules.length > 0,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function usePreview(fileId: string, maxPages = 20) {
  const template = useTemplateStore((s) => s.template);
  const debounced = useDebouncedValue(template, 500);
  return useQuery({
    queryKey: ['preview', fileId, maxPages, debounced],
    queryFn: ({ signal }) => api.preview(fileId, cleanTemplate(debounced), maxPages, 200, signal),
    enabled: debounced.rules.length > 0 && debounced.columns.length > 0,
    placeholderData: keepPreviousData,
    retry: false,
  });
}
