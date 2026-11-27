export const normalizeSearchText = (text) => text.toLowerCase().normalize('NFD')
  .replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
