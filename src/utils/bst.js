/**
 * Binary Search Tree para indexar claves normalizadas del ED.
 * Provee búsqueda exacta O(log n) promedio.
 */

function bstInsert(node, key) {
  if (!node) return { key, left: null, right: null };
  if (key < node.key) node.left = bstInsert(node.left, key);
  else if (key > node.key) node.right = bstInsert(node.right, key);
  return node;
}

function bstSearch(node, target) {
  if (!node) return null;
  if (target === node.key) return node.key;
  return target < node.key ? bstSearch(node.left, target) : bstSearch(node.right, target);
}

/**
 * Construye un BST a partir de un array de claves.
 * @param {string[]} keys
 * @returns {{ root: object, search: (target: string) => string|null }}
 */
export function buildBSTIndex(keys) {
  let root = null;
  for (const key of keys) {
    root = bstInsert(root, key);
  }
  return {
    root,
    search: (target) => bstSearch(root, target),
  };
}
