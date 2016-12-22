"use strict";

//! {"permissions": ["network"]}

function parseUrl(url) {
	// XXX: Hack.
	var match = url.match(new RegExp("(\\w+)://([^/]+)?(.*)"));
	if (match) {
		return {
			protocol: match[1],
			host: match[2],
			path: match[3],
			port: match[1] == "http" ? 80 : 443,
		};
	}
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
			headers[line.substring(0, colon).toLowerCase()] = line.substring(colon + 1).trim();
		}
		data = data.substring(endLine + 2);
	}
	return {body: data, headers: headers};
}

function get(url) {
	return new Promise(async function(resolve, reject) {
		try {
			let parsed = parseUrl(url);
			if (!parsed) {
				throw new Error("Failed to parse: " + url);
			}
			let buffer = "";

			let socket = await network.newConnection();

			await socket.connect(parsed.host, parsed.port);
			socket.read(function(data) {
				if (data) {
					buffer += data;
				} else {
					resolve(parseResponse(buffer));
				}
			});

			if (parsed.port == 443) {
				await socket.startTls();
			}

			socket.write(`GET ${parsed.path} HTTP/1.0\r\nHost: ${parsed.host}\r\nConnection: close\r\n\r\n`);
			//socket.close();
		} catch(error) {
			reject(error);
		}
	});
}

exports.get = get;