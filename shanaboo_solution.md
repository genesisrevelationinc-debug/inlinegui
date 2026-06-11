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
+    "express": "~3.4.0",
+    "levelup": "~0.18.0",
+    "leveldown": "~0.10.0",
+    "body-parser": "~1.0.0"
   },
   "devDependencies": {},
   "scripts": {
     "test": "echo \"Error: no test specified\" && exit 1"
   },
   "repository": {
     "type": "git",
     "url": "https://github.com/Docport/inlinegui.git"
   },
   "keywords": [
     "inlinegui",
     "cms",
     "docpad",
     "webwrite"
   ],
   "author": "Docport",
   "license": "MIT",
   "bugs": {
     "url": "https://github.com/Docport/inlinegui/issues"
   },
   "homepage": "https://github.com/Docport/inlinegui"
 }
--- /dev/null
+++ b/src/server.coffee
@@ -0,0 +1,88 @@
+# Server for handling user accounts and Persona authentication
+express = require('express')
+path = require('path')
+levelup = require('levelup')
+
+# Initialize LevelUP database
+db = levelup('./userdb')
+
+# Create Express app
+app = express()
+
+# Middleware
+app.use(express.bodyParser())
+app.use(express.cookieParser())
+app.use(express.session(secret: 'inlinegui-secret-key'))
+
+# Serve static files
+app.use(express.static(path.join(__dirname, '..', 'out')))
+
+# Persona verification endpoint
+app.post '/auth/persona', (req, res) ->
+  assertion = req.body.assertion
+  
+  unless assertion
+    return res.json(400, { status: 'failure', reason: 'No assertion provided' })
+  
+  # Verify assertion with Mozilla's Persona verifier
+  https = require('https')
+  querystring = require('querystring')
+  
+  data = querystring.stringify
+    assertion: assertion
+    audience: req.headers.host
+  
+  options =
+    hostname: 'verifier.login.persona.org'
+    path: '/verify'
+    method: 'POST'
+    headers:
+      'Content-Type': 'application/x-www-form-urlencoded'
+  
+  verifyReq = https.request options, (verifyRes) ->
+    body = ''
+    verifyRes.on 'data', (chunk) -> body += chunk
+    verifyRes.on 'end', ->
+      try
+        verified = JSON.parse(body)
+        
+        if verified.status is 'okay'
+          # Store or update user in database
+          email = verified.email
+          userKey = "user:#{email}"
+          
+          db.get userKey, (err, userData) ->
+            user = if err then {} else JSON.parse(userData)
+            user.email = email
+            user.lastLogin = new Date().toISOString()
+            
+            # Save user to database
+            db.put userKey, JSON.stringify(user), (err) ->
+              if err
+                return res.json(500, { status: 'failure', reason: 'Database error' })
+              
+              req.session.email = email
+              res.json
+                status: 'success'
+                email: email
+                name: user.name or null
+        else
+          res.json(401, { status: 'failure', reason: verified.reason })
+      catch e
+        res.json(500, { status: 'failure', reason: 'Invalid response from verifier' })
+  
+  verifyReq.on 'error', (err) ->
+    res.json(500, { status: 'failure', reason: 'Verification request failed' })
+  
+  verifyReq.write(data)
+  verifyReq.end()
+
+# Logout endpoint
+app.post '/auth/logout', (req, res) ->
+  req.session.destroy()
+  res.json({ status: 'success' })
+
+module.exports = app
--- /dev/null
+++ b/src/files/login.html
@@ -0,0 +1,120 @@
+<!DOCTYPE html>
+<html lang="en">
+<head>
+  <meta charset="UTF-8">
+  <title>Login - InlineGUI</title>
+  <style>
+    * {
+      margin: 0;
+      padding: 0;
+      box-sizing: border-box;
+    }
+    
+    body {
+      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
+      background: #f5f5f5;
+      display: flex;
+      justify-content: center;
+      align-items: center;
+      min-height: 100vh;
+    }
+    
+    .login-container {
+      background: #fff;
+      border-radius: 4px;
+      box-shadow: 0 1px 3px rgba(0,0,0,0.12);
+      width: 400px;
+      padding: 40px;
+    }
+    
+    .login-header {
+      text-align: center;
+      margin-bottom: 30px;
+    }
+    
+    .login-header h1 {
+      font-size: 24px;
+      font-weight: 600;
+      color: #32325d;
+      margin-bottom: 8px;
+    }
+    
+    .login-header p {
+      color: #6b7c93;
+      font-size: 14px;
+    }
+    
+    .form-group {
+      margin-bottom: 20px;
+    }
+    
+    .form-group label {
+      display: block;
+      font-size: 13px;
+      font-weight: 600;
+      color: #32325d;
+      margin-bottom: 6px;
+      text-transform: uppercase;
+    }
+    
+    .form-group input {
+      width: 100%;
+      padding: 12px;
+      border: 1px solid #e0e0e0;
+      border-radius: 4px;
+      font-size: 15px;
+      transition: border-color 0.2s;
+    }
+    
+    .form-group input:focus {
+      outline: none;
+      border-color: #6772e5;
+    }
+    
+    .persona-button {
+      width: 100%;
+      padding: 12px;
+      background