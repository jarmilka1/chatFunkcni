const express = require('express');
const { createServer } = require('http'); // Changed from 'node:http'
const { join } = require('path');
const { Server } = require('socket.io');
const mysql = require('mysql2');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const sharedSession = require('express-socket.io-session');

// Inicializace Express aplikace
const app = express();
app.use(cookieParser());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'css')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));

// Vytvoření HTTP serveru pomocí Express aplikace
const server = createServer(app);

// Inicializace Socket.io na serveru
const io = new Server(server);

const sessionStore = new session.MemoryStore();

const sessionMiddleware = session({
  store: sessionStore,
  secret: 'your_secret_key', // Replace with an actual secret key
  resave: true, // Set to true to resolve deprecation warning
  saveUninitialized: true, // Set to true to resolve deprecation warning
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
  },
});

app.use(sessionMiddleware);

// Nastavení připojení k databázi MySQL
const connection = mysql.createConnection({
  host: '192.168.1.161',
  user: 'petr.spacek',
  password: 'Spakator445',
  database: 'chat',
  port: 3001
});


app.get('/setSession', (req, res) => {
  const usernameFromCookie = req.cookies.username;

  if (usernameFromCookie) {
    req.session.username = usernameFromCookie;
    res.send('User from cookie: ' + usernameFromCookie);
  } else {
    res.send('No username found in the cookie');
  }
});

app.get('/settedSession', (req, res) => {
  const username = req.session.username;

  if (username) {
    res.send('User from session: ' + username);
  } else {
    res.send('No username found in the session');
  }
});

app.get('/chat', (req, res) => {
  let username = req.session.username;

  if (!username) {
    // If it's not in the cookies, you can also check the session
    username = req.session.username;
  }

  if (username) {
    res.render('index', { username });
  } else {
    res.sendFile(join(__dirname, 'failedLogin.html'));
  }
});


// Stránka pro registraci
app.get('/register', (req, res) => {
  res.render('register');
});

// Stránka pro zpracování registrace
app.post('/register', (req, res) => {
  const { username, password } = req.body;

  // Příklad: Vytvoření nového uživatele v databázi
  connection.query('INSERT INTO user (username, password) VALUES (?, ?)', [username, password], (error, results, fields) => {
    if (error) {
      console.error(error);
      res.status(500).send('Chyba při registraci.');
    } else {
      console.log('Uživatel byl úspěšně registrován.');
      res.redirect('/login'); // Po registraci přesměrovat na stránku přihlášení
    }
  });
});


// Stránka pro přihlášení
app.get('/login', (req, res) => {
  res.render('login.ejs');
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  connection.query('SELECT * FROM user WHERE (LOWER(username) = ? OR UPPER(username) = ?) AND (LOWER(password) = ? OR UPPER(password) = ?)', [username, username, password, password], (error, results, fields) => {
    if (error) {
      console.error(error);
      res.status(500).send('Chyba při přihlášení.');
    } else {
      if (results.length > 0) {
        req.session.authenticated = true;
        req.session.username = req.body.username;
        req.cookies.username = username;
        res.cookie('username', username);

        currentUsername = username;

        res.redirect('/chat');
      } else {
        res.sendFile(join(__dirname, 'failedLogin.html'));
      }
    }
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
    }
    res.redirect('/login');
  });
});

//svg
app.get('/svg', (req, res) => {
  const queryPromise = new Promise((resolve, reject) => {
    connection.query('SELECT svg_data, style FROM svg_data', (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });

  queryPromise.then((results) => {
    const svgDataArray = results.map(result => result.svg_data);
    const svgSTYLEArray = results.map(result => result.style);

    res.render('svg.ejs', { svgDataArray, svgSTYLEArray });
  }).catch((error) => {
    throw error;
  });
});

io.use(sharedSession(sessionMiddleware, {
  autoSave: true,
}));

// Naslouchání na události připojení klienta k Socket.io
io.on('connection', (socket) => {
  const session = socket.handshake.session;
  console.log('user ' + session.username + ' connected');
  io.emit('user joined', session.username);

  // Naslouchání na událost 'chat message' pro přijetí zprávy od klienta
  socket.on('chat message', (msg) => {
    if (session.username) {
      io.emit('chat message', session.username + ": " + msg);
    }
    console.log('chat message', session.username + ": " + msg)
  });

  io.on('disconnect', () => {
    const session = socket.handshake.session;
    console.log('user ' + session.username + ' disconnected');
  });
});


// Spuštění HTTP serveru na portu 80
server.listen(80, () => {
  console.log('server running at port 80');
});
