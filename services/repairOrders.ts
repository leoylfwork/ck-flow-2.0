import {
  Attachment,
  AttachmentDTO,
  Bay,
  CalendarEvent,
  LogEntry,
  LogEntryDTO,
  PaymentMethod,
  PaymentStatus,
  PersistedStatus,
  RepairOrder,
  RepairOrderDTO,
  RepairOrderUpdateDTO,
  RepairOrderViewStatus,
  ROStatus,
  STORED_STATUSES,
  WorkType,
} from '../types';

const allRoles = ['ADVISOR', 'FOREMAN', 'OWNER'] as const;

export const ARCHIVED_VIEW_STATUS: RepairOrderViewStatus = 'ARCHIVED';

/** Single source of truth for archived: DONE + paymentStatus in ('paid','voided'). Falls back to paymentMethod+settledAt when paymentStatus absent (backward compat). */
export const isRepairOrderArchived = (ro: RepairOrder | RepairOrderDTO): boolean => {
  if (ro.status !== ROStatus.DONE) return false;
  const ps = (ro as RepairOrderDTO).paymentStatus;
  if (ps === 'paid' || ps === 'voided') return true;
  return Boolean(ro.paymentMethod && ro.settledAt);
};

export const getRepairOrderViewStatus = (ro: RepairOrder): RepairOrderViewStatus =>
  isRepairOrderArchived(ro) ? ARCHIVED_VIEW_STATUS : ro.status;

export const getAttachmentSource = (attachment: Attachment): string | undefined =>
  attachment.url || attachment.previewUrl;

export const attachmentToDTO = (attachment: Attachment): AttachmentDTO => ({
  id: attachment.id,
  name: attachment.name,
  mimeType: attachment.type,
  url: attachment.url,
  storageKey: attachment.storageKey,
  sizeBytes: attachment.sizeBytes,
});

export const attachmentFromDTO = (attachment: AttachmentDTO): Attachment => ({
  id: attachment.id,
  name: attachment.name,
  type: attachment.mimeType,
  url: attachment.url,
  storageKey: attachment.storageKey,
  sizeBytes: attachment.sizeBytes,
});

const logEntryToDTO = (log: LogEntry): LogEntryDTO => ({ ...log });
const logEntryFromDTO = (log: LogEntryDTO): LogEntry => ({ ...log });

const toPersistedStatus = (status: ROStatus): PersistedStatus =>
  STORED_STATUSES.includes(status) ? (status as PersistedStatus) : ROStatus.TODO;

export const repairOrderToDTO = (ro: RepairOrder): RepairOrderDTO => ({
  id: ro.id,
  model: ro.model,
  vin: ro.vin,
  customerName: ro.customerName,
  phone: ro.phone,
  info: ro.info,
  status: toPersistedStatus(ro.status),
  urgent: ro.urgent,
  bayId: ro.bayId,
  totalTimeInBay: ro.totalTimeInBay,
  lastEnteredBayAt: ro.lastEnteredBayAt,
  paymentMethod: ro.paymentMethod,
  paymentAmount: ro.paymentAmount,
  paymentStatus: ro.paymentStatus,
  settledAt: ro.settledAt,
  logs: ro.logs.map(logEntryToDTO),
  aiChat: ro.aiChat.map(logEntryToDTO),
  isInsuranceCase: ro.isInsuranceCase,
  attachments: ro.attachments?.map(attachmentToDTO),
  calendarEventId: ro.calendarEventId,
  mileage: ro.mileage,
  deliveryDate: ro.deliveryDate,
  crossShopActive: ro.crossShopActive,
  secondaryStatus: ro.secondaryStatus,
  workType: ro.workType,
  decodedData: ro.decodedData,
});

export const repairOrderFromDTO = (
  dto: RepairOrderDTO,
  index = 0,
): RepairOrder => ({
  ...dto,
  order: index,
  lastReadInfo: { ADVISOR: '', FOREMAN: '', OWNER: '' },
  unreadBy: [...allRoles],
  logs: dto.logs.map(logEntryFromDTO),
  aiChat: dto.aiChat.map(logEntryFromDTO),
  attachments: dto.attachments?.map(attachmentFromDTO),
});

export const createRepairOrderLogEntry = (
  user: string,
  text: string,
  type: LogEntry['type'] = 'USER',
  imageUrl?: string,
): LogEntry => ({
  id: Math.random().toString(36).substr(2, 9),
  timestamp: new Date().toISOString(),
  user,
  text,
  type,
  imageUrl,
});

export const appendRepairOrderLog = (
  repairOrders: RepairOrder[],
  roId: string,
  log: LogEntry,
  targetRoles: string[],
): RepairOrder[] =>
  repairOrders.map((ro) => {
    if (ro.id !== roId) return ro;
    const unreadBy = [...new Set([...ro.unreadBy, ...targetRoles])];
    return { ...ro, logs: [...ro.logs, log], unreadBy };
  });

export const appendRepairOrder = (
  repairOrders: RepairOrder[],
  repairOrder: RepairOrder,
): RepairOrder[] => [...repairOrders, repairOrder];

export const appendRepairOrderAiLog = (
  repairOrders: RepairOrder[],
  roId: string,
  log: LogEntry,
  targetRoles: string[],
): RepairOrder[] =>
  repairOrders.map((ro) => {
    if (ro.id !== roId) return ro;
    const unreadBy = [...new Set([...ro.unreadBy, ...targetRoles])];
    return { ...ro, aiChat: [...ro.aiChat, log], unreadBy };
  });

export const markRepairOrderAsRead = (
  repairOrders: RepairOrder[],
  roId: string,
  userRole: string,
): RepairOrder[] =>
  repairOrders.map((ro) => {
    if (ro.id !== roId) return ro;
    return {
      ...ro,
      unreadBy: ro.unreadBy.filter((role) => role !== userRole),
      lastReadInfo: { ...ro.lastReadInfo, [userRole]: ro.info },
    };
  });

export const updateRepairOrderRecord = (
  repairOrders: RepairOrder[],
  id: string,
  updates: Partial<RepairOrder>,
  targetRoles: string[],
  selectedROId: string | null,
): { repairOrders: RepairOrder[]; nextSelectedROId: string | null } => {
  let nextSelectedROId = selectedROId;
  const nextRepairOrders = repairOrders.map((item) => {
    if (item.id !== id) return item;
    if (updates.id && updates.id !== id && selectedROId === id) {
      nextSelectedROId = updates.id;
    }
    const unreadBy = [...new Set([...item.unreadBy, ...targetRoles])];
    return { ...item, ...updates, unreadBy };
  });

  return { repairOrders: nextRepairOrders, nextSelectedROId };
};

export const moveRepairOrderToSection = (
  repairOrders: RepairOrder[],
  roId: string,
  status: ROStatus,
  gridPosition?: number,
): RepairOrder[] => {
  const evictedId =
    gridPosition !== undefined
      ? repairOrders.find(
          (ro) => ro.id !== roId && ro.status === status && ro.gridPosition === gridPosition,
        )?.id
      : undefined;

  return repairOrders.map((item) => {
    if (item.id === roId) return { ...item, status, gridPosition };
    if (item.id === evictedId && gridPosition !== undefined) {
      return { ...item, gridPosition: undefined };
    }
    return item;
  });
};

export const moveRepairOrderToBay = (
  repairOrders: RepairOrder[],
  bays: Bay[],
  roId: string,
  bayId: number,
  now = Date.now(),
): { repairOrders: RepairOrder[]; bays: Bay[]; nextStatus?: ROStatus } => {
  const targetBay = bays.find((bay) => bay.id === bayId);
  const ro = repairOrders.find((item) => item.id === roId);
  if (!ro) return { repairOrders, bays };

  let nextStatus = ro.status;
  if (targetBay?.workType === 'MECHANIC') {
    nextStatus = ROStatus.IN_PROGRESS;
  } else if (targetBay?.workType === 'BODY') {
    if (bayId === 7) nextStatus = ROStatus.BODY_WORK;
    else if (bayId === 8) nextStatus = ROStatus.PAINTING;
    else if (bayId === 9) nextStatus = ROStatus.MECHANIC_WORK;
  }

  const timeInPrevBay = ro.lastEnteredBayAt ? now - ro.lastEnteredBayAt : 0;
  const totalTimeInBay = ro.totalTimeInBay + timeInPrevBay;

  return {
    repairOrders: repairOrders.map((item) =>
      item.id === roId
        ? {
            ...item,
            status: nextStatus,
            bayId,
            lastEnteredBayAt: now,
            totalTimeInBay,
            gridPosition: undefined,
          }
        : item,
    ),
    bays: bays.map((bay) => ({
      ...bay,
      currentROId: bay.id === bayId ? roId : bay.currentROId === roId ? undefined : bay.currentROId,
    })),
    nextStatus,
  };
};

export const releaseRepairOrderFromBay = (
  repairOrders: RepairOrder[],
  bays: Bay[],
  roId: string,
  nextStatus: ROStatus,
  now = Date.now(),
): {
  repairOrders: RepairOrder[];
  bays: Bay[];
  sessionDurationMs: number;
  totalDurationMs: number;
} => {
  const ro = repairOrders.find((item) => item.id === roId);
  if (!ro) {
    return { repairOrders, bays, sessionDurationMs: 0, totalDurationMs: 0 };
  }

  const sessionDurationMs = ro.lastEnteredBayAt ? now - ro.lastEnteredBayAt : 0;
  const totalDurationMs = ro.totalTimeInBay + sessionDurationMs;

  return {
    repairOrders: repairOrders.map((item) =>
      item.id === roId
        ? {
            ...item,
            status: nextStatus,
            bayId: undefined,
            lastEnteredBayAt: undefined,
            totalTimeInBay: totalDurationMs,
          }
        : item,
    ),
    bays: bays.map((bay) => ({
      ...bay,
      currentROId: bay.currentROId === roId ? undefined : bay.currentROId,
    })),
    sessionDurationMs,
    totalDurationMs,
  };
};

export const syncCalendarEventsToRepairOrders = (
  repairOrders: RepairOrder[],
  calendarEvents: CalendarEvent[],
  workType: WorkType,
): RepairOrder[] => {
  const today = new Date().toDateString();
  let changed = false;
  let nextRepairOrders = [...repairOrders];

  calendarEvents.forEach((event) => {
    if (new Date(event.start).toDateString() !== today) return;

    const existingRO = nextRepairOrders.find((ro) => ro.calendarEventId === event.id);
    if (!existingRO) {
      nextRepairOrders.push({
        id: `CAL-${event.id.slice(0, 4).toUpperCase()}`,
        model: event.title,
        vin: 'CALENDAR_SYNC',
        customerName: 'Schedule Entry',
        phone: 'N/A',
        info: event.description || 'Synced from Calendar',
        status: ROStatus.TODO,
        urgent: false,
        order: nextRepairOrders.length,
        lastReadInfo: { ADVISOR: '', FOREMAN: '', OWNER: '' },
        totalTimeInBay: 0,
        unreadBy: [...allRoles],
        logs: [
          createRepairOrderLogEntry(
            'SYSTEM',
            'Zero-Touch: Auto-synced from Calendar for today.',
            'SYSTEM',
          ),
        ],
        aiChat: [],
        calendarEventId: event.id,
        workType,
      });
      changed = true;
      return;
    }

    if (existingRO.model !== event.title || existingRO.info !== event.description) {
      nextRepairOrders = nextRepairOrders.map((ro) =>
        ro.calendarEventId === event.id
          ? { ...ro, model: event.title, info: event.description }
          : ro,
      );
      changed = true;
    }
  });

  return changed ? nextRepairOrders : repairOrders;
};

export const buildRepairOrderFieldLogs = (
  repairOrder: RepairOrder,
  updates: Partial<RepairOrder>,
  getStatusLabel: (status: ROStatus) => string,
): string[] => {
  const fieldLogs: string[] = [];
  if (updates.id !== undefined && updates.id !== repairOrder.id) {
    fieldLogs.push(`RO changed: ${repairOrder.id} → ${updates.id}`);
  }
  if (updates.model !== undefined && updates.model !== repairOrder.model) {
    fieldLogs.push(`Model updated: ${updates.model}`);
  }
  if (updates.vin !== undefined && updates.vin !== repairOrder.vin) {
    fieldLogs.push(`VIN updated: ${updates.vin}`);
  }
  if (updates.customerName !== undefined && updates.customerName !== repairOrder.customerName) {
    fieldLogs.push(`Customer: ${updates.customerName}`);
  }
  if (updates.phone !== undefined && updates.phone !== repairOrder.phone) {
    fieldLogs.push(`Phone: ${updates.phone}`);
  }
  if (updates.urgent !== undefined && updates.urgent !== repairOrder.urgent) {
    fieldLogs.push(`Priority: ${updates.urgent ? 'URGENT' : 'NORMAL'}`);
  }
  if (updates.mileage !== undefined && updates.mileage !== repairOrder.mileage) {
    fieldLogs.push(`Odometer updated: ${updates.mileage} km`);
  }
  if (updates.info !== undefined && updates.info !== repairOrder.info) {
    const prevLines = repairOrder.info.split('\n').map((s) => s.trim()).filter(Boolean);
    const nextLines = updates.info.split('\n').map((s) => s.trim()).filter(Boolean);
    const added = nextLines.filter((line) => !prevLines.includes(line));
    const removed = prevLines.filter((line) => !nextLines.includes(line));
    if (added.length === 0 && removed.length === 0) {
      fieldLogs.push('Order notes updated.');
    } else {
      added.forEach((line) => fieldLogs.push(`Order note added: ${line}`));
      removed.forEach((line) => fieldLogs.push(`Order note removed: ${line}`));
    }
  }
  if (updates.status !== undefined && updates.status !== repairOrder.status) {
    fieldLogs.push(
      `Workflow updated: ${getStatusLabel(repairOrder.status)} → ${getStatusLabel(updates.status)}`,
    );
  }
  return fieldLogs;
};

/** Map UI payment method to backend paymentStatus for archived derivation. */
export const paymentMethodToStatus = (method: PaymentMethod): PaymentStatus =>
  method === 'ABANDONED' ? 'voided' : 'paid';

export const settleRepairOrder = (
  updates: Partial<RepairOrder>,
  paymentMethod: PaymentMethod,
  paymentAmount: number,
  settledAt = new Date().toISOString(),
): Partial<RepairOrder> => ({
  ...updates,
  status: ROStatus.DONE,
  paymentMethod,
  paymentAmount,
  paymentStatus: paymentMethodToStatus(paymentMethod),
  settledAt,
});

export const restoreArchivedRepairOrder = (): Partial<RepairOrder> => ({
  status: ROStatus.TODO,
  paymentMethod: undefined,
  paymentAmount: undefined,
  paymentStatus: undefined,
  settledAt: undefined,
});
