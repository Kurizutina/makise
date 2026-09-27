import { remainsVisibleForHours } from './backendTime';

describe('remainsVisibleForHours', () => {
  const now = Date.parse('2026-09-27T12:00:00.000Z');

  test('keeps active orders regardless of age', () => {
    expect(remainsVisibleForHours({ status: 'preparing', updatedAt: '2026-09-20T12:00:00.000Z' }, 12, now)).toBe(true);
  });

  test('removes completed transactions after 12 hours', () => {
    expect(remainsVisibleForHours({ status: 'delivered', updatedAt: '2026-09-27T00:01:00.000Z' }, 12, now)).toBe(true);
    expect(remainsVisibleForHours({ status: 'cancelled', updatedAt: '2026-09-27T00:00:00.000Z' }, 12, now)).toBe(false);
  });
});
