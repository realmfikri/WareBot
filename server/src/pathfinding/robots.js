const { findPath } = require('./aStar');

class RobotManager {
  constructor(grid) {
    this.grid = grid;
    this.robots = new Map();
  }

  addRobot(robot) {
    this.robots.set(robot.id, { ...robot, path: [] });
    this.recalculatePath(robot.id);
  }

  recalculatePath(id) {
    const robot = this.robots.get(id);
    if (!robot) return null;
    const path = findPath(this.grid, robot.position, robot.target);
    robot.path = path || [];
    robot.lastCalculated = Date.now();
    return robot.path;
  }

  recalculateAll() {
    this.robots.forEach((_, id) => {
      this.recalculatePath(id);
    });
  }

  recalculateImpactedByCell(x, y) {
    let changed = false;
    this.robots.forEach((robot) => {
      const hasPath = Array.isArray(robot.path) && robot.path.length > 0;
      const intersectsPath = robot.path?.some((node) => node.x === x && node.y === y);
      const intersectsEndpoints =
        (robot.position.x === x && robot.position.y === y) ||
        (robot.target.x === x && robot.target.y === y);

      if (!hasPath || intersectsPath || intersectsEndpoints) {
        this.recalculatePath(robot.id);
        changed = true;
      }
    });
    return changed;
  }

  updateRobotTarget(id, target) {
    const robot = this.robots.get(id);
    if (!robot) return null;
    robot.target = target;
    return this.recalculatePath(id);
  }

  serialize() {
    return Array.from(this.robots.values()).map((robot) => ({
      ...robot,
      path: robot.path?.map((node) => ({ ...node })) || []
    }));
  }
}

module.exports = { RobotManager };
