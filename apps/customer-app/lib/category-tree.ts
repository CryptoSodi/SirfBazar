type CategoryNode = { id: string; name: string; children?: CategoryNode[] };
export function findCategoryName(nodes: CategoryNode[], id: string): string | undefined {
  for (const node of nodes) {
    if (node.id === id) return node.name;
    const child = findCategoryName(node.children ?? [], id);
    if (child) return child;
  }
  return undefined;
}
