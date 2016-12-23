"use strict";

//! {
//!   "permissions": ["network"],
//!   "require": ["libencoding"]
//! }

require("libencoding");

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
		let parsed = parseUrl(url);
		if (!parsed) {
			throw new Error("Failed to parse: " + url);
		}
		let buffer = new Uint8Array(0);

		let socket = await network.newConnection();

		await socket.connect(parsed.host, parsed.port);
		socket.read(function(data) {
			if (data) {
				let newBuffer = new Uint8Array(buffer.length + data.length);
				newBuffer.set(buffer, 0);
				newBuffer.set(data, buffer.length);
				buffer = newBuffer;
			} else {
				resolve(parseResponse(new TextDecoder("UTF-8").decode(buffer)));
				socket.close();
			}
		});

		if (parsed.port == 443) {
			await socket.startTls();
		}

		socket.write(`GET ${parsed.path} HTTP/1.0\r\nHost: ${parsed.host}\r\nConnection: close\r\n\r\n`);
	});
}

exports.get = get;