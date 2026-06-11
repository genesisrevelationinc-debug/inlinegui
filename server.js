var express = require('express');
var bodyParser = require('body-parser');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var path = require('path');
var fs = require('fs');

// Database setup
var levelup = require('levelup');
var dbPath = process.env.DB_PATH || './db';
var db = levelup(dbPath);

var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'inlinegui-secret',
  resave: false,
  saveUninitialized: true
}));

// Serve static files from src/files
app.use(express.static(path.join(__dirname, 'src', 'files')));

// API Routes

// Get current user
app.get('/api/user', function(req, res) {
  if (req.session.user) {
    res.json({ success: true, user: req.session.user });
  } else {
    res.json({ success: false, user: null });
  }
});

// Create or update user (from Persona login)
app.post('/api/user', function(req, res) {
  var userData = req.body;
  
  if (!userData.email) {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }
  
  var user = {
    email: userData.email,
    name: userData.name || '',
    createdAt: new Date().toISOString()
  };
  
  // Check if user exists
  db.get('user:' + user.email, function(err, existing) {
    if (existing) {
      // Update existing user
      var existingUser = JSON.parse(existing);
      user.name = userData.name || existingUser.name || '';
      user.createdAt = existingUser.createdAt || user.createdAt;
    }
    
    db.put('user:' + user.email, JSON.stringify(user), function(err) {
      if (err) {
        return res.status(500).json({ success: false, error: 'Failed to save user' });
      }
      
      req.session.user = user;
      res.json({ success: true, user: user });
    });
  });
});

// Login user
app.post('/api/login', function(req, res) {
  var email = req.body.email;
  var name = req.body.name || '';
  
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }
  
  var user = {
    email: email,
    name: name,
    lastLoginAt: new Date().toISOString()
  };
  
  db.get('user:' + email, function(err, existing) {
    if (existing) {
      var existingUser = JSON.parse(existing);
      user.name = name || existingUser.name || '';
      user.createdAt = existingUser.createdAt;
    }
    
    db.put('user:' + email, JSON.stringify(user), function(err) {
      if (err) {
        return res.status(500).json({ success: false, error: 'Failed to save user' });
      }
      
      req.session.user = user;
      res.json({ success: true, user: user });
    });
  });
});

// Logout user
app.post('/api/logout', function(req, res) {
  req.session.destroy();
  res.json({ success: true });
});

// Serve login page
app.get('/login', function(req, res) {
  res.sendFile(path.join(__dirname, 'src', 'files', 'login.html'));
});

// Default: serve index
app.get('*', function(req, res) {
  res.sendFile(path.join(__dirname, 'src', 'files', 'index.html'));
});

var port = process.env.PORT || 3000;
app.listen(port, function() {
  console.log('InlineGUI server listening on port ' + port);
});

module.exports = app;