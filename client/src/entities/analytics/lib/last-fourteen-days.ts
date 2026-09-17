import type { MessagesByDay } from "../model/types";

const DAYS = 14;

const utcDay = (offset: number): string => {
  const now = new Date();
  const date = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - offset,
    ),
  );

  return date.toISOString().slice(0, 10);
};

export const lastFourteenDays = (series: MessagesByDay[]): MessagesByDay[] => {
  const byDay = new Map(series.map((item) => [item.day, item.count]));

  return Array.from({ length: DAYS }, (_, index) => {
    const day = utcDay(DAYS - 1 - index);

    return { day, count: byDay.get(day) ?? 0 };
  });
};
