import {
  formatRaceDate,
  formatRaceTime,
  formatDiffShort,
  truncateName,
  podiumEmoji,
  isRezagado,
  gridEntryVisualRole,
  PODIUM_EMOJI,
  ELLIPSIS,
} from '../race-formatters';

describe('race-formatters', () => {
  describe('formatRaceDate', () => {
    it('formats date in spanish, long form, Madrid timezone', () => {
      const date = new Date('2026-04-28T07:30:00Z'); // 09:30 Madrid
      const result = formatRaceDate(date);
      expect(result).toContain('martes');
      expect(result).toContain('28');
      expect(result).toContain('abril');
      expect(result).toContain('2026');
    });
  });

  describe('formatRaceTime', () => {
    it('formats time as HH:mm:ss in Madrid timezone', () => {
      const date = new Date('2026-04-28T07:30:15Z'); // 09:30:15 Madrid
      expect(formatRaceTime(date)).toBe('09:30:15');
    });
  });

  describe('formatDiffShort', () => {
    it('formats positive diff under 60s', () => {
      expect(formatDiffShort(5.123)).toBe('+5.123');
      expect(formatDiffShort(0.5)).toBe('+0.500');
    });

    it('formats negative diff', () => {
      expect(formatDiffShort(-15.5)).toBe('-15.500');
    });

    it('formats diff over 60s as min:sec.ms', () => {
      expect(formatDiffShort(90.5)).toBe('+1:30.500');
      expect(formatDiffShort(-125)).toBe('-2:05.000');
    });

    it('formats zero', () => {
      expect(formatDiffShort(0)).toBe('+0.000');
    });
  });

  describe('truncateName', () => {
    it('returns name unchanged when within max', () => {
      expect(truncateName('Short', 10)).toBe('Short');
    });

    it('truncates with ellipsis when too long', () => {
      expect(truncateName('Very Long Name Here', 10)).toBe('Very Long' + ELLIPSIS);
    });

    it('handles exact length without truncating', () => {
      expect(truncateName('1234567890', 10)).toBe('1234567890');
    });
  });

  describe('podiumEmoji', () => {
    it('returns gold/silver/bronze for ranks 1-3', () => {
      expect(podiumEmoji(1)).toBe(PODIUM_EMOJI.GOLD);
      expect(podiumEmoji(2)).toBe(PODIUM_EMOJI.SILVER);
      expect(podiumEmoji(3)).toBe(PODIUM_EMOJI.BRONZE);
    });

    it('returns null for ranks outside podium', () => {
      expect(podiumEmoji(4)).toBeNull();
      expect(podiumEmoji(0)).toBeNull();
    });
  });

  describe('isRezagado', () => {
    it('marks bottom 10% as rezagado', () => {
      // 20 drivers · last 2 are rezagados (positions 20, 19)
      expect(isRezagado(19, 20)).toBe(true);
      expect(isRezagado(20, 20)).toBe(true);
      expect(isRezagado(18, 20)).toBe(false);
    });

    it('handles edge case of empty grid', () => {
      expect(isRezagado(1, 0)).toBe(false);
    });

    it('handles tiny grids without rezagados', () => {
      // 5 drivers · floor(5*0.1)=0 · no rezagados
      expect(isRezagado(5, 5)).toBe(false);
    });
  });

  describe('gridEntryVisualRole', () => {
    it('classifies podium positions', () => {
      expect(
        gridEntryVisualRole({ position: 1, isFalseStart: false, isWorstOnGrid: false }),
      ).toBe('podium-gold');
      expect(
        gridEntryVisualRole({ position: 2, isFalseStart: false, isWorstOnGrid: false }),
      ).toBe('podium-silver');
      expect(
        gridEntryVisualRole({ position: 3, isFalseStart: false, isWorstOnGrid: false }),
      ).toBe('podium-bronze');
    });

    it('classifies false start variants', () => {
      expect(
        gridEntryVisualRole({ position: 18, isFalseStart: true, isWorstOnGrid: true }),
      ).toBe('busted-false-start');
      expect(
        gridEntryVisualRole({ position: 17, isFalseStart: true, isWorstOnGrid: false }),
      ).toBe('false-start');
    });

    it('classifies busted clean (not false start, but worst)', () => {
      expect(
        gridEntryVisualRole({
          position: 5,
          isFalseStart: false,
          isWorstOnGrid: true,
          cleanGridSize: 20,
        }),
      ).toBe('busted-clean');
    });

    it('classifies rezagado when bottom 10%', () => {
      expect(
        gridEntryVisualRole({
          position: 19,
          isFalseStart: false,
          isWorstOnGrid: false,
          cleanGridSize: 20,
        }),
      ).toBe('rezagado');
    });

    it('falls back to normal for mid positions', () => {
      expect(
        gridEntryVisualRole({
          position: 5,
          isFalseStart: false,
          isWorstOnGrid: false,
          cleanGridSize: 20,
        }),
      ).toBe('normal');
    });
  });
});
