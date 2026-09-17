const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

const chartDayFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export const formatDate = (iso: string): string =>
  dateFormatter.format(new Date(iso));

/** `YYYY-MM-DD` from the analytics RPC, formatted for the chart axis. */
export const formatChartDay = (isoDate: string): string =>
  chartDayFormatter.format(new Date(`${isoDate}T00:00:00Z`));
