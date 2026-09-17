export const embedKeyOf = (publicKey: string): string =>
  publicKey.startsWith("pk_live_") ? publicKey : `pk_live_${publicKey}`;

export const snippetOf = (origin: string, publicKey: string): string =>
  `<script src="${origin}/embed.js" data-bot="${embedKeyOf(publicKey)}" async></script>`;
