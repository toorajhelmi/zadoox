import type { IrDelta } from './delta';

export type IrEvent =
  | { type: 'ir/nodes_added'; nodeIds: string[] }
  | { type: 'ir/nodes_removed'; nodeIds: string[] }
  | { type: 'ir/nodes_changed'; nodeIds: string[] };

export function irEventsFromDelta(delta: IrDelta): IrEvent[] {
  const events: IrEvent[] = [];
  if (delta.added.length) events.push({ type: 'ir/nodes_added', nodeIds: delta.added });
  if (delta.removed.length) events.push({ type: 'ir/nodes_removed', nodeIds: delta.removed });
  if (delta.changed.length) events.push({ type: 'ir/nodes_changed', nodeIds: delta.changed });
  return events;
}


