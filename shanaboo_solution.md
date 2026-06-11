 ```diff
--- a/package.json
+++ b/package.json
@@ -0,0 +1,45 @@
+{
+  "name": "inlinegui",
+  "version": "0.1.0",
+  "description": "An Inline GUI/CMS for any backend",
+  "main": "docpad.coffee",
+  "scripts": {
+    "start": "docpad run",
+    "test": "echo \"Error: no test specified\" && exit 1"
+  },
+  "repository": {
+    "type": "git",
+    "url": "https://github.com/Docport/inlinegui.git"
+  },
+  "keywords": [
+    "docpad",
+    "inlinegui",
+    "cms",
+    "webwrite"
+  ],
+  "author": "Docport",
+  "license": "MIT",
+  "bugs": {
+    "url": "https://github.com/Docport/inlinegui/issues"
+  },
+  "homepage": "https://github.com/Docport/inlinegui",
+  "dependencies": {
+    "docpad": "~6.78.0",
+    "express": "~3.4.0",
+    "mongodb": "~1.3.0",
+    "levelup": "~0.18.0",
+    "leveldown": "~0.10.0",
+    "passport": "~0.1.18",
+    "passport-persona": "~0.1.7",
+    "cookie-parser": "~1.0.0",
+    "express-session": "~1.0.0",
+    "body-parser": "~1.0.0"
+  },
+  "devDependencies": {
+    "coffee-script": "~1.7.0"
+  }
+}
--- a/docpad.coffee
+++ b/docpad.coffee
@@ -0,0 +1,200 @@
+# Docpad Configuration File
+# http://docpad.org/docs/config
+
+# Define the DocPad Configuration
+docpadConfig = {
+
+	# =================================
+	# Template Data
+	# These are variables that will be accessible via our templates
+	# To access one of these within our templates, refer to the FAQ: https://github.com/bevry/docpad/wiki/FAQ
+
+	templateData:
+
+		# Specify some site properties
+		site:
+			# The production url of our website
+			url: "http://inlinegui.docport.io"
+
+			# Here are some extra site properties that will be available to our templates
+			title: "InlineGUI"
+			description: """
+				An Inline GUI/CMS for any backend!
+				"""
+			keywords: """
+				docpad, inlinegui, cms, webwrite
+				"""
+
+			# The website's styles
+			styles: [
+				'/styles/style.css'
+			]
+
+			# The website's scripts
+			scripts: [
+				'/scripts/script.js'
+			]
+
+
+	# =================================
+	# Collections
+
+	collections:
+		pages: (database) ->
+			database.findAllLive({pageOrder: $exists: true}, [pageOrder:1,title:1])
+
+
+	# =================================
+	# Plugins
+
+	plugins:
+		# Configure the Live Reload plugin
+		livereload:
+			enabled: true
+
+
+	# =================================
+	# Server Extend
+	# Used to add our own server-side code to handle requests
+
+	serverExtend:
+		server: (server, express, docpadInstance) ->
+			# Require our modules
+			path = require('path')
+			fs = require('fs')
+			
+			# Persona Authentication
+			passport = require('passport')
+			PersonaStrategy = require('passport-persona').Strategy
+			
+			# Database setup
+			dbType = process.env.DB_TYPE or 'levelup'
+			db = null
+			
+			# Initialize database based on environment
+			if dbType is 'mongodb'
+				MongoClient = require('mongodb').MongoClient
+				dbUrl = process.env.MONGODB_URL or 'mongodb://localhost:27017/inlinegui'
+				MongoClient.connect dbUrl, (err, database) ->
+					throw err if err
+					db = database
+					console.log 'Connected to MongoDB'
+			else
+				# Default to LevelUP
+				levelup = require('levelup')
+				dbPath = process.env.LEVELUP_PATH or './inlinegui.db'
+				db = levelup(dbPath)
+				console.log 'Connected to LevelUP'
+			
+			# Passport session setup
+			passport.serializeUser (user, done) ->
+				done(null, user.email)
+			
+			passport.deserializeUser (email, done) ->
+				if dbType is 'mongodb'
+					db.collection('users').findOne {email: email}, (err, user) ->
+						done(err, user)
+				else
+					db.get 'user:' + email, (err, userData) ->
+						if err
+							done(err, null)
+						else
+							try
+								user = JSON.parse(userData)
+								done(null, user)
+							catch e
+								done(e, null)
+			
+			# Persona strategy setup
+			audience = process.env.PERSONA_AUDIENCE or 'http://localhost:9778'
+			
+			passport.use new PersonaStrategy
+				audience: audience
+			, (email, done) ->
+				user =
+					email: email
+					name: email.split('@')[0]
+				
+				# Save or update user in database
+				if dbType is 'mongodb'
+					db.collection('users').findAndModify(
+						{email: email},
+						[['email', 1]],
+						{$set: user},
+						{upsert: true, new: true},
+						(err, result) ->
+							return done(err) if err
+							done(null, result)
+					)
+				else
+					db.put 'user:' + email, JSON.stringify(user), (err) ->
+						return done(err) if err
+						done(null, user)
+			
+			# Express middleware
+			server.use(express.cookieParser())
+			server.use(express.bodyParser())
+			server.use(express.session({secret: process.env.SESSION_SECRET or 'inlinegui-secret-key'}))
+			server.use(passport.initialize())
+			server.use(passport.session())
+