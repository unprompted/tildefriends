"use strict";
var kAccountsFile = "data/auth/accounts.json";

var gAccounts = {};
var gTokens = {};

var bCryptLib = require('bCrypt');
bCrypt = new bCryptLib.bCrypt();

var form = require('form');
var http = require('http');

File.makeDirectory("data");
File.makeDirectory("data/auth");
File.makeDirectory("data/auth/db");
var gDatabase = new Database("data/auth/db");

try {
	gAccounts = JSON.parse(new TextDecoder("UTF-8").decode(File.readFile(kAccountsFile)));
} catch (error) {
}

function readSession(session) {
	var result = session ? gDatabase.get("session_" + session) : null;

	if (result) {
		result = JSON.parse(result);

		let kRefreshInterval = 1 * 60 * 60 * 1000;
		let now = Date.now();
		if (!result.lastAccess || result.lastAccess < now - kRefreshInterval) {
			result.lastAccess = now;
			writeSession(session, result);
		}
	}

	return result;
}

function writeSession(session, value) {
	gDatabase.set("session_" + session, JSON.stringify(value));
}

function removeSession(session, value) {
	gDatabase.remove("session_" + session);
}

function newSession() {
	var alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	var result = "";
	for (var i = 0; i < 32; i++) {
		result += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
	}
	return result;
}

function verifyPassword(password, hash) {
	return bCrypt.hashpw(password, hash) == hash;
}

function hashPassword(password) {
	var salt = bCrypt.gensalt(12);
	return bCrypt.hashpw(password, salt);
}

function noAdministrator() {
	return !gGlobalSettings || !gGlobalSettings.permissions || !Object.keys(gGlobalSettings.permissions).some(function(name) {
		return gGlobalSettings.permissions[name].indexOf("administration") != -1;
	});
}

function makeAdministrator(name) {
	if (!gGlobalSettings.permissions) {
		gGlobalSettings.permissions = {};
	}
	if (!gGlobalSettings.permissions[name]) {
		gGlobalSettings.permissions[name] = [];
	}
	if (gGlobalSettings.permissions[name].indexOf("administration") == -1) {
		gGlobalSettings.permissions[name].push("administration");
	}
	setGlobalSettings(gGlobalSettings);
}

function authHandler(request, response) {
	var session = getCookies(request.headers).session;
	if (request.uri == "/login") {
		var sessionIsNew = false;
		var loginError;

		var formData = form.decodeForm(request.query);

		if (request.method == "POST" || formData.submit) {
			session = newSession();
			sessionIsNew = true;
			formData = form.decodeForm(request.body, formData);
			if (formData.submit == "Login") {
				if (formData.register == "1") {
					if (!gAccounts[formData.name] &&
						formData.password == formData.confirm) {
						gAccounts[formData.name] = {password: hashPassword(formData.password)};
						writeSession(session, {name: formData.name});
						File.writeFile(kAccountsFile, JSON.stringify(gAccounts));
						if (noAdministrator()) {
							makeAdministrator(formData.name);
						}
					} else {
						loginError = "Error registering account.";
					}
				} else {
					if (gAccounts[formData.name] &&
						gAccounts[formData.name].password &&
						verifyPassword(formData.password, gAccounts[formData.name].password)) {
						writeSession(session, {name: formData.name});
						if (noAdministrator()) {
							makeAdministrator(formData.name);
						}
					} else {
						loginError = "Invalid username or password.";
					}
				}
			} else {
				// Proceed as Guest
				writeSession(session, {name: "guest"});
			}
		}

		var cookie = "session=" + session + "; path=/; Max-Age=604800";
		var entry = readSession(session);
		if (entry && formData.return) {
			response.writeHead(303, {"Location": formData.return, "Set-Cookie": cookie});
			response.end();
		} else {
			var html = new TextDecoder("UTF-8").decode(File.readFile("core/auth.html"));
			var contents = "";

			if (entry) {
				if (sessionIsNew) {
					contents += '<div>Welcome back, ' + entry.name + '.</div>\n';
				} else {
					contents += '<div>You are already logged in, ' + entry.name + '.</div>\n';
				}
				contents += '<div><a href="/login/logout">Logout</a></div>\n';
			} else {
				if (gGlobalSettings && gGlobalSettings['google-signin-client_id']) {
					html = html.replace("<!--HEAD-->", `
		<script src="https://apis.google.com/js/platform.js" async defer></script>
		<meta name="google-signin-client_id" content="${gGlobalSettings['google-signin-client_id']}">
		<script>
			function onGoogleSignIn(user) {
				var token = user.getAuthResponse().id_token;
				var xhr = new XMLHttpRequest();
				xhr.open("POST", "/login/google");
				xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
				xhr.onload = function() {
					if (xhr.status == 200) {
						var redirected = false;
						if (window.location.search.length) {
							var query = window.location.search.substring(1);
							var parts = query.split("&");
							for (var i = 0; i < parts.length; i++) {
								var part = decodeURIComponent(parts[i]);
								var key = part.substring(0, part.indexOf('='));
								var value = part.substring(part.indexOf('=') + 1);
								if (key == "return") {
									redirected = true;
									window.location.href = value;
								}
							}
						}
						if (!redirected) {
							window.location.path = "/";
						}
					} else {
						alert(xhr.response);
					}
				};
				xhr.send('token=' + token);
			}
		</script>
		`);
				}
				contents += '<form method="POST">\n';
				if (loginError) {
					contents += "<p>" + loginError + "</p>\n";
				}
				contents += '<div id="auth_greeting"><b>Halt.  Who goes there?</b></div>\n'
				contents += '<div id="auth">\n';
				contents += '<div id="auth_login">\n'
				if (noAdministrator()) {
					contents += '<div class="notice">There is currently no administrator.  You will be made administrator.</div>\n';
				}
				contents += '<div><label for="name">Name:</label> <input type="text" id="name" name="name" value=""></div>\n';
				contents += '<div><label for="password">Password:</label> <input type="password" id="password" name="password" value=""></div>\n';
				contents += '<div id="confirmPassword" style="display: none"><label for="confirm">Confirm:</label> <input type="password" id="confirm" name="confirm" value=""></div>\n';
				contents += '<div><input type="checkbox" id="register" name="register" value="1" onchange="showHideConfirm()"> <label for="register">Register a new account</label></div>\n';
				contents += '<div><input id="loginButton" type="submit" name="submit" value="Login"></div>\n';
				contents += '</div>';
				contents += '<div class="auth_or"> - or - </div>';
				if (gGlobalSettings && gGlobalSettings['google-signin-client_id']) {
					contents += '<div class="g-signin2" data-onsuccess="onGoogleSignIn" data-scope="profile"></div>';
					contents += '<div class="auth_or"> - or - </div>';
				}
				contents += '<div id="auth_guest">\n';
				contents += '<input id="guestButton" type="submit" name="submit" value="Proceeed as Guest">\n';
				contents += '</div>\n';
				contents += '</div>\n';
				contents += '</form>';
			}
			var text = html.replace("<!--SESSION-->", contents);
			response.writeHead(200, {"Content-Type": "text/html; charset=utf-8", "Set-Cookie": cookie, "Content-Length": text.length});
			response.end(text);
		}
	} else if (request.uri == "/login/logout") {
		removeSession(session);
		response.writeHead(303, {"Set-Cookie": "session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT", "Location": "/login" + (request.query ? "?" + request.query : "")});
		response.end();
	} else if (request.uri == "/login/google") {
		var formData = form.decodeForm(request.query, form.decodeForm(request.body));
		return verifyGoogleToken(formData.token).then(function(user) {
			if (user && user.aud == gGlobalSettings['google-signin-client_id']) {
				session = newSession();
				var userId = user.name;
				if (gAccounts[userId] && !gAccounts[userId].google) {
					response.writeHead(500, {"Content-Type": "text/plain; charset=utf-8", "Connection": "close"});
					response.end("Account already exists and is not a Google account.");
				} else {
					if (!gAccounts[userId]) {
						gAccounts[userId] = {google: true};
						File.writeFile(kAccountsFile, JSON.stringify(gAccounts));
						if (noAdministrator()) {
							makeAdministrator(userId);
						}
					}

					writeSession(session, {name: userId, google: true});

					var cookie = "session=" + session + "; path=/; Max-Age=604800";
					response.writeHead(200, {"Content-Type": "text/json; charset=utf-8", "Connection": "close", "Set-Cookie": cookie});
					response.end(JSON.stringify(user));
				}
			} else {
				response.writeHead(500, {"Content-Type": "text/plain; charset=utf-8", "Connection": "close"});
				response.end();
			}
		});
	} else {
		response.writeHead(200, {"Content-Type": "text/plain; charset=utf-8", "Connection": "close"});
		response.end("Hello, " + request.client.peerName + ".");
	}
}

function verifyGoogleToken(token) {
	return http.get("https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=" + token).then(function(response) {
		return JSON.parse(response.body);
	});
}

function getPermissions(session) {
	var permissions;
	var entry = readSession(session);
	if (entry) {
		permissions = getPermissionsForUser(entry.name);
		permissions.authenticated = entry.name !== "guest";
	}
	return permissions || {};
}

function getPermissionsForUser(userName) {
	var permissions = {};
	if (gGlobalSettings && gGlobalSettings.permissions && gGlobalSettings.permissions[userName]) {
		for (var i in gGlobalSettings.permissions[userName]) {
			permissions[gGlobalSettings.permissions[userName][i]] = true;
		}
	}
	return permissions;
}

function query(headers) {
	var session = getCookies(headers).session;
	var entry;
	if (entry = readSession(session)) {
		return {session: entry, permissions: getPermissions(session)};
	}
}

exports.handler = authHandler;
exports.query = query;
