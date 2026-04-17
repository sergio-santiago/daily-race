import { Test } from '@nestjs/testing';
import { FindConferenceRecordService } from '../find-conference-record.service';
import {
  MEET_PROVIDER,
  MeetProviderPort,
  ConferenceRecordData,
} from '../../core/ports/meet.provider.port';
import { CalendarEventData } from '../../core/ports/calendar.provider.port';

function mockCalendarEvent(): CalendarEventData {
  return {
    eventId: 'event-1',
    title: 'Secture Daily',
    scheduledStart: new Date('2026-03-27T09:30:00.000Z'),
    scheduledEnd: new Date('2026-03-27T10:00:00.000Z'),
    meetingCode: 'wye-iwfu-jch',
  };
}

function mockRecord(): ConferenceRecordData {
  return {
    name: 'conferenceRecords/abc123',
    meetingCode: 'wye-iwfu-jch',
    startTime: new Date('2026-03-27T09:30:00.000Z'),
    endTime: new Date('2026-03-27T09:55:00.000Z'),
  };
}

describe('FindConferenceRecordService', () => {
  let service: FindConferenceRecordService;
  let meetProvider: jest.Mocked<MeetProviderPort>;

  beforeEach(async () => {
    meetProvider = {
      getConferenceRecords: jest.fn(),
      getParticipants: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        FindConferenceRecordService,
        { provide: MEET_PROVIDER, useValue: meetProvider },
      ],
    }).compile();

    service = module.get(FindConferenceRecordService);
  });

  it('should find a matching record for the same day', async () => {
    meetProvider.getConferenceRecords.mockResolvedValue([mockRecord()]);

    const result = await service.findForEvent(mockCalendarEvent());

    expect(result).not.toBeNull();
    expect(result!.name).toBe('conferenceRecords/abc123');
  });

  it('should return null when no records exist', async () => {
    meetProvider.getConferenceRecords.mockResolvedValue([]);

    const result = await service.findForEvent(mockCalendarEvent());

    expect(result).toBeNull();
  });

  it('should return null when meeting still in progress (no endTime)', async () => {
    meetProvider.getConferenceRecords.mockResolvedValue([
      { ...mockRecord(), endTime: null },
    ]);

    const result = await service.findForEvent(mockCalendarEvent());

    expect(result).toBeNull();
  });

  it('should return null when meeting ended before green light', async () => {
    meetProvider.getConferenceRecords.mockResolvedValue([
      {
        ...mockRecord(),
        startTime: new Date('2026-03-27T09:20:00.000Z'),
        endTime: new Date('2026-03-27T09:25:00.000Z'),
      },
    ]);

    const result = await service.findForEvent(mockCalendarEvent());

    expect(result).toBeNull();
  });

  it('should return null when record is from a different day', async () => {
    meetProvider.getConferenceRecords.mockResolvedValue([
      {
        ...mockRecord(),
        startTime: new Date('2026-03-26T09:30:00.000Z'),
        endTime: new Date('2026-03-26T09:55:00.000Z'),
      },
    ]);

    const result = await service.findForEvent(mockCalendarEvent());

    expect(result).toBeNull();
  });

  it('should pick the correct record when multiple exist', async () => {
    meetProvider.getConferenceRecords.mockResolvedValue([
      {
        name: 'conferenceRecords/old',
        meetingCode: 'wye-iwfu-jch',
        startTime: new Date('2026-03-26T09:30:00.000Z'),
        endTime: new Date('2026-03-26T09:55:00.000Z'),
      },
      mockRecord(),
    ]);

    const result = await service.findForEvent(mockCalendarEvent());

    expect(result!.name).toBe('conferenceRecords/abc123');
  });

  describe('findActiveForEvent', () => {
  it('should find an active record (no endTime) on the same day', async () => {
    meetProvider.getConferenceRecords.mockResolvedValue([
      {
        name: 'conferenceRecords/active1',
        meetingCode: 'wye-iwfu-jch',
        startTime: new Date('2026-03-27T09:31:00.000Z'),
        endTime: null,
      },
    ]);

    const result = await service.findActiveForEvent(mockCalendarEvent());

    expect(result).not.toBeNull();
    expect(result!.name).toBe('conferenceRecords/active1');
  });

  it('should return null when no active records exist', async () => {
    meetProvider.getConferenceRecords.mockResolvedValue([mockRecord()]);

    const result = await service.findActiveForEvent(mockCalendarEvent());

    expect(result).toBeNull();
  });

  it('should return null when active record is from a different day', async () => {
    meetProvider.getConferenceRecords.mockResolvedValue([
      {
        name: 'conferenceRecords/active-other-day',
        meetingCode: 'wye-iwfu-jch',
        startTime: new Date('2026-03-26T09:30:00.000Z'),
        endTime: null,
      },
    ]);

    const result = await service.findActiveForEvent(mockCalendarEvent());

    expect(result).toBeNull();
  });

  it('should reject active record too far from scheduled time (>30min)', async () => {
    meetProvider.getConferenceRecords.mockResolvedValue([
      {
        name: 'conferenceRecords/early-test',
        meetingCode: 'wye-iwfu-jch',
        startTime: new Date('2026-03-27T08:00:00.000Z'),
        endTime: null,
      },
    ]);

    const result = await service.findActiveForEvent(mockCalendarEvent());

    expect(result).toBeNull();
  });
  });

  describe('findByName', () => {
  it('should find a record by name', async () => {
    meetProvider.getConferenceRecords.mockResolvedValue([mockRecord()]);

    const result = await service.findByName(
      'wye-iwfu-jch',
      'conferenceRecords/abc123',
    );

    expect(result).not.toBeNull();
    expect(result!.name).toBe('conferenceRecords/abc123');
  });

  it('should return null when name does not match', async () => {
    meetProvider.getConferenceRecords.mockResolvedValue([mockRecord()]);

    const result = await service.findByName(
      'wye-iwfu-jch',
      'conferenceRecords/unknown',
    );

    expect(result).toBeNull();
  });
  });
});
