"use strict";

var gHandlers = [];
var gSocketHandlers = [];

function logError(error) {
	print("ERROR " + error);
}

function addHandler(handler) {
	var added = false;
	for (var i in gHandlers) {
		if (gHandlers[i].path == handler.path) {
			gHandlers[i] = handler;
			added = true;
			break;
		}
	}
	if (!added) {
		gHandlers.push(handler);
		added = true;
	}
}

function all(prefix, handler) {
	addHandler({
		owner: this,
		path: prefix,
		invoke: handler,
	});
}

function registerSocketHandler(prefix, handler) {
	gSocketHandlers.push({
		owner: this,
		path: prefix,
		invoke: handler,
	});
}

function Request(method, uri, version, headers, body, client) {
	this.method = method;
	var index = uri.indexOf("?");
	if (index != -1) {
		this.uri = uri.slice(0, index);
		this.query = uri.slice(index + 1);
	} else {
		this.uri = uri;
		this.query = undefined;
	}
	this.version = version;
	this.headers = headers;
	this.client = {peerName: client.peerName};
	this.body = body;
	return this;
}

function findHandler(request) {
	var matchedHandler = null;
	for (var name in gHandlers) {
		var handler = gHandlers[name];
		if (request.uri == handler.path || request.uri.slice(0, handler.path.length + 1) == handler.path + '/') {
			matchedHandler = handler;
			break;
		}
	}
	return matchedHandler;
}

function findSocketHandler(request) {
	var matchedHandler = null;
	for (var name in gSocketHandlers) {
		var handler = gSocketHandlers[name];
		if (request.uri == handler.path || request.uri.slice(0, handler.path.length + 1) == handler.path + '/') {
			matchedHandler = handler;
			break;
		}
	}
	return matchedHandler;
}

function Response(request, client) {
	var kStatusText = {
		101: "Switching Protocols",
		200: 'OK',
		303: 'See other',
		403: 'Forbidden',
		404: 'File not found',
		500: 'Internal server error',
	};
	var _started = false;
	var _finished = false;
	var _keepAlive = false;
	var _chunked = false;
	return {
		writeHead: function(status) {
			if (_started) {
				throw new Error("Response.writeHead called multiple times.");
			}
			var reason;
			var headers;
			if (arguments.length == 3) {
				reason = arguments[1];
				headers = arguments[2];
			} else {
				reason = kStatusText[status];
				headers = arguments[1];
			}
			var lowerHeaders = {};
			var requestVersion = request.version.split("/")[1].split(".");
			var responseVersion = (requestVersion[0] >= 1 && requestVersion[0] >= 1) ? "1.1" : "1.0";
			var headerString = "HTTP/" + responseVersion + " " + status + " " + reason + "\r\n";
			for (var i in headers) {
				headerString += i + ": " + headers[i] + "\r\n";
				lowerHeaders[i.toLowerCase()] = headers[i];
			}
			if ("connection" in lowerHeaders) {
				_keepAlive = lowerHeaders["connection"].toLowerCase() == "keep-alive";
			} else {
				_keepAlive = ((request.version == "HTTP/1.0" && ("connection" in lowerHeaders && lowerHeaders["connection"].toLowerCase() == "keep-alive")) ||
					(request.version == "HTTP/1.1" && (!("connection" in lowerHeaders) || lowerHeaders["connection"].toLowerCase() != "close")));
				headerString += "Connection: " + (_keepAlive ? "keep-alive" : "close") + "\r\n";
			}
			_chunked = _keepAlive && !("content-length" in lowerHeaders);
			if (_chunked) {
				headerString += "Transfer-Encoding: chunked\r\n";
			}
			headerString += "\r\n";
			_started = true;
			client.write(headerString);
		},
		end: function(data) {
			if (_finished) {
				throw new Error("Response.end called multiple times.");
			}
			if (data) {
				if (_chunked) {
					client.write(data.length.toString(16) + "\r\n" + data + "\r\n" + "0\r\n\r\n");
				} else {
					client.write(data);
				}
			} else if (_chunked) {
				client.write("0\r\n\r\n");
			}
			_finished = true;
			if (!_keepAlive) {
				client.shutdown();
			}
		},
		reportError: function(error) {
			if (!_started) {
				client.write("HTTP/1.1 500 Internal Server Error\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n");
			}
			if (!_finished) {
				client.write("500 Internal Server Error\r\n\r\n" + error.stackTrace);
				client.shutdown();
			}
			logError(client.peerName + " - - [" + new Date() + "] " + error);
		},
		isConnected: function() { return client.isConnected; },
	};
}

function handleRequest(request, response) {
	var handler = findHandler(request);

	print(request.client.peerName + " - - [" + new Date() + "] " + request.method + " " + request.uri + " " + request.version + " \"" + request.headers["user-agent"] + "\"");

	if (handler) {
		try {
			var promise = handler.invoke(request, response);
			if (promise) {
				promise.catch(function(error) {
					response.reportError(error);
				});
			}
		} catch (error) {
			print(error);
			response.reportError(error);
		}
	} else {
		response.writeHead(200, {"Content-Type": "text/plain; charset=utf-8"});
		response.end("No handler found for request: " + request.uri);
	}
}

function handleWebSocketRequest(request, response, client) {
	var buffer = "";
	var frame = "";
	var frameOpCode = 0x0;

	var handler = findSocketHandler(request);
	if (!handler) {
		client.close();
		return;
	}

	response.send = function(message, opCode) {
		if (opCode === undefined) {
			opCode = 0x2;
		}
		var fin = true;
		var packet = String.fromCharCode((fin ? (1 << 7) : 0) | (opCode & 0xf));
		var mask = false;
		if (message.length < 126) {
			packet += String.fromCharCode((mask ? (1 << 7) : 0) | message.length);
		} else if (message.length < (1 << 16)) {
			packet += String.fromCharCode((mask ? (1 << 7) : 0) | 126);
			packet += String.fromCharCode((message.length >> 8) & 0xff);
			packet += String.fromCharCode(message.length & 0xff);
		} else {
			packet += String.fromCharCode((mask ? (1 << 7) : 0) | 127);
			packet += String.fromCharCode((message.length >> 24) & 0xff);
			packet += String.fromCharCode((message.length >> 16) & 0xff);
			packet += String.fromCharCode((message.length >> 8) & 0xff);
			packet += String.fromCharCode(message.length & 0xff);
		}
		packet += message;
		return client.write(packet);
	}
	response.onMessage = null;

	handler.invoke(request, response);

	client.read(function(data) {
		if (data) {
			buffer += data;
			if (buffer.length >= 2) {
				var bits0 = buffer.charCodeAt(0);
				var bits1 = buffer.charCodeAt(1);
				if (bits1 & (1 << 7) == 0) {
					// Unmasked message.
					client.close();
				}
				var opCode = bits0 & 0xf;
				var fin = bits0 & (1 << 7);
				var payloadLength = bits1 & 0x7f;
				var maskStart = 2;

				if (payloadLength == 126) {
					payloadLength = 0;
					for (var i = 0; i < 2; i++) {
						payloadLength <<= 8;
						payloadLength |= buffer.charCodeAt(2 + i);
					}
					maskStart = 4;
				} else if (payloadLength == 127) {
					payloadLength = 0;
					for (var i = 0; i < 8; i++) {
						payloadLength <<= 8;
						payloadLength |= buffer.charCodeAt(2 + i);
					}
					maskStart = 10;
				}
				var havePayload = buffer.length >= payloadLength + 2 + 4;
				if (havePayload) {
					var mask = buffer.substring(maskStart, maskStart + 4);
					var dataStart = maskStart + 4;
					var decoded = "";
					var payload = buffer.substring(dataStart, dataStart + payloadLength);
					buffer = buffer.substring(dataStart + payloadLength);
					for (var i = 0; i < payloadLength; i++) {
						decoded += String.fromCharCode(payload.charCodeAt(i) ^ mask.charCodeAt(i % 4));
					}

					frame += decoded;
					if (opCode) {
						frameOpCode = opCode;
					}

					if (fin) {
						if (response.onMessage) {
							response.onMessage({
								data: frame,
								opCode: frameOpCode,
							});
						}
						frame = "";
					}
				}
			}
		}
	});
	client.onError(function(error) {
		logError(client.peerName + " - - [" + new Date() + "] " + error);
	});

	response.writeHead(101, {
		"Upgrade": "websocket",
		"Connection": "Upgrade",
		"Sec-WebSocket-Accept": webSocketAcceptResponse(request.headers["sec-websocket-key"]),
	});
}

function webSocketAcceptResponse(key) {
	var kMagic = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
	var kAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
	var hex = require("sha1").hash(key + kMagic)
	var binary = "";
	for (var i = 0; i < hex.length; i += 6) {
		var characters = hex.substring(i, i + 6);
		if (characters.length < 6) {
			characters += "0".repeat(6 - characters.length);
		}
		var value = parseInt(characters, 16);
		for (var bit = 0; bit < 8 * 3; bit += 6) {
			if (i * 8 / 2 + bit >= 8 * hex.length / 2) {
				binary += kAlphabet.charAt(64);
			} else {
				binary += kAlphabet.charAt((value >> (18 - bit)) & 63);
			}
		}
	}
	return binary;
}

function handleConnection(client) {
	var inputBuffer = "";
	var request;
	var headers = {};
	var lineByLine = true;
	var bodyToRead = -1;
	var body;

	function reset() {
		inputBuffer = "";
		request = undefined;
		headers = {};
		lineByLine = true;
		bodyToRead = -1;
		body = undefined;
	}

	function finish() {
		try {
			var requestObject = new Request(request[0], request[1], request[2], headers, body, client);
			var response = new Response(requestObject, client);
			handleRequest(requestObject, response)
			if (client.isConnected) {
				reset();
			}
		} catch (error) {
			response.reportError(error);
		}
	}

	function handleLine(line, length) {
		if (bodyToRead == -1) {
			if (!request) {
				request = line.split(' ');
				return true;
			} else if (line) {
				var colon = line.indexOf(':');
				var key = line.slice(0, colon).trim();
				var value = line.slice(colon + 1).trim();
				headers[key.toLowerCase()] = value;
				return true;
			} else {
				if (headers["content-length"] != undefined) {
					bodyToRead = parseInt(headers["content-length"]);
					lineByLine = false;
					body = "";
					return true;
				} else if (headers["connection"]
					&& headers["connection"].toLowerCase().split(",").map(x => x.trim()).indexOf("upgrade") != -1
					&& headers["upgrade"]
					&& headers["upgrade"].toLowerCase() == "websocket") {
					var requestObject = new Request(request[0], request[1], request[2], headers, body, client);
					var response = new Response(requestObject, client);
					handleWebSocketRequest(requestObject, response, client);
					return false;
				} else {
					finish();
					return false;
				}
			}
		} else {
			body += line;
			bodyToRead -= length;
			if (bodyToRead <= 0) {
				finish();
			}
		}
	}

	client.onError(function(error) {
		logError(client.peerName + " - - [" + new Date() + "] " + error);
	});

	client.read(function(data) {
		if (data) {
			inputBuffer += data;
			var more = true;
			while (more) {
				if (lineByLine) {
					more = false;
					var end = inputBuffer.indexOf('\n');
					var realEnd = end;
					if (end > 0 && inputBuffer[end - 1] == '\r') {
						--end;
					}
					if (end != -1) {
						var line = inputBuffer.slice(0, end);
						inputBuffer = inputBuffer.slice(realEnd + 1);
						more = handleLine(line, realEnd + 1);
					}
				} else {
					more = handleLine(inputBuffer, inputBuffer.length);
					inputBuffer = "";
				}
			}
		}
	});
}

var kBacklog = 8;
var kHost = "0.0.0.0"
var kHttpPort = gGlobalSettings.httpPort || 12345;
var kHttpsPort = gGlobalSettings.httpsPort || 12346;

var socket = new Socket();
socket.bind(kHost, kHttpPort).then(function() {
	var listenResult = socket.listen(kBacklog, function() {
		socket.accept().then(handleConnection).catch(function(error) {
			logError("[" + new Date() + "] " + error);
		});
	});
}).catch(function(error) {
	logError("[" + new Date() + "] " + error);
});

var privateKey = File.readFile("data/httpd/privatekey.pem");
var certificate = File.readFile("data/httpd/certificate.pem");

if (privateKey && certificate) {
	var tls = new TlsContext();
	tls.setPrivateKey(privateKey);
	tls.setCertificate(certificate);

	var secureSocket = new Socket();
	secureSocket.bind(kHost, kHttpsPort).then(function() {
		secureSocket.listen(kBacklog, function() {
			secureSocket.accept().then(function(client) {
				handleConnection(client);
				client.startTls(tls).catch(function(error) {
					logError("[" + new Date() + "] [" + client.peerName + "] " + error);
				});
			}).catch(function(error) {
				logError("[" + new Date() + "] " + error);
			});
		});
	});
}

exports.all = all;
exports.registerSocketHandler = registerSocketHandler;
