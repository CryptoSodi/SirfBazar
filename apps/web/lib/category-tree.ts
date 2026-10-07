export type CategoryNode = { id: string; name: string; slug: string; children?: CategoryNode[] };
export function flattenCategories(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.flatMap(node => [node, ...flattenCategories(node.children ?? [])]);
}
