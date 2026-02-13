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

document.addEventListener('DOMContentLoaded', function () {
  // Wait for Chess.js to load
  const checkChess = setInterval(function() {
    if (typeof Chess !== 'undefined') {
      clearInterval(checkChess);
      console.log('Chess.js loaded successfully');
      initializeGame();
    }
  }, 100);
  
  // Timeout after 5 seconds
  setTimeout(function() {
    if (typeof Chess === 'undefined') {
      console.error('Chess.js failed to load');
      alert('Chess engine failed to load. Please refresh the page.');
    }
  }, 5000);
});

function initializeGame() {
  const moddUsername = getModdIOUsername();
  console.log('Detected username:', moddUsername);

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

function getModdIOUsername() {
  // Check iframe element ID for user info (new approach for modd.io)
  try {
    if (window.frameElement && window.frameElement.id) {
      const frameId = window.frameElement.id;
      const parts = frameId.split('-');
      
      // Check for conqframe-llkasz-username-pattern
      if (parts.length >= 4 && parts[0] === 'conqframe' && parts[1] === 'llkasz') {
        if (parts[2] === 'lurbs') {
          isAdmin = true;
          return 'lurbs';
        } else {
          isAdmin = false;
          return parts[2]; // Return the username
        }
      }
      
      // Check for conqframe-jkasz-username-pattern
      if (parts.length >= 4 && parts[0] === 'conqframe' && parts[1] === 'jkasz') {
        isAdmin = false;
        return parts[2]; // Return the username
      }
    }
  } catch (e) {
    // Cross-origin restrictions - silently fail
  }
  
  // Check for llkasz- elements (admin/owner)
  const adminElements = document.querySelectorAll('[id^="llkasz-"]');
  for (let i = 0; i < adminElements.length; i++) {
    const id = adminElements[i].id;
    const parts = id.split('-');
    if (parts.length >= 3) {
      // Check if the username after llkasz- is 'lurbs'
      if (parts[1] === 'lurbs') {
        isAdmin = true;
        return 'lurbs';
      }
      // If it's llkasz- but not lurbs, just return the username
      isAdmin = false;
      return parts[1];
    }
  }
  
  // Check for jkasz- elements (regular players)
  const playerElements = document.querySelectorAll('[id^="jkasz-"]');
  for (let i = 0; i < playerElements.length; i++) {
    const id = playerElements[i].id;
    const parts = id.split('-');
    if (parts.length >= 3) {
      isAdmin = false;
      return parts[1]; // Return the username
    }
  }
  
  // Guest user fallback
  isAdmin = false;
  return 'guest-' + Math.floor(Math.random() * 9900 + 100);
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
    reconnectionAttempts: 5,
    timeout: 10000
  });

  socket.on('connect', function() {
    console.log('Socket connected successfully with ID:', socket.id);
  });

  socket.on('disconnect', function(reason) {
    console.log('Socket disconnected:', reason);
  });

  socket.on('connect_error', function(error) {
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

  socket.on('invalidMove', function(data) {
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
  
  const waitForSocket = setInterval(function() {
    if (socket && socket.connected) {
      clearInterval(waitForSocket);
      console.log('Socket connected, logging in as:', name, 'isAdmin:', isAdmin);
      socket.emit('login', { username: name, isAdmin: isAdmin });
    }
  }, 100);
  
  // Timeout after 5 seconds
  setTimeout(function() {
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
}

function handleGameEnd(data) {
  console.log('Handling game end:', data);
  gameActive = false;

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
        socket.emit('resign');
      }
      gameActive = false;
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
    if (adminView) adminView.style.display = 'block';
    loadAdminPanel();
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

  playerTimeEl.textContent = formatTime(playerSeconds);
  opponentTimeEl.textContent = formatTime(opponentSeconds);

  playerTimeEl.classList.toggle('low', playerSeconds < 60);
  opponentTimeEl.classList.toggle('low', opponentSeconds < 60);
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
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function offerDraw() {
  socket.emit('offerDraw');
}

function resign() {
  if (confirm('Are you sure you want to resign?')) {
    socket.emit('resign');
  }
}

function newGame() {
  document.getElementById('game-end-modal').style.display = 'none';
  showView('home');
}

function showAdminPanel() {
  var adminView = document.getElementById('admin-view');
  if (!adminView) {
    adminView = document.createElement('div');
    adminView.id = 'admin-view';
    adminView.style.display = 'none';
    adminView.innerHTML = '<div class="card"><h2>Admin Panel</h2><div id="admin-player-list"></div></div>';
    document.querySelector('.main-content').appendChild(adminView);

    var nav = document.querySelector('.nav');
    if (nav) {
      var btn = document.createElement('button');
      btn.className = 'nav-btn';
      btn.textContent = 'Admin';
      btn.onclick = function () { showView('admin'); };
      nav.appendChild(btn);
    }
  }

  socket.emit('getPlayerList');
}

function loadAdminPanel() {
  socket.emit('getPlayerList');
}

function updatePlayerList(players) {
  var container = document.getElementById('admin-player-list');
  if (!container) return;

  var html = '<table class="leaderboard-table"><thead><tr><th>User</th><th>Rating</th><th>Status</th></tr></thead><tbody>';
  for (var i = 0; i < players.length; i++) {
    var p = players[i];
    html += '<tr><td>' + p.username + '</td><td>' + p.rating + '</td><td>' + (p.isBanned ? 'Banned' : p.isMuted ? 'Muted' : 'Active') + '</td></tr>';
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

function viewPlayerProfile(targetUsername) {
  socket.emit('getPlayerProfile', targetUsername);
}

function showPlayerProfile(data) {
  alert('Player: ' + data.username + '\nRating: ' + data.rating + '\nGames: ' + data.gamesPlayed);
}

function displayAnalysis(analysis) {
  var container = document.getElementById('game-analysis');
  if (!container || !analysis) return;

  container.innerHTML = '<div>Accuracy: White ' + (analysis.accuracy.white || 0).toFixed(1) + '% - Black ' + (analysis.accuracy.black || 0).toFixed(1) + '%</div>';
}

function loadLeaderboard() {
  fetch(serverUrl + '/api/leaderboard')
    .then(function (res) { return res.json(); })
    .then(function (players) {
      var tbody = document.getElementById('leaderboard-body');
      if (!tbody) return;

      var html = '';
      for (var i = 0; i < players.length && i < 50; i++) {
        var p = players[i];
        html += '<tr><td>' + (i + 1) + '</td><td>' + p.username + '</td><td>' + p.rating + '</td><td>' + (p.wins || 0) + '</td><td>' + (p.gamesPlayed || 0) + '</td></tr>';
      }
      tbody.innerHTML = html || '<tr><td colspan="6">No players</td></tr>';
    })
    .catch(function (err) {
      console.error('Leaderboard error:', err);
    });
}

function loadProfile() {
  var moddUsername = getModdIOUsername();
  if (moddUsername.startsWith('guest-')) {
    document.getElementById('profile-content').innerHTML = '<p style="text-align: center; color: #888;">Guest users don\'t have profiles.</p>';
    return;
  }

  fetch(serverUrl + '/api/player/' + username)
    .then(function (res) { return res.json(); })
    .then(function (player) {
      var container = document.getElementById('profile-content');
      if (!container) return;

      container.innerHTML = '<div style="text-align: center;"><h2>' + player.username + '</h2><div style="font-size: 2rem; color: #00d4ff;">' + player.rating + '</div></div>';
    })
    .catch(function (err) {
      console.error('Profile error:', err);
    });
}