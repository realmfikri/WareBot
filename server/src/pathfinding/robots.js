const { findPath } = require('./aStar');

class Mutex {
  constructor() {
    this.lock = Promise.resolve();
  }

  runExclusive(fn) {
    const next = this.lock.then(fn, fn);
    this.lock = next.then(() => undefined, () => undefined);
    return next;
  }
}

class RobotManager {
  constructor(grid) {
    this.grid = grid;
    this.robots = new Map();
    this.mutex = new Mutex();
  }

  _recalculatePath(robot) {
    const path = findPath(this.grid, robot.position, robot.target);
    robot.path = path || [];
    robot.lastCalculated = Date.now();
    return robot.path;
  }

  addRobot(robot) {
    return this.mutex.runExclusive(() => {
      const robotState = {
        ...robot,
        speed: robot.speed ?? 1,
        path: []
      };
      this._recalculatePath(robotState);
      this.robots.set(robotState.id, robotState);
      return robotState;
    });
  }

  removeRobot(id) {
    return this.mutex.runExclusive(() => this.robots.delete(id));
  }

  recalculatePath(id) {
    return this.mutex.runExclusive(() => {
      const robot = this.robots.get(id);
      if (!robot) return null;
      return this._recalculatePath(robot);
    });
  }

  recalculateAll() {
    return this.mutex.runExclusive(() => {
      this.robots.forEach((robot) => {
        this._recalculatePath(robot);
      });
    });
  }

  recalculateImpactedByCell(x, y) {
    return this.mutex.runExclusive(() => {
      let changed = false;
      this.robots.forEach((robot) => {
        const hasPath = Array.isArray(robot.path) && robot.path.length > 0;
        const intersectsPath = robot.path?.some((node) => node.x === x && node.y === y);
        const intersectsEndpoints =
          (robot.position.x === x && robot.position.y === y) ||
          (robot.target.x === x && robot.target.y === y);

        if (!hasPath || intersectsPath || intersectsEndpoints) {
          this._recalculatePath(robot);
          changed = true;
        }
      });
      return changed;
    });
  }

  updateRobotTarget(id, target) {
    return this.mutex.runExclusive(() => {
      const robot = this.robots.get(id);
      if (!robot) return null;
      robot.target = target;
      return this._recalculatePath(robot);
    });
  }

  updateRobotSpeed(id, speed) {
    return this.mutex.runExclusive(() => {
      const robot = this.robots.get(id);
      if (!robot) return null;
      robot.speed = speed;
      return robot;
    });
  }

  serialize() {
    return this.mutex.runExclusive(() =>
      Array.from(this.robots.values()).map((robot) => ({
        ...robot,
        path: robot.path?.map((node) => ({ ...node })) || []
      }))
    );
  }
}

module.exports = { RobotManager };
