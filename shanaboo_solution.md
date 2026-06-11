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
+    "docpad": "~6.69.0",
+    "express": "~4.0.0",
+    "body-parser": "~1.0.0",
+    "cookie-parser": "~1.0.0",
+    "express-session": "~1.0.0",
+    "levelup": "~0.18.0",
+    "leveldown": "~0.10.0",
+    "level-session-store": "~1.0.0"
+  },
+  "devDependencies": {
+    "coffee-script": "~1.7.0"
+  }
+}
--- a/docpad.coffee
+++ b/docpad.coffee
@@ -0,0 +1,120 @@
+# Docpad Configuration
+docpadConfig = {
+
+	# =================================
+	# Template Data
+	# These are variables that will be accessible via our templates
+	# To access one of these within our templates, refer to the FAQ: https://github.com/bevry/docpad/wiki/FAQ
+
+	templateData:
+		site:
+			# The production url of our website
+			url: "http://localhost:9778"
+
+			# Here are some old site urls that you would not like to be indexed
+			oldUrls: []
+
+			# The default title of our website
+			title: "InlineGUI"
+
+			# The website description (for SEO)
+			description: """
+				An Inline GUI/CMS for any backend!
+				"""
+
+			# The website keywords (for SEO) separated by commas
+			keywords: """
+				docpad, inlinegui, cms, webwrite
+				"""
+
+			# The website's styles
+			styles: []
+
+			# The website's scripts
+			scripts: []
+
+
+	# =================================
+	# DocPad Events
+
+	events:
+
+		# Server Extend
+		# Used to add our own server-side routes to DocPad's server
+		serverExtend: (opts) ->
+			# Extract the server from the options
+			{server} = opts
+			docpad = @docpad
+
+			# Require our modules
+			express = require('express')
+			bodyParser = require('body-parser')
+			cookieParser = require('cookie-parser')
+			session = require('express-session')
+			LevelUp = require('levelup')
+			LevelSessionStore = require('level-session-store')
+
+			# Initialize LevelUP database
+			db = LevelUp('./data/users', {valueEncoding: 'json'})
+
+			# Session store
+			SessionStore = LevelSessionStore(session)
+
+			# Configure middleware
+			server.use(bodyParser.json())
+			server.use(bodyParser.urlencoded({extended: true}))
+			server.use(cookieParser())
+			server.use(session({
+				secret: 'inlinegui-secret-key',
+				resave: false,
+				saveUninitialized: true,
+				store: new SessionStore('./data/sessions')
+			}))
+
+			# Authentication middleware
+			server.use (req, res, next) ->
+				req.isAuthenticated = -> req.session?.user?
+				req.user = req.session?.user
+				next()
+
+			# Persona verification endpoint
+			server.post '/auth/persona', (req, res) ->
+				assertion = req.body?.assertion
+
+				# Verify the assertion with Mozilla Persona (simplified)
+				# In production, this should verify with https://verifier.login.persona.org/verify
+				if assertion
+					# Mock verification - in production, verify with Persona service
+					# For now, we accept the email from the client
+					email = req.body?.email
+					name = req.body?.name or email?.split('@')[0]
+
+					if email
+						# Check if user exists, if not create
+						db.get email, (err, user) ->
+							if err and err.notFound
+								# Create new user
+								user = {
+									email: email
+									name: name
+									createdAt: new Date().toISOString()
+								}
+								db.put email, user, (err) ->
+									return res.status(500).json({error: 'Database error'}) if err
+									req.session.user = user
+									res.json({success: true, user: user})
+							else if err
+								return res.status(500).json({error: 'Database error'})
+							else
+								# User exists, update session
+								req.session.user = user
+								res.json({success: true, user: user})
+					else
+						res.status(400).json({error: 'Email required'})
+				else
+					res.status(400).json({error: 'Assertion required'})
+
+			# Logout endpoint
+			server.post '/auth/logout', (req, res) ->
+				req.session.destroy()
+				res.json({success: true})
+
+			# Get current user
+			server.get '/auth/user', (req, res) ->
+				if req.isAuthenticated()
+					res.json({success: true, user: req.user})
+				else
+					res.status(401).json({success: false, error: 'Not authenticated'})
+
+			# Update user info
+			server.post '/auth/user', (req, res) ->
+				return res.status(401).json({error: 'Not authenticated'}) unless req.isAuthenticated()
+
