class Grid {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.cells = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => ({ obstacle: false, updatedAt: Date.now() }))
    );
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  getCell(x, y) {
    if (!this.inBounds(x, y)) return null;
    return this.cells[y][x];
  }

  setObstacle(x, y, obstacle) {
    const cell = this.getCell(x, y);
    if (!cell) return null;

    cell.obstacle = obstacle;
    cell.updatedAt = Date.now();
    return cell;
  }

  toggleObstacle(x, y) {
    const cell = this.getCell(x, y);
    if (!cell) return null;
    return this.setObstacle(x, y, !cell.obstacle);
  }

  neighbors(x, y) {
    const deltas = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ];

    return deltas
      .map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
      .filter(({ x: nx, y: ny }) => this.inBounds(nx, ny) && !this.getCell(nx, ny).obstacle);
  }

  serialize() {
    return this.cells.map((row) => row.map((cell) => ({ ...cell })));
  }
}

module.exports = { Grid };
