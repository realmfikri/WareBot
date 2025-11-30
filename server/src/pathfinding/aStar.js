function heuristic(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function buildPath(cameFrom, currentKey) {
  const path = [];
  let key = currentKey;
  while (key) {
    const node = cameFrom.get(key);
    if (!node) break;
    path.push(node.position);
    key = node.previous;
  }
  return path.reverse();
}

function serializePosition({ x, y }) {
  return `${x},${y}`;
}

function findPath(grid, start, goal) {
  if (!grid.inBounds(start.x, start.y) || !grid.inBounds(goal.x, goal.y)) {
    return null;
  }

  if (grid.getCell(start.x, start.y)?.obstacle || grid.getCell(goal.x, goal.y)?.obstacle) {
    return null;
  }

  const frontier = [{ position: start, priority: 0 }];
  const cameFrom = new Map();
  const costSoFar = new Map();

  cameFrom.set(serializePosition(start), { position: start, previous: null });
  costSoFar.set(serializePosition(start), 0);

  while (frontier.length > 0) {
    frontier.sort((a, b) => a.priority - b.priority);
    const current = frontier.shift();

    if (current.position.x === goal.x && current.position.y === goal.y) {
      return buildPath(cameFrom, serializePosition(current.position));
    }

    grid.neighbors(current.position.x, current.position.y).forEach((next) => {
      const newCost = costSoFar.get(serializePosition(current.position)) + 1;
      const nextKey = serializePosition(next);
      if (!costSoFar.has(nextKey) || newCost < costSoFar.get(nextKey)) {
        costSoFar.set(nextKey, newCost);
        const priority = newCost + heuristic(goal, next);
        frontier.push({ position: next, priority });
        cameFrom.set(nextKey, { position: next, previous: serializePosition(current.position) });
      }
    });
  }

  return null;
}

module.exports = { findPath };
