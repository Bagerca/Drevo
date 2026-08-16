// ФАЙЛ: graph-algo.js
export class GraphAlgo {
  static getFocusPath(store, targetId) {
    const allowed = new Set();
    
    const addDescendants = (id) => {
      if (!id || allowed.has(id)) return;
      allowed.add(id);
      const node = store.getPerson(id);
      if (node && node.partner) allowed.add(node.partner);
      
      // Спускаемся и по кровным, и по приемным
      if (node && node.children) node.children.forEach(addDescendants);
      if (node && node.stepChildren) node.stepChildren.forEach(addDescendants);
    };

    addDescendants(targetId);

    let queue = [targetId];
    let isImmediate = true;

    while (queue.length > 0) {
      const currentId = queue.shift();
      const parentIds = store.parentMap.get(currentId) || new Set();
      const stepParentIds = store.stepParentMap.get(currentId) || new Set();
      
      // Идем вверх и к кровным, и к отчимам
      const allParents = new Set([...parentIds, ...stepParentIds]);
      
      for (const parentId of allParents) {
        if (!allowed.has(parentId)) {
          allowed.add(parentId);
          queue.push(parentId);
          
          const parentNode = store.getPerson(parentId);
          if (parentNode && parentNode.partner) allowed.add(parentNode.partner);
          
          if (isImmediate && parentNode) {
            if (parentNode.children) parentNode.children.forEach(addDescendants);
            if (parentNode.stepChildren) parentNode.stepChildren.forEach(addDescendants);
          }
        }
      }
      isImmediate = false;
    }
    return allowed;
  }
}