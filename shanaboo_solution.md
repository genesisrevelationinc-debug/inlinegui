 ```diff
--- a/package.json
+++ b/package.json
@@ -0,0 +0,0 @@
 {
   "name": "inlinegui",
   "version": "0.1.0",
   "description": "An Inline GUI/CMS for any backend",
   "main": "docpad.coffee",
   "dependencies": {
     "docpad": "~6.78.0",
     "express": "~3.4.0",
     "mongodb": "~1.3.0",
     "levelup": "~0.18.0",
     "leveldown": "~0.10.0",
     "passport": "~0.1.0",
     "passport-persona": "~0.1.0",
     "connect": "~2.12.0"
   },
   "devDependencies": {},
   "scripts": {
     "start": "docpad run",
     "test": "echo \"Error: no test specified\" && exit 1"
   },
   "repository": {
     "type": "git",
     "url": "git://github.com/Docport/inlinegui.git"
   },
   "keywords": [
     "docpad",
     "inlinegui",
     "cms",
     "webwrite"
   ],
   "author": "Neil Taylor <neil.t@myplanetdigital.com>",
   "license": "MIT",
   "bugs": {
     "url": "https://github.com/Docport/inlinegui/issues"
   },
   "homepage": "https://github.com/Docport/inlinegui"
 }
--- a/docpad.coffee
+++ b/docpad.coffee
@@ -0,0 +0,0 @@
 # DocPad Configuration
 docpadConfig = {
+  # ...
+  
+  # Server Extend
+  # Used to add server configuration
+  serverExtend: (opts) ->
+    # Extract the server from the options
+    {server} = opts
+    {express} = server
+    
+    # Require our account routes
+    require('./src/server/account-routes')(express)
+    
+    # Return
+    return
+  
   # ...
 }
 
 # Export our DocPad Configuration
 module.exports = docpadConfig
--- /dev/null
+++ b/src/server/account-routes.coffee
@@ -0,0 +0,0 @@
+# Account Routes Module
+# Handles user authentication and account management
+
+# Dependencies
+passport = require('passport')
+PersonaStrategy = require('passport-persona').Strategy
+path = require('path')
+
+# Database setup - support both MongoDB and LevelUP
+db = null
+dbType = process.env.DB_TYPE || 'levelup'  # 'mongodb' or 'levelup'
+
+if dbType is 'mongodb'
+  # MongoDB setup
+  MongoClient = require('mongodb').MongoClient
+  mongoUrl = process.env.MONGOLAB_URI || process.env.MONGOHQ_URL || 'mongodb://localhost:27017/inlinegui'
+  
+  MongoClient.connect mongoUrl, (err, database) ->
+    throw err if err
+    db = database
+    console.log 'Connected to MongoDB'
+else
+  # LevelUP setup
+  levelup = require('levelup')
+  dbPath = process.env.LEVELUP_PATH || './inlinegui-db'
+  db = levelup(dbPath)
+  console.log 'Connected to LevelUP'
+
+# Passport session setup
+# Serialize user to session
+passport.serializeUser (user, done) ->
+  done(null, user.email)
+
+# Deserialize user from session
+passport.deserializeUser (email, done) ->
+  if dbType is 'mongodb'
+    db.collection('users').findOne { email: email }, (err, user) ->
+      done(err, user)
+  else
+    db.get 'user:' + email, (err, user) ->
+      if err and err.notFound
+        done(null, null)
+      else if err
+        done(err, null)
+      else
+        try
+          user = JSON.parse(user) if typeof user is 'string'
+          done(null, user)
+        catch e
+          done(e, null)
+
+# Configure Persona strategy
+passport.use new PersonaStrategy
+  audience: process.env.PERSONA_AUDIENCE || 'http://localhost:9778'
+, (email, done) ->
+  # Find or create user
+  findOrCreateUser(email, done)
+
+# Find or create user in database
+findOrCreateUser = (email, done) ->
+  if dbType is 'mongodb'
+    usersCollection = db.collection('users')
+    usersCollection.findOne { email: email }, (err, user) ->
+      return done(err) if err
+      
+      if user
+        return done(null, user)
+      
+      # Create new user with empty name
+      newUser = 
+        email: email
+        name: ''
+        createdAt: new Date()
+      
+      usersCollection.insert newUser, (err, result) ->
+        return done(err) if err
+        done(null, result[0] || result.ops[0])
+  else
+    # LevelUP
+    db.get 'user:' + email, (err, user) ->
+      if err and not err.notFound
+        return done(err)
+      
+      if user
+        try
+          user = JSON.parse(user) if typeof user is 'string'
+          return done(null, user)
+        catch e
+          return done(e)
+      
+      # Create new user with empty name
+      newUser = 
+        email: email
+        name: ''
+        createdAt: new Date()
+      
+      db.put 'user:' + email, JSON.stringify(newUser), (err) ->
+        return done(err) if err
+        done(null, newUser)
+
+# Update user info
+updateUser = (email, userData, done) ->
+  if dbType is 'mongodb'
+    usersCollection = db.collection('users')
+    usersCollection.findAndModify(
+      { email: email },
+      [],
+      { $set: userData },
+      { new: true, upsert: true },
+      (err, user) ->
+        return done(err) if err
+        done(null, user)
+    )
+  else
+    db.get 'user:' + email, (err, existingUser) ->
+      if err and not err.notFound
+        return done(err)
+      
+      try
+        existingUser = JSON.parse(existingUser) if existingUser and typeof existingUser is 'string'
+      catch e
+        return done(e)
+      
+      existingUser = existingUser || {}
+      updatedUser = {}
+