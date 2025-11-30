const GRID_SIZE = 10;
const gridElement = document.getElementById('grid');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');

const tiles = [];

function setStatus(online) {
  statusIndicator.classList.toggle('online', online);
  statusIndicator.classList.toggle('offline', !online);
  statusText.textContent = online ? 'Connected' : 'Disconnected';
}

function createGrid() {
  gridElement.style.gridTemplateColumns = `repeat(${GRID_SIZE}, minmax(40px, 1fr))`;
  gridElement.innerHTML = '';
  for (let y = 0; y < GRID_SIZE; y += 1) {
    const row = [];
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.dataset.x = x;
      tile.dataset.y = y;

      const content = document.createElement('div');
      content.className = 'content';

      const load = document.createElement('div');
      load.className = 'load';
      load.textContent = '-';

      const label = document.createElement('div');
      label.className = 'label';
      label.textContent = `${String.fromCharCode(65 + y)}${x + 1}`;

      content.appendChild(load);
      content.appendChild(label);
      tile.appendChild(content);

      tile.addEventListener('click', () => sendToggle(x, y));

      gridElement.appendChild(tile);
      row.push({ tile, load });
    }
    tiles.push(row);
  }
}

let socket;

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
      if (payload.type === 'state' && Array.isArray(payload.grid)) {
        renderGrid(payload.grid);
      }
      if (payload.type === 'cell') {
        applyCell(payload.x, payload.y, payload.cell);
      }
    } catch (error) {
      console.error('Failed to parse message', error);
    }
  });
}

function renderGrid(grid) {
  grid.forEach((row, y) => {
    row.forEach((cell, x) => applyCell(x, y, cell));
  });
}

function applyCell(x, y, cell) {
  const tile = tiles[y]?.[x];
  if (!tile) return;

  const { tile: element, load } = tile;
  element.classList.toggle('active', cell.active);
  element.classList.toggle('offline', !cell.active);
  load.textContent = `${cell.load}%`;
}

function sendToggle(x, y) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'toggle', x, y }));
  }
}

createGrid();
setStatus(false);
connect();
