/**
 * The allowed-domains list is edited as a single comma-separated field:
 * `example.com, app.example.com` <-> `["example.com", "app.example.com"]`.
 */
export const parseDomainList = (value: string): string[] => [
  ...new Set(
    value
      .split(",")
      .map((domain) => domain.trim().toLowerCase())
      .filter((domain) => domain.length > 0),
  ),
];

export const formatDomainList = (domains: string[]): string =>
  domains.join(", ");
