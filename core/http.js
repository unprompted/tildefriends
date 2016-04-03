"use strict";

function parseUrl(url) {
	// XXX: Hack.
	var match = url.match(new RegExp("(\\w+)://([^/]+)?(.*)"));
	return {
		protocol: match[1],
		host: match[2],
		path: match[3],
		port: match[1] == "http" ? 80 : 443,
	};
}

function parseResponse(data) {
	var firstLine;
	var headers = {};

	while (true) {
		var endLine = data.indexOf("\r\n");
		var line = data.substring(0, endLine);
		if (!firstLine) {
			firstLine = line;
		} else if (!line.length) {
			break;
		} else {
			var colon = line.indexOf(":");
			headers[line.substring(colon)] = line.substring(colon + 1);
		}
		data = data.substring(endLine + 2);
	}
	return {body: data};
}

function get(url) {
	var parsed = parseUrl(url);
	return new Promise(function(resolve, reject) {
		var socket = new Socket();
		var buffer = "";

		return socket.connect(parsed.host, parsed.port).then(function() {
			socket.read(function(data) {
				if (data) {
					buffer += data;
				} else {
					resolve(parseResponse(buffer));
				}
			});

			if (parsed.port == 443) {
				return socket.startTls();
			}
		}).then(function() {
			socket.write(`GET ${parsed.path} HTTP/1.0\r\nHost: ${parsed.host}\r\nConnection: close\r\n\r\n`);
			socket.shutdown();
		}).catch(function(error) {
			reject(error);
		});
	});
}

exports.get = get;
