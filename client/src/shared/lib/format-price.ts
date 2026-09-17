const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Formats a minor-unit amount (cents) as a display price, e.g. 2900 -> "$29". */
export const formatPrice = (amountInCents: number): string =>
  priceFormatter.format(amountInCents / 100);
