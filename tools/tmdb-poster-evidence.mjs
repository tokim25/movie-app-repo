import fs from 'node:fs';
import { isTmdbPoster } from '../scripts/poster-sources.mjs';
import { hasVerifiedImageHeaders } from './enrich-catalog-candidates.mjs';

export function verifyTmdbPoster(poster, receiptPath, film) {
  if (!isTmdbPoster(poster) || !receiptPath) throw new Error(`Invalid TMDB poster or missing receipt for ${film}`);
  const receipt = fs.readFileSync(receiptPath, 'utf8').trimEnd();
  const lastLine = receipt.lastIndexOf('\n');
  if (receipt.slice(lastLine + 1) !== poster.u || !hasVerifiedImageHeaders(receipt.slice(0, lastLine))) {
    throw new Error(`Unverified TMDB poster URL or image headers for ${film}`);
  }
}
