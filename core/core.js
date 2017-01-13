"use strict";

require("encoding-indexes");
require("encoding");

var terminal = require("terminal");
var auth = require("auth");
var network = require("network");

var gProcessIndex = 0;
var gProcesses = {};

var gGlobalSettings = {
	index: "/~cory/index",
};

var kGlobalSettingsFile = "data/global/settings.json";

var kPingInterval = 60 * 1000;

function getCookies(headers) {
	var cookies = {};

	if (headers.cookie) {
		var parts = headers.cookie.split(/,|;/);
		for (var i in parts) {
			var equals = parts[i].indexOf("=");
			var name = parts[i].substring(0, equals).trim();
			var value = parts[i].substring(equals + 1).trim();
			cookies[name] = value;
		}
	}

	return cookies;
}

function makeSessionId() {
	var id = "";
	for (var i = 0; i < 64; i++) {
		id += (Math.floor(Math.random() * 16)).toString(16);
	}
	return id;
}

function printError(out, error) {
	if (error.stackTrace) {
		out.print(error.fileName + ":" + error.lineNumber + ": " + error.message);
		out.print(error.stackTrace);
	} else {
		for (var i in error) {
			out.print(i);
		}
		out.print(error.toString());
	}
}

function broadcastEvent(eventName, argv) {
	var promises = [];
	for (var i in gProcesses) {
		var process = gProcesses[i];
		promises.push(invoke(process.eventHandlers[eventName], argv));
	}
	return Promise.all(promises);
}

function broadcast(message) {
	var sender = this;
	var promises = [];
	for (var i in gProcesses) {
		var process = gProcesses[i];
		if (process != sender
			&& process.packageOwner == sender.packageOwner
			&& process.packageName == sender.packageName) {
			var from = getUser(process, sender);
			promises.push(postMessageInternal(from, process, message));
		}
	}
	return Promise.all(promises);
}

function getDatabase(process) {
	if (!process.database) {
		File.makeDirectory("data");
		File.makeDirectory("data/" + process.packageOwner);
		File.makeDirectory("data/" + process.packageOwner + "/" + process.packageName);
		File.makeDirectory("data/" + process.packageOwner + "/" + process.packageName + "/db");
		process.database = new Database("data/" + process.packageOwner + "/" + process.packageName + "/db");
	}
	return process.database;
}

function databaseGet(key) {
	return getDatabase(this).get(key);
}

function databaseSet(key, value) {
	return getDatabase(this).set(key, value);
}

function databaseRemove(key) {
	return getDatabase(this).remove(key);
}

function databaseGetAll() {
	return getDatabase(this).getAll();
}

async function getPackages() {
	var packages = [];
	var packageOwners = File.readDirectory("packages/");
	for (var i = 0; i < packageOwners.length; i++) {
		if (packageOwners[i].charAt(0) != ".") {
			var packageNames = File.readDirectory("packages/" + packageOwners[i] + "/");
			for (var j = 0; j < packageNames.length; j++) {
				if (packageNames[j].charAt(0) != ".") {
					packages.push({
						owner: packageOwners[i],
						name: packageNames[j],
						manifest: await getManifest("packages/" + packageOwners[i] + "/" + packageNames[j] + "/" + packageNames[j] + ".js"),
					});
				}
			}
		}
	}
	return packages;
}

function getUser(caller, process) {
	return {
		name: process.userName,
		key: process.key,
		index: process.index,
		packageOwner: process.packageOwner,
		packageName: process.packageName,
		credentials: process.credentials,
		postMessage: postMessageInternal.bind(caller, caller, process),
	};
}

function getUsers(packageOwner, packageName) {
	var result = [];
	for (var key in gProcesses) {
		var process = gProcesses[key];
		if ((!packageOwner || process.packageOwner == packageOwner)
			&& (!packageName || process.packageName == packageName)) {
			result.push(getUser(this, process));
		}
	}
	return result;
}

function postMessageInternal(from, to, message) {
	return invoke(to.eventHandlers['onMessage'], [getUser(from, from), message]);
}

async function getService(service, packageName) {
	let process = this;
	let serviceName = process.packageName + '_' + service;
	let serviceProcess = await getServiceProcess(process.packageOwner, packageName || process.packageName, serviceName);
	return serviceProcess.ready.then(function() {
		return {
			postMessage: postMessageInternal.bind(process, process, serviceProcess),
		}
	});
}

function getSessionProcess(packageOwner, packageName, session, options) {
	var actualOptions = {terminal: true, timeout: kPingInterval};
	if (options) {
		for (var i in options) {
			actualOptions[i] = options[i];
		}
	}
	return getProcess(packageOwner, packageName, 'session_' + session, actualOptions);
}

function getServiceProcess(packageOwner, packageName, service, options) {
	return getProcess(packageOwner, packageName, 'service_' + packageOwner + '_' + packageName + '_' + service, options || {});
}

function badName(name) {
	var bad = false;
	if (name) {
		for (var i = 0; i < name.length; i++) {
			if ("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz01234567890-_".indexOf(name.charAt(i)) == -1) {
				bad = true;
				break;
			}
		}
	}
	return bad;
}

function readFileUtf8(fileName) {
	return new TextDecoder("UTF-8").decode(File.readFile(fileName));
}

let gManifestCache = {};

async function getManifest(fileName) {
	let oldEntry = gManifestCache[fileName];
	let stat = await File.stat(fileName);
	if (oldEntry) {
		if (oldEntry.stat.mtime == stat.mtime && oldEntry.stat.size == stat.size) {
			return oldEntry.manifest;
		}
	}

	let manifest = [];
	let lines = readFileUtf8(fileName).split("\n").map(x => x.trimRight());
	for (let i = 0; i < lines.length; i++) {
		if (lines[i].substring(0, 4) == "//! ") {
			manifest.push(lines[i].substring(4));
		}
	}
	let result;
	try {
		if (manifest.length) {
			result = JSON.parse(manifest.join("\n"));
		}
	} catch (error) {
		print("ERROR: getManifest(" + fileName + "): ", error);
		// Oh well.  No manifest.
	}

	gManifestCache[fileName] = {
		stat: stat,
		manifest: result,
	};

	return result;
}

function packageNameToPath(name) {
	var process = this;
	return "packages/" + process.packageOwner + "/" + name + "/";
}

async function getProcess(packageOwner, packageName, key, options) {
	var process = gProcesses[key];
	if (!process
		&& !(options && "create" in options && !options.create)
		&& !badName(packageOwner) 
		&& !badName(packageName)) {
		try {
			print("Creating task for " + packageName + " " + key);
			var fileName = "packages/" + packageOwner + "/" + packageName + "/" + packageName + ".js";
			var manifest = await getManifest(fileName);
			process = {};
			process.key = key;
			process.index = gProcessIndex++;
			process.userName = options.userName || ('user' + process.index);
			process.credentials = options.credentials || {};
			process.task = new Task();
			process.eventHandlers = {};
			process.packageOwner = packageOwner;
			process.packageName = packageName;
			if (options.terminal) {
				process.terminal = new Terminal();
			}
			process.database = null;
			process.lastActive = Date.now();
			process.lastPing = null;
			process.timeout = options.timeout;
			process.connections = [];
			var resolveReady;
			var rejectReady;
			process.ready = new Promise(function(resolve, reject) {
				resolveReady = resolve;
				rejectReady = reject;
			});
			gProcesses[key] = process;
			process.task.onExit = function(exitCode, terminationSignal) {
				broadcastEvent('onSessionEnd', [getUser(process, process)]);
				if (process.terminal) {
					if (terminationSignal) {
						process.terminal.print("Process terminated with signal " + terminationSignal + ".");
					} else {
						process.terminal.print("Process ended with exit code " + exitCode + ".");
					}
				}
				for (let i = 0; i < process.connections.length; i++) {
					process.connections[i].close();
				}
				process.connections.length = 0;
				delete gProcesses[key];
			};
			var imports = {
				'core': {
					'broadcast': broadcast.bind(process),
					'getService': getService.bind(process),
					'getPackages': getPackages.bind(process),
					'getUsers': getUsers.bind(process),
					'register': function(eventName, handler) {
						if (!process.eventHandlers[eventName]) {
							process.eventHandlers[eventName] = [];
						}
						process.eventHandlers[eventName].push(handler);
					},
					'unregister': function(eventHandle, handler) {
						if (process.eventHandlers(eventName)) {
							let index = process.eventHandlers[eventName].indexOf(handler);
							if (index != -1) {
								process.eventHandlers[eventName].splice(index, 1);
							}
							if (process.eventHandlers[eventName].length == 0) {
								delete process.eventHandlers[eventName];
							}
						}
					},
					'getUser': getUser.bind(null, process, process),
					'user': getUser(process, process),
				},
				'database': {
					'get': databaseGet.bind(process),
					'set': databaseSet.bind(process),
					'remove': databaseRemove.bind(process),
					'getAll': databaseGetAll.bind(process),
				},
			};
			if (options.terminal) {
				imports.terminal = {
					'print': process.terminal.print.bind(process.terminal),
					'readLine': process.terminal.readLine.bind(process.terminal),
					'setEcho': process.terminal.setEcho.bind(process.terminal),
					'select': process.terminal.select.bind(process.terminal),
					'cork': process.terminal.cork.bind(process.terminal),
					'uncork': process.terminal.uncork.bind(process.terminal),
				};
				if (options.terminalApi) {
					for (let i in options.terminalApi) {
						let api = options.terminalApi[i];
						imports.terminal[api[0]] = process.terminal.makeFunction(api);
					}
				}
			}
			if (manifest
				&& manifest.permissions
				&& manifest.permissions.indexOf("administration") != -1) {
				if (getPermissionsForUser(packageOwner).administration) {
					imports.administration = {
						'setGlobalSettings': setGlobalSettings.bind(process),
						'getGlobalSettings': getGlobalSettings.bind(process),
						'getStatistics': function() { return statistics; },
					};
				} else {
					throw new Error(packageOwner + " does not have right to permission 'administration'.");
				}
			}
			if (manifest
				&& manifest.permissions
				&& manifest.permissions.indexOf("network") != -1) {
				if (getPermissionsForUser(packageOwner).network) {
					imports.network = {
						'newConnection': newConnection.bind(process),
					};
				} else {
					throw new Error(packageOwner + " does not have right to permission 'network'.");
				}
			}
			if (manifest && manifest.require) {
				let source = {};
				for (let i in manifest.require) {
					let name = manifest.require[i];
					source[name] = readFileUtf8("packages/" + process.packageOwner + "/" + name + "/" + name + ".js");
				}
				process.task.setRequires(source);
			}
			process.task.setImports(imports);
			print("Activating task");
			process.task.activate();
			print("Executing task");
			process.task.execute({name: fileName, source: readFileUtf8(fileName)}).then(function() {
				print("Task ready");
				broadcastEvent('onSessionBegin', [getUser(process, process)]);
				resolveReady(process);
				if (process.terminal) {
					process.terminal.print({action: "ready"});
				}
			}).catch(function(error) {
				printError(process.terminal, error);
				rejectReady();
			});
		} catch (error) {
			printError(process.terminal, error);
			rejectReady();
		}
	}
	return process;
}

function updateProcesses(packageOwner, packageName) {
	for (var i in gProcesses) {
		var process = gProcesses[i];
		if (process.packageOwner == packageOwner
			&& process.packageName == packageName) {
			if (process.terminal) {
				process.terminal.notifyUpdate();
			} else {
				process.task.kill();
			}
		}
	}
}

function makeDirectoryForFile(fileName) {
	var parts = fileName.split("/");
	var path = "";
	for (var i = 0; i < parts.length - 1; i++) {
		path += parts[i];
		File.makeDirectory(path);
		path += "/";
	}
}

function getGlobalSettings() {
	return gGlobalSettings;
}

function setGlobalSettings(settings) {
	makeDirectoryForFile(kGlobalSettingsFile);
	if (!File.writeFile(kGlobalSettingsFile, JSON.stringify(settings))) {
		gGlobalSettings = settings;
	} else {
		throw new Error("Unable to save settings.");
	}
}

try {
	gGlobalSettings = JSON.parse(readFileUtf8(kGlobalSettingsFile));
} catch (error) {
	print("Error loading settings from " + kGlobalSettingsFile + ": " + error);
}

var kIgnore = ["/favicon.ico"];

var auth = require("auth");
var httpd = require("httpd");
httpd.all("/login", auth.handler);
httpd.all("", function(request, response) {
	var match;
	if (request.uri === "/" || request.uri === "") {
		response.writeHead(303, {"Location": gGlobalSettings.index, "Content-Length": "0"});
		return response.end();
	} else if (match = /^\/terminal(\/.*)/.exec(request.uri)) {
		return terminal.handler(request, response, null, null, match[1]);
	} else if (match = /^\/\~([^\/]+)\/([^\/]+)(.*)/.exec(request.uri)) {
		return terminal.handler(request, response, match[1], match[2], match[3]);
	} else if (request.uri == "/robots.txt") {
		return terminal.handler(request, response, null, null, request.uri);
	} else {
		var data = "File not found.";
		response.writeHead(404, {"Content-Type": "text/plain; charset=utf-8", "Content-Length": data.length.toString()});
		return response.end(data);
	}
});
httpd.registerSocketHandler("/terminal/socket", terminal.socket);
