 ```diff
--- a/package.json
+++ b/package.json
@@ -0,0 +0,0
-{
-  "name": "inlinegui",
-  "version": "0.1.0",
-  "description": "An Inline GUI/CMS for any backend",
-  "main": "docpad.coffee",
-  "scripts": {
-    "test": "echo \"Error: no test specified\" && exit 1"
-  },
-  "repository": {
-    "type": "git",
-    "url": "https://github.com/Docport/inlinegui.git"
-  },
-  "author": "",
-  "license": "MIT"
-}
+{
+  "name": "inlinegui",
+  "version": "0.1.0",
+  "description": "An Inline GUI/CMS for any backend",
+  "main": "docpad.coffee",
+  "scripts": {
+    "test": "echo \"Error: no test specified\" && exit 1"
+  },
+  "repository": {
+    "type": "git",
+    "url": "https://github.com/Docport/inlinegui.git"
+  },
+  "author": "",
+  "license": "MIT",
+  "dependencies": {
+    "levelup": "~0.18.0",
+    "leveldown": "~0.10.0",
+    "express": "~3.4.0",
+    "body-parser": "~1.0.0"
+  }
+}
--- a/docpad.coffee
+++ b/docpad.coffee
@@ -0,0 +0,0
-# Docpad Configuration File
-# http://docpad.org/docs/config
-
-docpadConfig = {
-	# ...
-}
-
-# Export our DocPad Configuration
-module.exports = docpadConfig
+# Docpad Configuration File
+# http://docpad.org/docs/config
+
+levelup = require('levelup')
+path = require('path')
+
+# Initialize LevelUP database
+dbPath = path.join(__dirname, 'data', 'users')
+db = levelup(dbPath)
+
+docpadConfig = {
+	# Server configuration for Persona authentication and user management
+	serverExtend:
+		server: (server, express, docpadInstance) ->
+			# Parse JSON body
+			express.use(express.bodyParser())
+			
+			# Serve static files for login page
+			express.use('/login', express.static(path.join(__dirname, 'src', 'files', 'login')))
+			
+			# Persona verification endpoint
+			express.post('/auth/persona/verify', (req, res) ->
+				assertion = req.body.assertion
+				
+				# Verify assertion with Mozilla Persona
+				https = require('https')
+				querystring = require('querystring')
+				
+				data = querystring.stringify({
+					assertion: assertion,
+					audience: req.headers.host
+				})
+				
+				options = {
+					host: 'verifier.login.persona.org',
+					path: '/verify',
+					method: 'POST',
+					headers: {
+						'Content-Type': 'application/x-www-form-urlencoded',
+						'Content-Length': Buffer.byteLength(data)
+					}
+				}
+				
+				verifyReq = https.request(options, (verifyRes) ->
+					body = ''
+					verifyRes.on('data', (chunk) -> body += chunk)
+					verifyRes.on('end', () ->
+						try
+							response = JSON.parse(body)
+							
+							if response.status is 'okay'
+								email = response.email
+								
+								# Check if user exists, create if not
+								db.get(email, (err, userData) ->
+									if err and err.notFound
+										# Create new user
+										user = {
+											email: email,
+											name: email.split('@')[0],
+											createdAt: new Date().toISOString()
+										}
+										
+										db.put(email, JSON.stringify(user), (err) ->
+											if err
+												res.status(500).json({status: 'error', message: 'Failed to save user'})
+												return
+											
+											req.session ?= {}
+											req.session.user = user
+											res.json({status: 'okay', email: email, name: user.name})
+										)
+									else if err
+										res.status(500).json({status: 'error', message: 'Database error'})
+									else
+										# User exists, update session
+										user = JSON.parse(userData)
+										req.session ?= {}
+										req.session.user = user
+										res.json({status: 'okay', email: email, name: user.name})
+								)
+							else
+								res.status(403).json({status: 'failure', reason: response.reason})
+						catch e
+							res.status(500).json({status: 'error', message: 'Invalid response from verifier'})
+					)
+				)
+				
+				verifyReq.on('error', (err) ->
+					res.status(500).json({status: 'error', message: 'Verification request failed'})
+				)
+				
+				verifyReq.write(data)
+				verifyReq.end()
+			)
+			
+			# Update user info endpoint
+			express.post('/api/user/update', (req, res) ->
+				email = req.body.email
+				name = req.body.name
+				
+				if not email or not name
+					res.status(400).json({status: 'error', message: 'Email and name required'})
+					return
+				
+				db.get(email, (err, userData) ->
+					if err and err.notFound
+						res.status(404).json({status: 'error', message: 'User not found'})
+					else if err
+						res.status(500).json({status: 'error', message: 'Database error'})
+					else
+						user = JSON.parse(userData)
+						user.name = name
+						
+						db.put(email, JSON.stringify(user), (err) ->
+							if err
+								res.status(500).json({status: 'error', message: 'Failed to update user'})
+								return
+							
+							req.session ?= {}
+							req.session.user = user
+							res.json({status: 'okay', user: user})
+						)
+				)
+			)
+			
+			# Get current user endpoint
+			express.get('/api/user/current', (req, res) ->
+				if req.session?.user
+					res.json({status: 'okay', user: req.session.user})
