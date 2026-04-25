/**
 * Verifica si dos strings son anagramas (mismos caracteres, diferente orden).
 */
function isAnagram(s1, s2) {
  if (s1.length !== s2.length) return false;
  return s1.split('').sort().join('') === s2.split('').sort().join('');
}

/**
 * Retorna un score de similitud entre 0 y 1 (1 = idénticos).
 * Los anagramas reciben un boost de score (0.95) para priorizarlos en el matching.
 */
export function levenshteinScore(a, b) {
  const s1 = (a || '').toLowerCase().trim();
  const s2 = (b || '').toLowerCase().trim();
  if (s1 === s2) return 1;
  if (!s1.length || !s2.length) return 0;

  // Boost para anagramas: priorizar patentes con mismos caracteres en diferente orden
  if (isAnagram(s1, s2)) return 0.95;

  const matrix = Array.from({ length: s2.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= s1.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      matrix[i][j] = s2[i - 1] === s1[j - 1]
        ? matrix[i - 1][j - 1]
        : 1 + Math.min(matrix[i - 1][j - 1], matrix[i][j - 1], matrix[i - 1][j]);
    }
  }

  return 1 - matrix[s2.length][s1.length] / Math.max(s1.length, s2.length);
}
