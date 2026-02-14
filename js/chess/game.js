let socket = null;
let chess = null;
let playerColor = 'white';
let gameActive = false;
let selectedSquare = null;
let currentGameId = null;
let playerRating = 1200;
let username = '';
let isAdmin = false;
let selectedBotDifficulty = 'medium';
let currentOpponent = null;
let chatHistory = [];
let currentChatTab = 'match';

const pieces = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
};

const botDifficultyRatings = {
  beginner: 800,
  easy: 1000,
  medium: 1200,
  hard: 1600,
  expert: 2000
};

const serverUrl = window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : 'https://theamazinggame.onrender.com';

document.addEventListener('DOMContentLoaded', async function () {
  // Wait for Chess.js to load
  const checkChess = setInterval(function () {
    if (typeof Chess !== 'undefined') {
      clearInterval(checkChess);
      console.log('Chess.js loaded successfully');
      initializeGame();
    }
  }, 100);

  // Timeout after 5 seconds
  setTimeout(function () {
    if (typeof Chess === 'undefined') {
      console.error('Chess.js failed to load');
      alert('Chess engine failed to load. Please refresh the page.');
    }
  }, 5000);
});
localStorage
async function initializeGame() {
  let moddUsername = await getModdIOUsername();
  const usernameInput = document.getElementById('username-input');

  if (usernameInput && moddUsername) {
    usernameInput.value = moddUsername;
  }

  connectSocket();

  setTimeout(function () {
    if (moddUsername) {
      login(moddUsername);
    }
  }, 1000);
}

async function getModdIOUsername() {
  const targetUrl = `https://modd.io/api/v1/user-by-name/${username}`;
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;

  fetch(proxyUrl)
    .then(response => {
      if (response.ok) return response.json();
      throw new Error('Network response was not ok.');
    })
    .then(data => {
      const userData = JSON.parse(data.contents);

      if (userData && userData.local) {
        console.log('heheheha:', userData);
        const uid = userData._id;
        if (userData.local.username === 'lurbs' && uid === '6821189b5fec3c6728c53bfe') {
          isAdmin = true;
        } else {
          isAdmin = false;
        }
        console.log('Is Admin:', isAdmin);
      }
    })
    .catch(error => console.error('Proxy Error:', error));

  // Check for llkasz- elements (admin/owner)
  const adminElements = document.querySelectorAll('[id^="llkasz-"]');
  for (let i = 0; i < adminElements.length; i++) {
    const id = adminElements[i].id;
    const parts = id.split('-');
    if (parts.length >= 3) {
      if (parts[1] === 'lurbs') {
        isAdmin = true;
        return 'lurbs';
      }
      isAdmin = false;
      return parts[1];
    }
  }

  const playerElements = document.querySelectorAll('[id^="jkasz-"]');
  for (let i = 0; i < playerElements.length; i++) {
    const id = playerElements[i].id;
    const parts = id.split('-');
    if (parts.length >= 3) {
      isAdmin = false;
      return parts[1];
    }
  }

  isAdmin = false;
  return 'guest-' + Math.floor(Math.random() * 9900 + 100);
}

// Helper function to get cookie value
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}

function connectSocket() {
  if (socket) {
    console.log('Socket already exists, disconnecting first');
    socket.disconnect();
  }

  console.log('Connecting to server:', serverUrl);
  socket = io(serverUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    upgrade: true,
    rememberUpgrade: true
  });

  socket.on('connect', function () {
    console.log('Socket connected successfully with ID:', socket.id);
  });

  socket.on('disconnect', function (reason) {
    console.log('Socket disconnected:', reason);
  });

  socket.on('connect_error', function (error) {
    console.error('Socket connection error:', error);
  });

  setupSocketHandlers();
}

function setupSocketHandlers() {
  socket.on('connect', function () {
    console.log('Connected to server');
  });

  socket.on('connect_error', function (err) {
    console.error('Connection error:', err);
  });

  socket.on('loginSuccess', function (data) {
    handleLoginSuccess(data);
  });

  socket.on('loginError', function (error) {
    alert('Login failed: ' + error);
  });

  socket.on('gameStart', function (data) {
    handleGameStart(data);
  });

  socket.on('moveMade', function (data) {
    handleMoveMade(data);
  });

  socket.on('gameEnd', function (data) {
    console.log('Received gameEnd:', data);
    handleGameEnd(data);
  });

  socket.on('timeUpdate', function (data) {
    updateTimeDisplay(data.timeWhite, data.timeBlack);
  });

  socket.on('invalidMove', function (data) {
    console.log('Invalid move received:', data);
    alert('Invalid move: ' + (data.error || 'Unknown error'));
  });

  socket.on('chatMessage', function (data) {
    addChatMessage(data.username, data.message, data.isGlobal);
  });

  socket.on('queueJoined', function (data) {
    document.getElementById('queue-overlay').style.display = 'flex';
    updateEstimatedWait(data);
  });

  socket.on('queueLeft', function () {
    document.getElementById('queue-overlay').style.display = 'none';
  });

  socket.on('playerProfile', function (data) {
    showPlayerProfile(data);
  });

  socket.on('analysisReady', function (data) {
    displayAnalysis(data.analysis);
  });

  socket.on('drawOffered', function () {
    if (confirm('Your opponent has offered a draw. Do you accept?')) {
      socket.emit('acceptDraw');
    } else {
      socket.emit('declineDraw');
    }
  });

  socket.on('drawDeclined', function () {
    alert('Your draw offer was declined.');
  });

  socket.on('playerList', function (data) {
    updatePlayerList(data.players);
  });

  socket.on('kicked', function (data) {
    alert('You have been kicked: ' + data.reason);
    location.reload();
  });

  socket.on('banned', function (data) {
    alert('You have been banned: ' + data.reason);
    location.reload();
  });
}

function login(customUsername) {
  const name = customUsername || document.getElementById('username-input').value.trim();

  if (name.length < 2) {
    alert('Username must be at least 2 characters');
    return;
  }

  // Wait for socket connection
  if (!socket) {
    console.log('Socket not initialized, connecting...');
    connectSocket();
  }

  const waitForSocket = setInterval(function () {
    if (socket && socket.connected) {
      clearInterval(waitForSocket);
      console.log('Socket connected, logging in as:', name, 'isAdmin:', isAdmin);
      socket.emit('login', { username: name, isAdmin: isAdmin });
    }
  }, 100);

  // Timeout after 5 seconds
  setTimeout(function () {
    if (!socket || !socket.connected) {
      clearInterval(waitForSocket);
      console.error('Socket connection timeout');
      alert('Connection timeout. Please refresh the page.');
    }
  }, 5000);
}

function handleLoginSuccess(data) {
  username = data.username;
  playerRating = data.rating;
  isAdmin = data.isAdmin;

  document.getElementById('user-name').textContent = data.username;
  document.getElementById('user-rating').textContent = data.rating;

  document.getElementById('stat-games').textContent = data.stats.gamesPlayed;
  document.getElementById('stat-wins').textContent = data.stats.wins;
  document.getElementById('stat-winrate').textContent = data.stats.winRate + '%';
  document.getElementById('stat-rating').textContent = data.rating;

  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';

  if (data.isAdmin) {
    showAdminPanel();
  }

  loadLeaderboard();
}

function handleGameStart(data) {
  // Ensure Chess is available
  if (typeof Chess === 'undefined') {
    console.error('Chess.js not available in handleGameStart');
    alert('Chess engine not loaded. Please refresh the page.');
    return;
  }

  currentGameId = data.gameId;
  playerColor = data.color;
  gameActive = true;
  currentOpponent = playerColor === 'white' ? data.black : data.white;

  try {
    chess = new Chess(data.fen);
  } catch (e) {
    console.error('Failed to create chess board:', e);
    chess = new Chess();
  }

  document.getElementById('home-view').style.display = 'none';
  document.getElementById('game-view').style.display = 'flex';

  const isWhite = playerColor === 'white';
  document.getElementById('player-name').textContent = isWhite ? data.white.username : data.black.username;
  document.getElementById('player-rating-display').textContent = isWhite ? data.white.rating : data.black.rating;
  document.getElementById('opponent-name').textContent = isWhite ? data.black.username : data.white.username;
  document.getElementById('opponent-rating').textContent = isWhite ? data.black.rating : data.white.rating;

  const oppName = document.getElementById('opponent-name');
  oppName.style.cursor = 'pointer';
  oppName.onclick = function () { viewPlayerProfile(currentOpponent.username); };

  updateTimeDisplay(data.timeControl.initial, data.timeControl.initial);
  renderBoard();
  document.getElementById('move-list').innerHTML = '';
  document.getElementById('queue-overlay').style.display = 'none';
  updateActivePlayer();
}

function handleMoveMade(data) {
  if (!gameActive || !chess) return;

  console.log('Received move:', data);

  // Ensure Chess is available
  if (typeof Chess === 'undefined') {
    console.error('Chess.js not available in handleMoveMade');
    return;
  }

  try {
    chess.load(data.fen);
  } catch (e) {
    console.error('Failed to load FEN:', e);
    return;
  }

  addMoveToHistory(data.san);
  updateTimeDisplay(data.timeWhite, data.timeBlack);
  renderBoard();
  updateActivePlayer();

  // Check if game is over
  if (data.isCheckmate || data.isStalemate || data.isDraw) {
    console.log('Game over detected from server');
  }
}

function handleGameEnd(data) {
  console.log('Handling game end:', data);
  gameActive = false;
  currentGameId = null;

  const modal = document.getElementById('game-end-modal');
  const resultEl = document.getElementById('modal-result');
  const reasonEl = document.getElementById('modal-reason');

  if (data.result === 'draw') {
    resultEl.textContent = 'Draw!';
    resultEl.className = 'modal-result draw';
  } else if ((data.result === 'white' && playerColor === 'white') ||
    (data.result === 'black' && playerColor === 'black')) {
    resultEl.textContent = 'Victory!';
    resultEl.className = 'modal-result win';
  } else {
    resultEl.textContent = 'Defeat';
    resultEl.className = 'modal-result loss';
  }

  const reasons = {
    checkmate: 'by checkmate',
    stalemate: 'by stalemate',
    draw: 'by agreement',
    resignation: 'by resignation',
    timeout: 'by timeout',
    aborted: 'game aborted'
  };
  reasonEl.textContent = reasons[data.reason] || data.reason;

  modal.style.display = 'flex';

  if (currentGameId) {
    setTimeout(function () {
      socket.emit('requestAnalysis', currentGameId);
    }, 1000);
  }
}

function updateEstimatedWait(data) {
  const queueSize = data.queueSize || 1;
  const estimatedWait = Math.max(5, queueSize * 15);
  document.querySelector('.queue-status').textContent =
    'Queue size: ' + queueSize + ' players • Est. wait: ' + estimatedWait + 's';
}

function showView(viewName) {
  if (gameActive && viewName !== 'game') {
    if (confirm('You are in the middle of a game. Are you sure you want to leave?')) {
      if (confirm('Would you like to resign the current game?')) {
        resign();
      }
      gameActive = false;
      currentGameId = null;
      selectedSquare = null;
      chess = null;
    } else {
      return;
    }
  }

  document.getElementById('home-view').style.display = 'none';
  document.getElementById('game-view').style.display = 'none';
  document.getElementById('leaderboard-view').style.display = 'none';
  document.getElementById('profile-view').style.display = 'none';

  var adminView = document.getElementById('admin-view');
  if (adminView) adminView.style.display = 'none';

  if (viewName === 'home') {
    document.getElementById('home-view').style.display = 'block';
  } else if (viewName === 'game') {
    document.getElementById('game-view').style.display = 'flex';
  } else if (viewName === 'leaderboard') {
    document.getElementById('leaderboard-view').style.display = 'block';
    loadLeaderboard();
  } else if (viewName === 'profile') {
    document.getElementById('profile-view').style.display = 'block';
    loadProfile();
  } else if (viewName === 'admin') {
    if (adminView) {
      adminView.style.display = 'block';
      loadAdminPanel();
    }
  }

  // Update active nav button
  var navButtons = document.querySelectorAll('.nav-btn');
  for (var i = 0; i < navButtons.length; i++) {
    navButtons[i].classList.remove('active');
  }

  // Find and activate the correct button
  var activeButton = null;
  if (viewName === 'home') {
    activeButton = document.querySelector('.nav-btn:nth-child(1)');
  } else if (viewName === 'leaderboard') {
    activeButton = document.querySelector('.nav-btn:nth-child(2)');
  } else if (viewName === 'profile') {
    activeButton = document.querySelector('.nav-btn:nth-child(3)');
  } else if (viewName === 'admin') {
    activeButton = document.getElementById('admin-nav-btn');
  }

  if (activeButton) {
    activeButton.classList.add('active');
  }
}

function joinQueue(type) {
  socket.emit('joinQueue', { type: type, timeControl: 'rapid' });
}

function leaveQueue() {
  socket.emit('leaveQueue');
}

function selectBot(difficulty) {
  selectedBotDifficulty = difficulty;
  var btns = document.querySelectorAll('.bot-btn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.remove('selected');
  }
  if (event && event.target) {
    event.target.closest('.bot-btn').classList.add('selected');
  }
}

function playBot() {
  socket.emit('playBot', {
    difficulty: selectedBotDifficulty,
    timeControl: 'rapid',
    color: 'random'
  });
}

function renderBoard() {
  var board = document.getElementById('chess-board');
  if (!board || !chess) return;

  var position;
  try {
    position = chess.board();
  } catch (e) {
    return;
  }

  var html = '';
  for (var row = 0; row < 8; row++) {
    html += '<div class="board-row">';
    for (var col = 0; col < 8; col++) {
      var square = position[row][col];
      var isLight = (row + col) % 2 === 0;
      var squareName = String.fromCharCode(97 + col) + (8 - row);

      var classes = ['square', isLight ? 'light' : 'dark'];

      if (selectedSquare === squareName) {
        classes.push('selected');
      }

      var history = chess.history({ verbose: true });
      if (history.length > 0) {
        var lastMove = history[history.length - 1];
        if (lastMove.from === squareName || lastMove.to === squareName) {
          classes.push('last-move');
        }
      }

      if (selectedSquare) {
        try {
          var moves = chess.moves({ square: selectedSquare, verbose: true });
          for (var m = 0; m < moves.length; m++) {
            if (moves[m].to === squareName) {
              if (square) {
                classes.push('valid-capture');
              } else {
                classes.push('valid-move');
              }
              break;
            }
          }
        } catch (e) { }
      }

      html += '<div class="' + classes.join(' ') + '" data-square="' + squareName + '" onclick="onSquareClick(\'' + squareName + '\')">';

      if (square) {
        var pieceChar = pieces[square.color][square.type];
        html += '<span class="chess-piece">' + pieceChar + '</span>';
      }

      if (col === 0) {
        html += '<span class="coord rank">' + (8 - row) + '</span>';
      }
      if (row === 7) {
        html += '<span class="coord file">' + String.fromCharCode(97 + col) + '</span>';
      }

      html += '</div>';
    }
    html += '</div>';
  }

  board.innerHTML = html;
}

function analyzeGame() {
  if (!currentGameId) {
    alert('No game to analyze');
    return;
  }

  socket.emit('requestAnalysis', { gameId: currentGameId });

  socket.once('analysisReady', function (data) {
    showAnalysisModal(data.analysis);
  });

  socket.once('analysisError', function (error) {
    alert('Analysis failed: ' + error);
  });
}

function showAnalysisModal(analysis) {
  let modal = document.getElementById('analysis-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'analysis-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>Game Analysis</h2>
        <div id="analysis-content"></div>
        <button class="modal-btn primary" onclick="closeAnalysisModal()">Close</button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  let content = document.getElementById('analysis-content');
  if (!content) {
    content = document.createElement('div');
    content.id = 'analysis-content';
    modal.querySelector('.modal-content').appendChild(content);
  }

  let html = '<div class="analysis-summary">';
  html += '<h3>Accuracy: ' + (analysis.accuracy || 'N/A') + '%</h3>';
  html += '<p>Best Move: ' + (analysis.bestMoveCount || 0) + '</p>';
  html += '<p>Excellent Moves: ' + (analysis.excellentCount || 0) + '</p>';
  html += '<p>Good Moves: ' + (analysis.goodCount || 0) + '</p>';
  html += '<p>Inaccuracies: ' + (analysis.inaccuracies || 0) + '</p>';
  html += '<p>Mistakes: ' + (analysis.mistakes || 0) + '</p>';
  html += '<p>Blunders: ' + (analysis.blunders || 0) + '</p>';
  html += '</div>';

  html += '<div class="move-analysis">';
  html += '<h3>Move by Move Analysis</h3>';
  html += '<table>';
  html += '<tr><th>Move</th><th>Move</th><th>Classification</th><th>Evaluation</th></tr>';

  (analysis.movesWithEval || []).forEach(function (moveEval) {
    html += '<tr>';
    html += '<td>' + moveEval.moveNumber + '</td>';
    html += '<td>' + moveEval.san + '</td>';
    html += '<td class="classification-' + moveEval.classification + '">' + moveEval.classification + '</td>';
    html += '<td>' + moveEval.eval + '</td>';
    html += '</tr>';
  });

  html += '</table>';
  html += '</div>';

  content.innerHTML = html;
  modal.style.display = 'flex';
}

function closeAnalysisModal() {
  const modal = document.getElementById('analysis-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function onSquareClick(square) {
  if (!gameActive || !chess) {
    console.log('Game not active or chess not initialized');
    return;
  }

  console.log('Square clicked:', square, 'Player color:', playerColor, 'Chess turn:', chess.turn());
  console.log('Socket connected:', socket && socket.connected);

  if (chess.turn() !== (playerColor === 'white' ? 'w' : 'b')) {
    console.log('Not player\'s turn');
    return;
  }

  if (selectedSquare) {
    console.log('Moving from', selectedSquare, 'to', square);
    try {
      var moves = chess.moves({ square: selectedSquare, verbose: true });
      console.log('Available moves from', selectedSquare, ':', moves);
      var targetMove = null;
      for (var i = 0; i < moves.length; i++) {
        if (moves[i].to === square) {
          targetMove = moves[i];
          break;
        }
      }

      if (targetMove) {
        console.log('Valid move found:', targetMove);
        if (targetMove.promotion) {
          showPromotionModal(selectedSquare, square);
          return;
        }

        console.log('Sending move:', { from: selectedSquare, to: square, promotion: targetMove.promotion ? 'q' : undefined });
        if (socket && socket.connected) {
          socket.emit('makeMove', {
            from: selectedSquare,
            to: square,
            promotion: targetMove.promotion ? 'q' : undefined
          });
          console.log('Move sent successfully');
        } else {
          console.log('Socket not connected, cannot send move');
        }

        selectedSquare = null;
      } else {
        console.log('Invalid move target');
        var piece = chess.get(square);
        if (piece && piece.color === (playerColor === 'white' ? 'w' : 'b')) {
          selectedSquare = square;
        } else {
          selectedSquare = null;
        }
      }
    } catch (e) {
      console.error('Error processing move:', e);
      selectedSquare = null;
    }
  } else {
    console.log('Selecting square:', square);
    try {
      var piece = chess.get(square);
      console.log('Piece at', square, ':', piece);
      if (piece && piece.color === (playerColor === 'white' ? 'w' : 'b')) {
        selectedSquare = square;
        console.log('Selected square:', selectedSquare);
      }
    } catch (e) {
      console.error('Error selecting square:', e);
    }
  }

  renderBoard();
}

var pendingPromotion = null;

function showPromotionModal(from, to) {
  pendingPromotion = { from: from, to: to };
  document.getElementById('promotion-modal').style.display = 'flex';
}

function promote(piece) {
  document.getElementById('promotion-modal').style.display = 'none';
  if (!pendingPromotion) return;

  socket.emit('makeMove', {
    from: pendingPromotion.from,
    to: pendingPromotion.to,
    promotion: piece
  });

  pendingPromotion = null;
  selectedSquare = null;
}

function updateActivePlayer() {
  if (!chess) return;

  var isWhiteTurn = chess.turn() === 'w';
  var topBar = document.getElementById('player-top');
  var bottomBar = document.getElementById('player-bottom');

  if (playerColor === 'white') {
    if (topBar) topBar.classList.toggle('active', !isWhiteTurn);
    if (bottomBar) bottomBar.classList.toggle('active', isWhiteTurn);
  } else {
    if (topBar) topBar.classList.toggle('active', isWhiteTurn);
    if (bottomBar) bottomBar.classList.toggle('active', !isWhiteTurn);
  }
}

function updateTimeDisplay(whiteTime, blackTime) {
  var playerTimeEl = document.getElementById('player-time');
  var opponentTimeEl = document.getElementById('opponent-time');

  if (!playerTimeEl || !opponentTimeEl) return;

  var isWhite = playerColor === 'white';
  var playerSeconds = isWhite ? whiteTime : blackTime;
  var opponentSeconds = isWhite ? blackTime : whiteTime;

  if (typeof playerSeconds === 'number') {
    playerTimeEl.textContent = formatTime(playerSeconds);
    playerTimeEl.classList.toggle('low', playerSeconds < 60);
  }

  if (typeof opponentSeconds === 'number') {
    opponentTimeEl.textContent = formatTime(opponentSeconds);
    opponentTimeEl.classList.toggle('low', opponentSeconds < 60);
  }
}

function formatTime(seconds) {
  if (seconds === undefined || seconds === null) return '--:--';
  var mins = Math.floor(seconds / 60);
  var secs = Math.floor(seconds % 60);
  return mins + ':' + secs.toString().padStart(2, '0');
}

function addMoveToHistory(san) {
  var moveList = document.getElementById('move-list');
  if (!moveList || !san) return;

  var moveCount = chess && chess.history ? chess.history().length : 0;
  var moveNumber = Math.ceil(moveCount / 2);
  var isWhiteMove = moveCount % 2 === 1;

  if (isWhiteMove) {
    var numDiv = document.createElement('div');
    numDiv.className = 'move-number';
    numDiv.textContent = moveNumber + '.';
    moveList.appendChild(numDiv);

    var whiteDiv = document.createElement('div');
    whiteDiv.className = 'move-white';
    whiteDiv.textContent = san;
    moveList.appendChild(whiteDiv);

    var blackDiv = document.createElement('div');
    blackDiv.className = 'move-black';
    moveList.appendChild(blackDiv);
  } else {
    var blackDivs = moveList.querySelectorAll('.move-black');
    if (blackDivs.length > 0) {
      blackDivs[blackDivs.length - 1].textContent = san;
    }
  }

  var history = document.getElementById('move-history');
  if (history) {
    history.scrollTop = history.scrollHeight;
  }
}

function switchChat(tab) {
  currentChatTab = tab;
  var tabs = document.querySelectorAll('.chat-tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.remove('active');
  }

  // Activate the selected tab
  var selectedTab = document.querySelector('.chat-tab[data-tab="' + tab + '"]');
  if (selectedTab) {
    selectedTab.classList.add('active');
  }

  // Filter chat messages
  filterChatMessages();


  // Activate the selected tab
  var selectedTab = document.querySelector('.chat-tab[data-tab="' + tab + '"]');
  if (selectedTab) {
    selectedTab.classList.add('active');
  }

  // Filter chat messages
  filterChatMessages();
}

function filterChatMessages() {
  const messages = document.querySelectorAll('#chat-messages .chat-message');
  messages.forEach(msg => {
    const isGlobal = msg.classList.contains('global');
    const isMatch = msg.classList.contains('match');

    if (currentChatTab === 'global' && isGlobal) {
      msg.style.display = '';
    } else if (currentChatTab === 'match' && isMatch) {
      msg.style.display = '';
    } else {
      msg.style.display = 'none';
    }
  });
}

function addChatMessage(username, message, isGlobal) {
  chatHistory.push({ username: username, message: message, isGlobal: isGlobal });
  updateChatDisplay();

  // Also update lobby chat if it's a global message
  if (isGlobal) {
    addLobbyChatMessage(username, message);
  }

  // Filter messages based on current tab
  filterChatMessages();

  if (event && event.target) {
    event.target.classList.add('active');
  }
}

function sendChatMessage() {
  var input = document.getElementById('chat-input');
  if (!input) return;

  var message = input.value.trim();
  if (!message) return;

  sendChat(message, currentChatTab === 'global');
  input.value = '';
}

function sendChat(message, isGlobal) {
  if (!socket) return;

  socket.emit('sendChat', {
    message: message,
    isGlobal: isGlobal,
    gameId: isGlobal ? null : currentGameId
  });
}

function sendLobbyChatMessage() {
  var input = document.getElementById('lobby-chat-input');
  if (!input) return;

  var message = input.value.trim();
  if (!message) return;

  sendChat(message, true); // Always global in lobby
  input.value = '';
}

// Handle global chat messages in lobby
function handleLobbyChatMessage(data) {
  if (data.isGlobal) {
    addLobbyChatMessage(data.username, data.message);
  }
}

function addLobbyChatMessage(username, message) {
  var container = document.getElementById('lobby-chat-messages');
  if (!container) return;

  var messageDiv = document.createElement('div');
  messageDiv.className = 'chat-message global';
  messageDiv.innerHTML = '<span class="chat-username">' + escapeHtml(username) + ':</span>' +
    '<span class="chat-text">' + escapeHtml(message) + '</span>';

  container.appendChild(messageDiv);
  container.scrollTop = container.scrollHeight;
}

function addChatMessage(username, message, isGlobal) {
  chatHistory.push({ username: username, message: message, isGlobal: isGlobal });
  updateChatDisplay();

  // Also update lobby chat if it's a global message
  if (isGlobal) {
    addLobbyChatMessage(username, message);
  }
}

function updateChatDisplay() {
  var container = document.getElementById('chat-messages');
  if (!container) return;

  var html = '';
  for (var i = 0; i < chatHistory.length; i++) {
    var msg = chatHistory[i];
    html += '<div class="chat-message ' + (msg.isGlobal ? 'global' : 'match') + '">';
    html += '<span class="chat-username">' + escapeHtml(msg.username) + ':</span>';
    html += '<span class="chat-text">' + escapeHtml(msg.message) + '</span>';
    html += '</div>';
  }

  container.innerHTML = html;
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
  if (typeof text !== 'string') return '';

  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function offerDraw() {
  if (socket && socket.connected) {
    socket.emit('offerDraw');
    console.log('Draw offer sent to server');
  } else {
    console.log('Socket not connected, cannot offer draw');
    // Try to reconnect
    connectSocket();
    setTimeout(function () {
      if (socket && socket.connected) {
        socket.emit('offerDraw');
        console.log('Draw offer sent to server after reconnect');
      } else {
        alert('Connection lost. Cannot offer draw.');
      }
    }, 2000);
  }
}

function resign() {
  if (confirm('Are you sure you want to resign?')) {
    if (socket && socket.connected) {
      socket.emit('resign');
      console.log('Resignation sent to server');
    } else {
      console.log('Socket not connected, cannot resign');
      // Try to reconnect
      connectSocket();
      setTimeout(function () {
        if (socket && socket.connected) {
          socket.emit('resign');
          console.log('Resignation sent to server after reconnect');
        } else {
          alert('Connection lost. Cannot resign.');
        }
      }, 2000);
    }
  }
}

function newGame() {
  document.getElementById('game-end-modal').style.display = 'none';
  showView('home');

  // Reset game state
  gameActive = false;
  currentGameId = null;
  selectedSquare = null;
  chess = null;
  playerColor = 'white';
  currentOpponent = null;
}

function showAdminPanel() {
  // Show the admin nav button
  var adminNavBtn = document.getElementById('admin-nav-btn');
  if (adminNavBtn) {
    adminNavBtn.style.display = 'block';
  }

  // Create admin view if it doesn't exist
  var adminView = document.getElementById('admin-view');
  if (!adminView) {
    adminView = document.createElement('div');
    adminView.id = 'admin-view';
    adminView.style.display = 'none';
    adminView.innerHTML = `
      <div class="card">
        <h2 class="card-title">🛡️ Admin Panel</h2>
        <div class="admin-section">
          <h3>Player Management</h3>
          <div id="admin-player-list">
            <p>Loading players...</p>
          </div>
        </div>
        <div class="admin-section" style="margin-top: 2rem;">
          <h3>Actions</h3>
          <div class="admin-actions">
            <input type="text" id="admin-target-input" placeholder="Enter username" style="width: 200px; padding: 0.5rem; margin-right: 0.5rem;">
            <button class="control-btn" onclick="adminAction('kick')">Kick</button>
            <button class="control-btn" onclick="adminAction('ban')">Ban</button>
            <button class="control-btn" onclick="adminAction('unban')">Unban</button>
            <button class="control-btn" onclick="adminAction('mute')">Mute</button>
            <button class="control-btn" onclick="adminAction('unmute')">Unmute</button>
          </div>
        </div>
      </div>
    `;
    document.querySelector('.main-content').appendChild(adminView);
  }

  socket.emit('getPlayerList');
}

function loadAdminPanel() {
  socket.emit('getPlayerList');
}

function updatePlayerList(players) {
  var container = document.getElementById('admin-player-list');
  if (!container) return;

  if (players.length === 0) {
    container.innerHTML = '<p>No players online</p>';
    return;
  }

  var html = '<div class="player-list">';
  html += '<table class="leaderboard-table" style="width: 100%;">';
  html += '<thead><tr><th>User</th><th>Rating</th><th>Games</th><th>Status</th></tr></thead>';
  html += '<tbody>';

  for (var i = 0; i < players.length; i++) {
    var p = players[i];
    var status = 'Active';
    if (p.isBanned) status = 'Banned';
    else if (p.isMuted) status = 'Muted';

    html += '<tr>';
    html += '<td>' + escapeHtml(p.username) + (p.isGuest ? ' (Guest)' : '') + '</td>';
    html += '<td>' + p.rating + '</td>';
    html += '<td>' + (p.gamesPlayed || 0) + '</td>';
    html += '<td>' + status + '</td>';
    html += '</tr>';
  }

  html += '</tbody></table>';
  html += '</div>';

  container.innerHTML = html;
}

function viewPlayerProfile(targetUsername) {
  socket.emit('getPlayerProfile', targetUsername);
}

function showPlayerProfile(data) {
  alert('Player: ' + data.username + '\nRating: ' + data.rating + '\nGames: ' + data.gamesPlayed);
}

function adminAction(action) {
  const targetInput = document.getElementById('admin-target-input');
  const target = targetInput.value.trim();

  if (!target) {
    alert('Please enter a username');
    return;
  }

  if (socket && socket.connected) {
    socket.emit('adminAction', { action, target });
    console.log(`Admin action ${action} sent for user ${target}`);
  } else {
    console.log('Socket not connected, cannot perform admin action');
    alert('Connection lost. Cannot perform admin action.');
  }
}

function displayAnalysis(analysis) {
  var container = document.getElementById('game-analysis');
  if (!container || !analysis) return;

  container.innerHTML = '<div>Accuracy: White ' + (analysis.accuracy.white || 0).toFixed(1) + '% - Black ' + (analysis.accuracy.black || 0).toFixed(1) + '%</div>';
}

function loadLeaderboard() {
  // Add event listener for search input
  const searchInput = document.getElementById('player-search');
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      const searchTerm = this.value.toLowerCase().trim();
      filterLeaderboard(searchTerm);
    });
  }

  fetch(serverUrl + '/api/leaderboard')
    .then(function (res) { return res.json(); })
    .then(function (players) {
      var tbody = document.getElementById('leaderboard-body');
      if (!tbody) return;

      var html = '';
      for (var i = 0; i < players.length && i < 50; i++) {
        var p = players[i];
        html += '<tr data-player-name="' + p.username.toLowerCase() + '"><td>' + (i + 1) + '</td><td>' + p.username + '</td><td>' + p.rating + '</td><td>' + (p.wins || 0) + '</td><td>' + (p.gamesPlayed || 0) + '</td><td>' + (p.winRate || 0) + '%</td></tr>';
      }
      tbody.innerHTML = html || '<tr><td colspan="6">No players</td></tr>';
    })
}
function loadLeaderboard() {
  // Add event listener for search input
  const searchInput = document.getElementById('player-search');
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      const searchTerm = this.value.toLowerCase().trim();
      filterLeaderboard(searchTerm);
    });
  }

  fetch(serverUrl + '/api/leaderboard')
    .then(function (res) { return res.json(); })
    .then(function (players) {
      var tbody = document.getElementById('leaderboard-body');
      if (!tbody) return;

      var html = '';
      for (var i = 0; i < players.length && i < 50; i++) {
        var p = players[i];
        html += '<tr data-player-name="' + p.username.toLowerCase() + '"><td>' + (i + 1) + '</td><td>' + p.username + '</td><td>' + p.rating + '</td><td>' + (p.wins || 0) + '</td><td>' + (p.gamesPlayed || 0) + '</td><td>' + (p.winRate || 0) + '%</td></tr>';
      }
      tbody.innerHTML = html || '<tr><td colspan="6">No players</td></tr>';
    })
    .catch(function (err) {
      console.error('Leaderboard error:', err);
    });
}

fetch(serverUrl + '/api/leaderboard')
  .then(function (res) { return res.json(); })
  .then(function (players) {
    var tbody = document.getElementById('leaderboard-body');
    if (!tbody) return;

    var html = '';
    for (var i = 0; i < players.length && i < 50; i++) {
      var p = players[i];
      html += '<tr data-player-name="' + p.username.toLowerCase() + '"><td>' + (i + 1) + '</td><td>' + p.username + '</td><td>' + p.rating + '</td><td>' + (p.wins || 0) + '</td><td>' + (p.gamesPlayed || 0) + '</td><td>' + (p.winRate || 0) + '%</td></tr>';
    }
    tbody.innerHTML = html || '<tr><td colspan="6">No players</td></tr>';
  })
function loadLeaderboard() {
  // Add event listener for search input
  const searchInput = document.getElementById('player-search');
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      const searchTerm = this.value.toLowerCase().trim();
      filterLeaderboard(searchTerm);
    });
  }

  fetch(serverUrl + '/api/leaderboard')
    .then(function (res) { return res.json(); })
    .then(function (players) {
      var tbody = document.getElementById('leaderboard-body');
      if (!tbody) return;

      var html = '';
      for (var i = 0; i < players.length && i < 50; i++) {
        var p = players[i];
        html += '<tr data-player-name="' + p.username.toLowerCase() + '"><td>' + (i + 1) + '</td><td>' + p.username + '</td><td>' + p.rating + '</td><td>' + (p.wins || 0) + '</td><td>' + (p.gamesPlayed || 0) + '</td><td>' + (p.winRate || 0) + '%</td></tr>';
      }
      tbody.innerHTML = html || '<tr><td colspan="6">No players</td></tr>';
    })
    .catch(function (err) {
      console.error('Leaderboard error:', err);
    });
}

function filterLeaderboard(searchTerm) {
  const rows = document.querySelectorAll('#leaderboard-body tr');
  rows.forEach(row => {
    const playerName = row.getAttribute('data-player-name');
    if (!searchTerm || playerName.includes(searchTerm)) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

function loadProfile() {
  // Get the current username
  const currentUsername = username || 'Unknown';

  // Check if it's a guest user
  if (typeof currentUsername === 'string' && currentUsername.startsWith('guest-')) {
    document.getElementById('profile-content').innerHTML = '<p style="text-align: center; color: #888;">Guest users don\'t have profiles.</p>';
    return;
  }

  fetch(serverUrl + '/api/player/' + encodeURIComponent(currentUsername))
    .then(function (res) {
      if (!res.ok) {
        throw new Error('Network response was not ok');
      }
      return res.json();
    })
    .then(function (player) {
      var container = document.getElementById('profile-content');
      if (!container) return;

      if (player.error) {
        container.innerHTML = '<p style="text-align: center; color: #888;">Profile not found.</p>';
        return;
      }

      // Create profile HTML with game history
      let gamesHtml = '';
      if (player.recentGames && player.recentGames.length > 0) {
        gamesHtml = `
          <h3 style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">Recent Games</h3>
          <div style="max-height: 300px; overflow-y: auto;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr>
                  <th style="text-align: left; padding: 0.5rem; border-bottom: 1px solid var(--border-color);">Opponent</th>
                  <th style="text-align: left; padding: 0.5rem; border-bottom: 1px solid var(--border-color);">Result</th>
                  <th style="text-align: left; padding: 0.5rem; border-bottom: 1px solid var(--border-color);">Rating Change</th>
                  <th style="text-align: left; padding: 0.5rem; border-bottom: 1px solid var(--border-color);">Moves</th>
                  <th style="text-align: left; padding: 0.5rem; border-bottom: 1px solid var(--border-color);">Actions</th>
                </tr>
              </thead>
              <tbody>
        `;

        player.recentGames.forEach((game, index) => {
          const resultClass = game.result === 'win' ? 'color: #27ae60;' :
            game.result === 'loss' ? 'color: #e74c3c;' :
              'color: #f39c12;';

          const ratingChange = game.ratingChange || 0;
          const ratingChangeText = ratingChange > 0 ? `+${ratingChange}` : ratingChange.toString();
          const ratingChangeClass = ratingChange > 0 ? 'color: #27ae60;' :
            ratingChange < 0 ? 'color: #e74c3c;' :
              'color: #f39c12;';

          gamesHtml += `
            <tr>
              <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">${escapeHtml(game.opponent)}</td>
              <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color); ${resultClass}">${game.result}</td>
              <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color); ${ratingChangeClass}">${ratingChangeText}</td>
              <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">${game.moves || 0}</td>
              <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">
                <button onclick="viewGameReplay('${game.gameId}')" style="padding: 0.25rem 0.5rem; background: var(--button-bg); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer;">View</button>
              </td>
            </tr>
          `;
        });

        gamesHtml += `
              </tbody>
            </table>
          </div>
        `;
      } else {
        gamesHtml = '<p style="text-align: center; color: #888; margin-top: 2rem;">No games played yet.</p>';
      }

      container.innerHTML = `
        <div style="text-align: center;">
          <h2>${escapeHtml(player.username)}</h2>
          <div style="font-size: 2rem; color: #3498db; margin: 1rem 0;">${player.rating}</div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-top: 2rem;">
            <div style="background: var(--button-bg); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color);">
              <div style="font-size: 1.5rem; font-weight: bold;">${player.stats.gamesPlayed || 0}</div>
              <div style="color: #666; font-size: 0.9rem;">Games</div>
            </div>
            <div style="background: var(--button-bg); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color);">
              <div style="font-size: 1.5rem; font-weight: bold;">${player.stats.wins || 0}</div>
              <div style="color: #666; font-size: 0.9rem;">Wins</div>
            </div>
            <div style="background: var(--button-bg); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color);">
              <div style="font-size: 1.5rem; font-weight: bold;">${player.stats.winRate || 0}%</div>
              <div style="color: #666; font-size: 0.9rem;">Win Rate</div>
            </div>
          </div>
          ${gamesHtml}
        </div>
      `;
    })
    .catch(function (err) {
      console.error('Profile error:', err);
      var container = document.getElementById('profile-content');
      if (container) {
        container.innerHTML = '<p style="text-align: center; color: #888;">Error loading profile.</p>';
      }
    });
}

// View game replay
function viewGameReplay(gameId) {
  // Fetch game details
  fetch(serverUrl + '/api/game/' + encodeURIComponent(gameId))
    .then(function (res) {
      if (!res.ok) {
        throw new Error('Network response was not ok');
      }
      return res.json();
    })
    .then(function (game) {
      if (game.error) {
        alert('Error loading game: ' + game.error);
        return;
      }

      // Show replay modal
      showReplayModal(game);
    })
    .catch(function (err) {
      console.error('Game replay error:', err);
      alert('Error loading game replay.');
    });
}

// Show replay modal
function showReplayModal(game) {
  // Create or update replay modal
  let modal = document.getElementById('replay-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'replay-modal';
    modal.className = 'modal';
    modal.style.cssText = `
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.8);
      z-index: 400;
      align-items: center;
      justify-content: center;
    `;
    document.body.appendChild(modal);
  }

  // Create modal content
  modal.innerHTML = `
    <div class="modal-content" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 90vw; max-height: 90vh; overflow: auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h2>Game Replay</h2>
        <button onclick="closeReplayModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">×</button>
      </div>
      <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
        <div>
          <h3>Game Info</h3>
          <p><strong>White:</strong> ${escapeHtml(game.white.username)} (${game.white.rating})</p>
          <p><strong>Black:</strong> ${escapeHtml(game.black.username)} (${game.black.rating})</p>
          <p><strong>Result:</strong> ${game.result} by ${game.resultReason}</p>
          <p><strong>Date:</strong> ${new Date(game.startedAt).toLocaleDateString()}</p>
        </div>
        <div>
          <h3>Board</h3>
          <div id="replay-board" style="width: 400px; height: 400px; border: 1px solid var(--border-color); border-radius: 8px;"></div>
          <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
            <button id="replay-prev" onclick="replayPrevMove()" disabled style="padding: 0.5rem 1rem; background: var(--button-bg); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer;">Previous</button>
            <button id="replay-next" onclick="replayNextMove()" style="padding: 0.5rem 1rem; background: var(--button-bg); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer;">Next</button>
            <button onclick="replayReset()" style="padding: 0.5rem 1rem; background: var(--button-bg); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer;">Reset</button>
          </div>
        </div>
      </div>
      <div style="margin-top: 1rem;">
        <h3>Move List</h3>
        <div id="replay-moves" style="max-height: 200px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 4px; padding: 0.5rem;"></div>
      </div>
    </div>
  `;

  // Show modal
  modal.style.display = 'flex';

  // Initialize replay
  initializeReplay(game);
}

// Close replay modal
function closeReplayModal() {
  const modal = document.getElementById('replay-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Replay state
let replayState = {
  game: null,
  chess: null,
  currentPosition: 0
};

// Initialize replay
function initializeReplay(game) {
  replayState.game = game;
  replayState.chess = new Chess(game.currentFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  replayState.currentPosition = 0;

  // Render initial board
  renderReplayBoard();

  // Render move list
  renderReplayMoves();

  // Update button states
  updateReplayButtons();
}

// Render replay board
function renderReplayBoard() {
  const boardElement = document.getElementById('replay-board');
  if (!boardElement || !replayState.chess) return;

  // Get board position
  const board = replayState.chess.board();

  let html = '';
  for (let row = 0; row < 8; row++) {
    html += '<div style="display: flex;">';
    for (let col = 0; col < 8; col++) {
      const square = board[row][col];
      const isLight = (row + col) % 2 === 0;
      const squareName = String.fromCharCode(97 + col) + (8 - row);

      const bgColor = isLight ? '#f0d9b5' : '#b58863';

      html += `<div style="width: 50px; height: 50px; background: ${bgColor}; display: flex; align-items: center; justify-content: center; font-size: 36px; position: relative;">`;

      if (square) {
        const pieceChar = {
          'w': { 'k': '♔', 'q': '♕', 'r': '♖', 'b': '♗', 'n': '♘', 'p': '♙' },
          'b': { 'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟' }
        }[square.color][square.type];

        html += `<span style="text-shadow: 0 0 2px rgba(0, 0, 0, 0.5);">${pieceChar}</span>`;
      }

      // Add coordinates
      if (col === 0) {
        html += `<span style="position: absolute; top: 2px; left: 2px; font-size: 10px; color: rgba(0,0,0,0.5);">${8 - row}</span>`;
      }
      if (row === 7) {
        html += `<span style="position: absolute; bottom: 2px; right: 2px; font-size: 10px; color: rgba(0,0,0,0.5);">${String.fromCharCode(97 + col)}</span>`;
      }

      html += '</div>';
    }
    html += '</div>';
  }

  boardElement.innerHTML = html;
}

// Render replay moves
function renderReplayMoves() {
  const movesElement = document.getElementById('replay-moves');
  if (!movesElement || !replayState.game || !replayState.game.moves) return;

  let html = '<div style="display: grid; grid-template-columns: 30px 1fr 1fr; gap: 0.5rem; font-family: monospace; font-size: 0.9rem;">';

  for (let i = 0; i < replayState.game.moves.length; i++) {
    const move = replayState.game.moves[i];
    const moveNumber = Math.floor(i / 2) + 1;
    const isWhite = i % 2 === 0;

    if (isWhite) {
      html += `<div style="color: #888;">${moveNumber}.</div>`;
      html += `<div style="cursor: pointer; padding: 0.1rem; border-radius: 3px; ${i === replayState.currentPosition ? 'background: rgba(52, 152, 219, 0.3);' : ''}" onclick="goToMove(${i})">${escapeHtml(move.san)}</div>`;
      html += '<div></div>'; // Empty cell for black move
    } else {
      // Find the previous white move element and add the black move to it
      html = html.replace(/(<div><\/div>)$/, `<div style="cursor: pointer; padding: 0.1rem; border-radius: 3px; ${i === replayState.currentPosition ? 'background: rgba(52, 152, 219, 0.3);' : ''}" onclick="goToMove(${i})">${escapeHtml(move.san)}</div>`);
    }
  }

  html += '</div>';
  movesElement.innerHTML = html;
}

// Go to specific move
function goToMove(moveIndex) {
  if (!replayState.game || !replayState.game.moves) return;

  // Reset to initial position
  replayState.chess = new Chess(replayState.game.currentFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  replayState.currentPosition = 0;

  // Apply moves up to the selected position
  for (let i = 0; i <= moveIndex && i < replayState.game.moves.length; i++) {
    try {
      replayState.chess.move(replayState.game.moves[i]);
      replayState.currentPosition = i;
    } catch (e) {
      console.error('Error applying move:', e);
      break;
    }
  }

  // Update display
  renderReplayBoard();
  renderReplayMoves();
  updateReplayButtons();
}

// Previous move
function replayPrevMove() {
  if (replayState.currentPosition > 0) {
    goToMove(replayState.currentPosition - 1);
  }
}

// Next move
function replayNextMove() {
  if (replayState.game && replayState.game.moves && replayState.currentPosition < replayState.game.moves.length - 1) {
    goToMove(replayState.currentPosition + 1);
  }
}

// Reset replay
function replayReset() {
  if (replayState.game) {
    initializeReplay(replayState.game);
  }
}

// Update replay buttons
function updateReplayButtons() {
  const prevButton = document.getElementById('replay-prev');
  const nextButton = document.getElementById('replay-next');

  if (prevButton) {
    prevButton.disabled = replayState.currentPosition <= 0;
  }

  if (nextButton && replayState.game && replayState.game.moves) {
    nextButton.disabled = replayState.currentPosition >= replayState.game.moves.length - 1;
  }
}

// Periodic health check to keep server awake
function startHealthChecks() {
  setInterval(function () {
    if (serverUrl.includes('render.com') || serverUrl.includes('theamazinggame')) {
      fetch(serverUrl + '/health')
        .then(function (response) {
          if (response.ok) {
            console.log('Health check successful');
          } else {
            console.log('Health check failed:', response.status);
          }
        })
        .catch(function (error) {
          console.log('Health check error:', error);
        });
    }
  }, 300000); // Every 5 minutes
}

// Call this after socket connection is established
function setupPeriodicHealthChecks() {
  // Start health checks after a delay to ensure everything is loaded
  setTimeout(startHealthChecks, 5000);
}

// Dark mode toggle
function initDarkModeToggle() {
  const toggleButton = document.getElementById('theme-toggle');
  const currentTheme = localStorage.getItem('theme') || 'light';

  if (currentTheme === 'dark') {
    document.body.classList.add('dark-mode');
  }

  toggleButton.addEventListener('click', function () {
    document.body.classList.toggle('dark-mode');

    // Save preference to localStorage
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  });
}

function checkIframeEnvironment() {
  if (window.self !== window.top) {

    const style = document.createElement('style');
    style.textContent = `
      body {
        overflow: hidden;
      }
      
      #app {
        height: 100vh;
      }
      
      .main-content {
        height: calc(100vh - 120px);
      }
      
      #game-view {
        height: 100%;
      }
      
      .game-board-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      
      #chess-board {
        flex: 1;
      }
    `;
    document.head.appendChild(style);

    // Adjust for modd.io specific elements
    adjustForModdIo();
  }
}

// Adjust for modd.io specific elements
function adjustForModdIo() {
  // Hide modd.io UI elements that might interfere
  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.type === 'childList') {
        // Look for modd.io specific elements to hide or adjust
        const menuButton = document.querySelector('button[aria-label="Menu"]');
        if (menuButton) {
          // Ensure our game UI is above modd.io elements
          const app = document.getElementById('app');
          if (app) {
            app.style.zIndex = '1000';
            app.style.position = 'relative';
          }
        }
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// Call when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
  checkIframeEnvironment();
  initDarkModeToggle();
  setupPeriodicHealthChecks();
});