export const CALENDAR_PROVIDER = Symbol('CALENDAR_PROVIDER');

export interface CalendarEventData {
  eventId: string;
  title: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  meetingCode: string | null;
}

export interface CalendarProviderPort {
  getDailyEvent(
    meetingCode: string,
    date?: Date,
  ): Promise<CalendarEventData | null>;
}
