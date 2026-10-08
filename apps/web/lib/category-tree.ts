export type CategoryNode = { id: string; name: string; slug: string; children?: CategoryNode[] };
export function flattenCategories(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.flatMap(node => [node, ...flattenCategories(node.children ?? [])]);
}

export function categoryPath(nodes: CategoryNode[], selected: string): CategoryNode[] {
  for (const node of nodes) {
    if (node.id === selected || node.slug === selected) return [node];
    const children = categoryPath(node.children ?? [], selected);
    if (children.length) return [node, ...children];
  }
  return [];
}
