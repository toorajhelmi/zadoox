export interface IrDelta {
  added: string[];
  removed: string[];
  changed: string[];
}

/**
 * Compute a node-level delta between two node-hash maps.
 */
export function computeIrDelta(
  prev: ReadonlyMap<string, string>,
  next: ReadonlyMap<string, string>
): IrDelta {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];

  for (const [id, nextHash] of next.entries()) {
    const prevHash = prev.get(id);
    if (!prevHash) added.push(id);
    else if (prevHash !== nextHash) changed.push(id);
  }

  for (const [id] of prev.entries()) {
    if (!next.has(id)) removed.push(id);
  }

  return { added, removed, changed };
}


