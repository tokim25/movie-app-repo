export function isTmdbPoster(poster) {
  return typeof poster?.u === 'string' &&
    /^https:\/\/image\.tmdb\.org\/t\/p\/w500\/[\da-zA-Z]+\.(?:jpg|png)$/.test(poster.u) &&
    Number.isSafeInteger(poster.id) && poster.id > 0 &&
    Number.isSafeInteger(poster.w) && poster.w > 0 &&
    Number.isSafeInteger(poster.h) && poster.h > poster.w;
}
