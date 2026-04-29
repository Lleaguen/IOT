/**
 * Ordena candidatos por score descendente usando Bubble Sort.
 * Incluye early termination cuando el array ya está ordenado.
 *
 * @param {Array<{score: number}>} candidates - array mutable
 * @returns {Array<{score: number}>} mismo array ordenado in-place
 */
export function bubbleSortCandidates(candidates) {
  const n = candidates.length;
  for (let i = 0; i < n - 1; i++) {
    let swapped = false;
    for (let j = 0; j < n - i - 1; j++) {
      if (candidates[j].score < candidates[j + 1].score) {
        const tmp = candidates[j];
        candidates[j] = candidates[j + 1];
        candidates[j + 1] = tmp;
        swapped = true;
      }
    }
    if (!swapped) break; // early termination
  }
  return candidates;
}
