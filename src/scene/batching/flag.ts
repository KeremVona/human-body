/** Returns true unless the query string explicitly sets `?batching=off`. */
export function batchingEnabled(search: string): boolean {
  return new URLSearchParams(search).get('batching') !== 'off';
}
