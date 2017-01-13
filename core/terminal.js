"use strict";

var kStaticFiles = [
	{uri: '', path: 'index.html', type: 'text/html; charset=UTF-8'},
	{uri: '/edit', path: 'edit.html', type: 'text/html; charset=UTF-8'},
	{uri: '/style.css', path: 'style.css', type: 'text/css; charset=UTF-8'},
	{uri: '/favicon.png', path: 'favicon.png', type: 'image/png'},
	{uri: '/client.js', path: 'client.js', type: 'text/javascript; charset=UTF-8'},
	{uri: '/editor.js', path: 'editor.js', type: 'text/javascript; charset=UTF-8'},
	{uri: '/agplv3-88x31.png', path: 'agplv3-88x31.png', type: 'image/png'},
	{uri: '/robots.txt', path: 'robots.txt', type: 'text/plain; charset=UTF-8'},
];

var auth = require('auth');
var form = require('form');

function Terminal() {
	this._index = 0;
	this._firstLine = 0;
	this._sentIndex = -1;
	this._lines = [];
	this._lastRead = null;
	this._lastWrite = null;
	this._echo = true;
	this._readLine = null;
	this._selected = null;
	this._corked = 0;
	this._onOutput = null;
	return this;
}

Terminal.kBacklog = 64;

Terminal.prototype.readOutput = function(callback) {
	this._onOutput = callback;
	this.dispatch();
}

Terminal.prototype.dispatch = function(data) {
	var payload = this._lines.slice(Math.max(0, this._sentIndex + 1 - this._firstLine));
	if (data) {
		payload.push(data);
	}
	if (this._onOutput && (this._sentIndex < this._index - 1 || data)) {
		this._sentIndex = this._index - 1;
		this._onOutput({lines: payload});
	}
}

Terminal.prototype.feedWaiting = function(waiting, data) {
}

Terminal.prototype.print = function() {
	var data = arguments;
	if (this._selected) {
		data = {
			terminal: this._selected,
			value: data
		};
	}
	this._lines.push(data);
	this._index++;
	if (this._lines.length >= Terminal.kBacklog * 2) {
		this._firstLine = this._index - Terminal.kBacklog;
		this._lines = this._lines.slice(this._lines.length - Terminal.kBacklog);
	}
	if (this._corked == 0) {
		this.dispatch();
	}
	this._lastWrite = new Date();
}

Terminal.prototype.notifyUpdate = function() {
	this.print({action: "update"});
}

Terminal.prototype.select = function(name) {
	this._selected = name;
}

Terminal.prototype.ping = function() {
	this.dispatch({action: "ping"});
}

Terminal.prototype.setEcho = function(echo) {
	this._echo = echo;
}

Terminal.prototype.readLine = function() {
	var self = this;
	if (self._readLine) {
		self._readLine[1]();
	}
	return new Promise(function(resolve, reject) {
		self._readLine = [resolve, reject];
	});
}

Terminal.prototype.cork = function() {
	this._corked++;
}

Terminal.prototype.uncork = function() {
	if (--this._corked == 0) {
		this.dispatch();
	}
}

Terminal.prototype.makeFunction = function(api) {
	let self = this;
	return function() {
		let message = {action: api[0]};
		for (let i = 1; i < api.length; i++) {
			message[api[i]] = arguments[i - 1];
		}
		self.print(message);
	}
}

function invoke(handlers, argv) {
	var promises = [];
	if (handlers) {
		for (var i = 0; i < handlers.length; ++i) {
			try {
				promises.push(handlers[i].apply({}, argv));
			} catch (error) {
				handlers.splice(i, 1);
				i--;
				promises.push(new Promise(function(resolve, reject) { reject(error); }));
			}
		}
	}
	return Promise.all(promises);
}

function socket(request, response, client) {
	var process;

	var options = {};
	var credentials = auth.query(request.headers);
	if (credentials && credentials.session) {
		options.userName = credentials.session.name;
	}
	options.credentials = credentials;

	response.onMessage = async function(event) {
		if (event.opCode == 0x1 || event.opCode == 0x2) {
			var message;
			try {
				message = JSON.parse(event.data);
			} catch (error) {
				print("ERROR", error, event.data, event.data.length, event.opCode);
				return;
			}
			if (message.action == "hello") {
				var packageOwner;
				var packageName;
				var match;
				if (match = /^\/\~([^\/]+)\/([^\/]+)(.*)/.exec(message.path)) {
					packageOwner = match[1];
					packageName = match[2];
				}
				var sessionId = makeSessionId();
				response.send(JSON.stringify({lines: [{action: "session", sessionId: sessionId, credentials: credentials}]}), 0x1);

				options.terminalApi = message.terminalApi || [];
				process = await getSessionProcess(packageOwner, packageName, sessionId, options);
				process.terminal.readOutput(function(message) {
					response.send(JSON.stringify(message), 0x1);
				});

				var ping = function() {
					var now = Date.now();
					var again = true;
					if (now - process.lastActive < process.timeout) {
						// Active.
					} else if (process.lastPing > process.lastActive) {
						// We lost them.
						process.task.kill();
						again = false;
					} else {
						// Idle.  Ping them.
						response.send("", 0x9);
						process.lastPing = now;
					}

					if (again) {
						setTimeout(ping, process.timeout);
					}
				}

				if (process.timeout > 0) {
					setTimeout(ping, process.timeout);
				}
			} else if (message.action == "command") {
				var command = message.command;
				var eventName = 'unknown';
				if (typeof command == "string") {
					if (process.terminal._echo) {
						process.terminal.print("> " + command);
					}
					if (process.terminal._readLine) {
						let promise = process.terminal._readLine;
						process.terminal._readLine = null;
						promise[0](command);
					}
					eventName = 'onInput';
				} else if (command.event) {
					eventName = command.event;
				}
				return invoke(process.eventHandlers[eventName], [command]).catch(function(error) {
					process.terminal.print(error);
				});
			}
		} else if (event.opCode == 0x8) {
			// Close.
			process.task.kill();
			response.send(event.data, 0x8);
		} else if (event.opCode == 0xa) {
			// PONG
		}

		if (process) {
			process.lastActive = Date.now();
		}
	}
}

async function handler(request, response, packageOwner, packageName, uri) {
	var found = false;

	if (badName(packageOwner) || badName(packageName)) {
		var data = "File not found";
		response.writeHead(404, {"Content-Type": "text/plain; charset=utf-8", "Content-Length": data.length});
		response.end(data);
		found = true;
	}

	if (!found) {
		for (var i in kStaticFiles) {
			if (uri === kStaticFiles[i].uri) {
				found = true;
				var data = new TextDecoder("UTF-8").decode(File.readFile("core/" + kStaticFiles[i].path));
				if (kStaticFiles[i].uri == "") {
					if (gGlobalSettings && gGlobalSettings['google-signin-client_id']) {
						data = data.replace("<!--HEAD-->", `
		<script src="https://apis.google.com/js/platform.js" async defer></script>
		<meta name="google-signin-client_id" content="${gGlobalSettings['google-signin-client_id']}">`);
					}
					data = data.replace("$(VIEW_SOURCE)", "/~" + packageOwner + "/" + packageName + "/view");
					data = data.replace("$(EDIT_SOURCE)", "/~" + packageOwner + "/" + packageName + "/edit");
				} else if (kStaticFiles[i].uri == "/edit") {
					var source = new TextDecoder("UTF-8").decode(File.readFile("packages/" + packageOwner + "/" + packageName + "/" + packageName + ".js")) || "";
					source = source.replace(/([&<>"])/g, function(x, item) {
						return {'&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;'}[item];
					});
					data = data.replace("$(SOURCE)", source);
				}
				var raw = new TextEncoder("UTF-8").encode(data);
				response.writeHead(200, {"Content-Type": kStaticFiles[i].type, "Content-Length": raw.length});
				response.end(raw);
				break;
			}
		}
	}

	if (!found) {
		var process;
		if (uri === "/view") {
			var data = new TextDecoder("UTF-8").decode(File.readFile("packages/" + packageOwner + "/" + packageName + "/" + packageName + ".js"));
			response.writeHead(200, {"Content-Type": "text/javascript; charset=utf-8", "Content-Length": data.length});
			response.end(data);
		} else if (uri == "/save") {
			var credentials = auth.query(request.headers);
			var userName = credentials && credentials.session && credentials.session.name ? credentials.session.name : "guest";
			if (badName(packageName)) {
				response.writeHead(403, {"Content-Type": "text/plain; charset=utf-8"});
				response.end("Invalid package name: " + packageName);
			} else if (badName(userName)) {
				response.writeHead(403, {"Content-Type": "text/plain; charset=utf-8"});
				response.end("Invalid user name: " + userName);
			} else {
				File.makeDirectory("packages/" + userName);
				File.makeDirectory("packages/" + userName + "/" + packageName);
				if (!File.writeFile("packages/" + userName + "/" + packageName + "/" + packageName + ".js", request.body || "")) {
					response.writeHead(200, {"Content-Type": "text/plain; charset=utf-8"});
					response.end("/~" + userName + "/" + packageName);
					updateProcesses(userName, packageName);
				} else {
					response.writeHead(500, {"Content-Type": "text/plain; charset=utf-8"});
					response.end("Problem saving: " + packageName);
				}
			}
		} else if (uri === "/submit") {
				var process = await getServiceProcess(packageOwner, packageName, "submit");
				process.lastActive = Date.now();
				return process.ready.then(function() {
					var payload = form.decodeForm(request.body, form.decodeForm(request.query));
					return invoke(process.eventHandlers['onSubmit'], [payload]).then(function() {
						response.writeHead(200, {
							"Content-Type": "text/plain; charset=utf-8",
							"Content-Length": "0",
							"Cache-Control": "no-cache, no-store, must-revalidate",
							"Pragma": "no-cache",
							"Expires": "0",
						});
						return response.end("");
					});
				});
		} else if (uri === "/atom") {
			var process = await getServiceProcess(packageOwner, packageName, "atom");
			process.lastActive = Date.now();
			return process.ready.then(function() {
				var payload = form.decodeForm(request.body, form.decodeForm(request.query));
				return invoke(process.eventHandlers['onAtom'], [payload]).then(function(content) {
					var atomContent = content.join();
					response.writeHead(200, {
						"Content-Type": "application/atom+xml; charset=utf-8",
						"Content-Length": atomContent.length.toString(),
						"Cache-Control": "no-cache, no-store, must-revalidate",
						"Pragma": "no-cache",
						"Expires": "0",
					});
					return response.end(atomContent);
				});
			});
		}
	}
}

exports.handler = handler;
exports.socket = socket;
