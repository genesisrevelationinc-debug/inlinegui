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
+    "start": "docpad run"
+  },
+  "dependencies": {
+    "docpad": "~6.69.0",
+    "express": "~3.4.0",
+    "levelup": "~0.18.0",
+    "leveldown": "~0.10.0",
+    "body-parser": "~1.0.0",
+    "cookie-parser": "~1.0.0",
+    "express-session": "~1.0.0"
+  },
+  "devDependencies": {},
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
+  "homepage": "https://github.com/Docport/inlinegui"
+}
--- a/docpad.coffee
+++ b/docpad.coffee
@@ -0,0 +1,120 @@
+# Docpad Configuration File
+# http://docpad.org/docs/config
+
+# Import
+pathUtil = require('path')
+
+# =================================
+# DocPad Configuration
+
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
+			url: "http://localhost:9778"
+
+			# Here are some old site urls that you would like to redirect from
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
+			# The website author's name
+			author: "Docport"
+
+			# The website author's email
+			email: "hello@docport.io"
+
+			# Styles
+			styles: [
+				"/styles/style.css"
+			]
+
+			# Scripts
+			scripts: [
+				"/scripts/script.js"
+			]
+
+
+	# =================================
+	# Collections
+
+	collections:
+
+	# =================================
+	# Plugins
+
+	plugins:
+
+	# =================================
+	# DocPad Events
+
+	events:
+
+		# Server Extend
+		# Used to add our own server configuration to DocPad's server
+		serverExtend: (opts) ->
+			# Extract the server from the options
+			{server} = opts
+			{express} = opts.docpad
+
+			# Require our account routes
+			accountRoutes = require('./src/lib/account-routes')
+
+			# Configure body parser
+			server.use(express.bodyParser())
+			server.use(express.cookieParser())
+			server.use(express.session({secret: 'inlinegui-secret-key'}))
+
+			# Add our account routes
+			accountRoutes(server)
+
+			# Return
+			@
+
+}
+
+# Export our DocPad Configuration
+module.exports = docpadConfig
--- /dev/null
+++ b/src/lib/account-routes.coffee
@@ -0,0 +1,95 @@
+# Account Routes
+# Handles saving/creating user accounts with Mozilla Persona
+
+# Import required modules
+path = require('path')
+fs = require('fs')
+
+# Database setup
+dbPath = path.join(process.cwd(), 'data', 'accounts')
+db = null
+
+# Initialize database
+initDatabase = ->
+	try
+		# Try to use LevelUP/LevelDOWN
+		levelup = require('levelup')
+		db = levelup(dbPath)
+		console.log 'Account database initialized at:', dbPath
+	catch err
+		console.error 'Failed to initialize LevelUP database:', err
+		console.error 'Falling back to in-memory storage'
+		# Fallback to simple in-memory storage
+		memoryStore = {}
+		db =
+			get: (key, callback) ->
+				if memoryStore[key]
+					callback(null, memoryStore[key])
+				else
+					callback(new Error('Key not found'))
+			put: (key, value, callback) ->
+				memoryStore[key] = value
+				callback(null) if callback
+			close: (callback) ->
+				callback() if callback
+
+# Initialize database on module load
+initDatabase()
+
+# Account routes
+module.exports = (server) ->
+
+	# Mozilla Persona authentication endpoint
+	server.post '/auth/persona', (req, res) ->
+		assertion = req.body?.assertion
+
+		if !assertion
+			return res.send(400, {error: 'Assertion required'})
+
+		# Verify the assertion with Mozilla's verifier
+		https = require('https')
+		querystring = require('querystring')
+
+		verificationData = querystring.stringify(
+			assertion: assertion
+			audience: req.headers.host or 'localhost:9778'
+		)
+
+		verificationOptions =
+			host: 'verifier.login.persona.org'
+			path: '/verify'
+			method: 'POST'
+			headers:
+				'Content-Type': 'application/x-www-form-urlencoded'
+				'Content-Length': verificationData.length
+
+		verificationReq = https.request verificationOptions, (verificationRes) ->
+			data = ''
+			verificationRes.on 'data', (chunk) -> data += chunk
+			verificationRes.on 'end', ->
+				try
+					response = JSON.parse(data)
+
+					if response.status is 'okay'
+