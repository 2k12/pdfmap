export interface ChunkPlan {
  index: number;
  start: number;
  end: number; // exclusivo
}

/** Divide un archivo de `size` bytes en fragmentos de `chunkSize`. */
export function planChunks(size: number, chunkSize: number): ChunkPlan[] {
  if (chunkSize <= 0) throw new Error('chunkSize debe ser positivo');
  const total = Math.max(1, Math.ceil(size / chunkSize));
  return Array.from({ length: total }, (_, index) => ({
    index,
    start: index * chunkSize,
    end: Math.min(size, (index + 1) * chunkSize),
  }));
}

/** Fragmentos que faltan por subir (para reanudar). */
export function pendingChunks(plan: ChunkPlan[], received: Iterable<number>): ChunkPlan[] {
  const done = new Set(received);
  return plan.filter((c) => !done.has(c.index));
}

/** Bytes ya subidos según los fragmentos recibidos. */
export function uploadedBytes(plan: ChunkPlan[], received: Iterable<number>): number {
  const done = new Set(received);
  return plan.filter((c) => done.has(c.index)).reduce((acc, c) => acc + (c.end - c.start), 0);
}
