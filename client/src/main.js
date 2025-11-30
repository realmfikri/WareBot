const gridElement = document.getElementById('grid');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const robotList = document.getElementById('robot-list');

let socket;
let grid = [];
let robots = [];
let tiles = [];

function setStatus(online) {
  statusIndicator.classList.toggle('online', online);
  statusIndicator.classList.toggle('offline', !online);
  statusText.textContent = online ? 'Connected' : 'Disconnected';
}

function buildGrid(size) {
  gridElement.style.gridTemplateColumns = `repeat(${size}, minmax(40px, 1fr))`;
  gridElement.innerHTML = '';
  tiles = [];

  for (let y = 0; y < size; y += 1) {
    const row = [];
    for (let x = 0; x < size; x += 1) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.dataset.x = x;
      tile.dataset.y = y;

      const content = document.createElement('div');
      content.className = 'content';

      const status = document.createElement('div');
      status.className = 'status';
      status.textContent = '';

      const label = document.createElement('div');
      label.className = 'label';
      label.textContent = `${String.fromCharCode(65 + y)}${x + 1}`;

      content.appendChild(status);
      content.appendChild(label);
      tile.appendChild(content);

      tile.addEventListener('click', () => sendObstacleToggle(x, y));

      gridElement.appendChild(tile);
      row.push({ tile, status });
    }
    tiles.push(row);
  }
}

function ensureGridSize(size) {
  if (tiles.length === size) return;
  buildGrid(size);
}

function pathLookup() {
  const lookup = new Map();
  robots.forEach((robot) => {
    robot.path?.forEach((node) => {
      const key = `${node.x},${node.y}`;
      lookup.set(key, (lookup.get(key) || 0) + 1);
    });
    const startKey = `${robot.position.x},${robot.position.y}`;
    const goalKey = `${robot.target.x},${robot.target.y}`;
    lookup.set(startKey, (lookup.get(startKey) || 0) + 1);
    lookup.set(goalKey, (lookup.get(goalKey) || 0) + 1);
  });
  return lookup;
}

function renderTile(x, y, lookup = pathLookup()) {
  const tileData = tiles[y]?.[x];
  const cell = grid[y]?.[x];
  if (!tileData || !cell) return;

  const { tile, status } = tileData;
  const key = `${x},${y}`;
  const pathCount = lookup.get(key) || 0;

  const robotAtStart = robots.find((robot) => robot.position.x === x && robot.position.y === y);
  const robotAtGoal = robots.find((robot) => robot.target.x === x && robot.target.y === y);

  tile.classList.toggle('obstacle', cell.obstacle);
  tile.classList.toggle('path', pathCount > 0 && !cell.obstacle);
  tile.classList.toggle('start', Boolean(robotAtStart));
  tile.classList.toggle('goal', Boolean(robotAtGoal));

  if (cell.obstacle) {
    status.textContent = 'Obstacle';
  } else if (robotAtStart) {
    status.textContent = `${robotAtStart.name} start (v${robotAtStart.speed ?? 1})`;
  } else if (robotAtGoal) {
    status.textContent = `${robotAtGoal.name} goal (v${robotAtGoal.speed ?? 1})`;
  } else if (pathCount > 0) {
    status.textContent = `Path x${pathCount}`;
  } else {
    status.textContent = '';
  }
}

function renderGrid() {
  if (!grid.length) return;
  const lookup = pathLookup();
  ensureGridSize(grid.length);
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[y].length; x += 1) {
      renderTile(x, y, lookup);
    }
  }
}

function applyCell(x, y, cell) {
  if (!grid[y]) grid[y] = [];
  grid[y][x] = cell;
  renderTile(x, y);
}

function renderRobotList() {
  if (!robotList) return;
  robotList.innerHTML = '';

  robots.forEach((robot) => {
    const card = document.createElement('div');
    card.className = 'robot-card';

    const title = document.createElement('h3');
    title.textContent = robot.name;
    card.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'robot-meta';

    const speed = document.createElement('div');
    speed.textContent = `Speed: ${robot.speed ?? 1}`;
    const start = document.createElement('div');
    start.textContent = `Position: (${robot.position?.x ?? 0}, ${robot.position?.y ?? 0})`;
    const target = document.createElement('div');
    target.textContent = `Target: (${robot.target?.x ?? 0}, ${robot.target?.y ?? 0})`;
    const path = document.createElement('div');
    path.textContent = `Path nodes: ${robot.path?.length ?? 0}`;

    meta.appendChild(speed);
    meta.appendChild(start);
    meta.appendChild(target);
    meta.appendChild(path);
    card.appendChild(meta);

    robotList.appendChild(card);
  });
}

function syncRobots(nextRobots) {
  robots = nextRobots || [];
  renderRobotList();
  renderGrid();
}

function handleSnapshot(payload) {
  grid = payload.grid || [];
  syncRobots(payload.robots || []);
}

function handleCellUpdate(payload) {
  applyCell(payload.x, payload.y, payload.cell);
}

function handleRobotPaths(payload) {
  syncRobots(payload.robots || []);
}

function connect() {
  socket = new WebSocket('ws://localhost:8080');

  socket.addEventListener('open', () => setStatus(true));

  socket.addEventListener('close', () => {
    setStatus(false);
    setTimeout(connect, 1500);
  });

  socket.addEventListener('message', (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.type === 'EventStateSnapshot') {
        handleSnapshot(payload);
      }
      if (payload.type === 'EventGridCellUpdated') {
        handleCellUpdate(payload);
      }
      if (payload.type === 'EventRobotPathsUpdated') {
        handleRobotPaths(payload);
      }
      if (payload.type === 'EventRobotListUpdated') {
        handleRobotPaths(payload);
      }
    } catch (error) {
      console.error('Failed to parse message', error);
    }
  });
}

function sendObstacleToggle(x, y) {
  const cell = grid?.[y]?.[x];
  const type = cell?.obstacle ? 'EventObstacleCleared' : 'EventObstacleCreated';
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type, x, y }));
  }
}

setStatus(false);
connect();
