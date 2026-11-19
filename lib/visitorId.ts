/**
 * Visitor ID storage rules, pure so they are unit-tested.
 * Kids routes (COPPA): the ID is never read from or written to storage, an existing stored ID is
 * removed, and an in-memory ID is used for the page's life. Everywhere else the ID is persisted.
 */
export const VISITOR_KEY = 'wyr_visitor_id';

type KeyStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function resolveVisitorId(o: {
  kids: boolean;
  storage: KeyStorage | null;
  uuid: () => string;
  /** In-memory fallback shared by the caller; filled with the id that was returned. */
  memory: { id?: string };
}): { id: string; isNew: boolean } {
  if (o.kids) {
    purgeStoredVisitorId(o.storage);
    if (!o.memory.id) o.memory.id = o.uuid();
    return { id: o.memory.id, isNew: true };
  }
  try {
    const existing = o.storage?.getItem(VISITOR_KEY);
    if (existing) return { id: existing, isNew: false };
    const id = o.uuid();
    o.storage?.setItem(VISITOR_KEY, id);
    return { id, isNew: true };
  } catch {
    return { id: o.uuid(), isNew: true };
  }
}

/** Remove a persisted visitor ID (kids routes must not keep one). */
export function purgeStoredVisitorId(storage: Pick<Storage, 'removeItem'> | null): void {
  try {
    storage?.removeItem(VISITOR_KEY);
  } catch {
    /* storage unavailable: nothing to remove */
  }
}

/** Analytics is allowed on this path (everything except kids routes). */
export function analyticsAllowed(pathname: string | undefined, isKids: (p: string) => boolean): boolean {
  return !(pathname && isKids(pathname));
}
