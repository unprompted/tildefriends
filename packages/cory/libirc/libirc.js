"use strict";

//! {
//! 	"category": "libraries",
//! 	"permissions": [
//! 		"network"
//! 	],
//! 	"chat": {
//! 		"version": 1,
//! 		"settings": [
//! 			{"name": "user", "type": "text"},
//! 			{"name": "realName", "type": "text"},
//! 			{"name": "password", "type": "password"},
//! 			{"name": "nick", "type": "text"},
//! 			{"name": "server", "type": "text"},
//! 			{"name": "port", "type": "text"},
//! 			{"name": "autoJoinChannels", "type": "text"}
//! 		]
//! 	},
//! 	"require": [
//! 		"libchat",
//! 		"libencoding"
//! 	]
//! }

let ChatService = require("libchat").ChatService;
require("libencoding");

class IrcService {
	constructor(options) {
		let self = this;
		self._service = new ChatService(options.callback);
		self._name = options.name;
		self._nick = options.nick;
		self._autoJoinChannels = options.autoJoinChannels;
		self._nameReplies = {};

		network.newConnection().then(function(socket) {
			self._socket = socket;
			return self._connect(options);
		});
	}

	_send(line) {
		return this._socket.write(line + "\r\n");
	}

	_receivedLine(originalLine) {
		try {
			let line = originalLine;
			let prefix;
			if (line.charAt(0) == ":") {
				let space = line.indexOf(" ");
				prefix = line.substring(1, space);
				line = line.substring(space + 1);
			}
			let lineNoPrefix = line;
			let remainder;
			let colon = line.indexOf(" :");
			if (colon != -1) {
				remainder = line.substring(colon + 2);
				line = line.substring(0, colon);
			}
			let parts = line.split(" ");
			if (remainder) {
				parts.push(remainder);
			}

			let conversation = "";
			if (parts[0] == "PRIVMSG" || parts[0] == "NOTICE") {
				// Is it a channel type?
				if ("&#!+.".indexOf(parts[1].charAt(0)) != -1) {
					conversation = parts[1];
				} else if (prefix.indexOf('!') != -1) {
					conversation = prefix.split('!')[0];
				}
				let message = {
					from: prefix.split('!')[0],
					message: parts[parts.length - 1],
					type: parts[0],
				};
				if (message.message.length > 2 && message.message.charCodeAt(0) == 1 && message.message.charCodeAt(message.message.length - 1) == 1) {
					message.ctcp = true;
					if (message.message.substring(1, 1 + "ACTION ".length) == "ACTION ") {
						message.action = true;
						message.message = message.message.substring(1 + "ACTION ".length, message.message.length - 1);
					}
				}
				this._service.notifyMessageReceived(conversation, message);
			} else if (parts[0] == "PING") {
				parts[0] = "PONG";
				this._send(parts.join(" "));
			} else if (parts[0] == "JOIN") {
				let person = prefix.split('!')[0];
				let conversation = parts[1];
				this._service.notifyPresenceChanged(conversation, person, "present");
			} else if (parts[0] == "PART") {
				let person = prefix.split('!')[0];
				let conversation = parts[1];
				this._service.notifyPresenceChanged(conversation, person, "unavailable");
			} else if (parts[0] == "QUIT") {
				let person = prefix.split('!')[0];
				let conversations = this._service.getConversations();
				for (let i in conversations) {
					this._service.notifyPresenceChanged(conversations[i], person, "unavailable");
				}
			} else if (parts[0] == "001") { // RPL_WELCOME
				if (this._autoJoinChannels) {
					this._send("JOIN " + this._autoJoinChannels);
				}
			} else if (parts[0] == "353") { // RPL_NAMREPLY
				if (!this._nameReplies[parts[3]]) {
					this._nameReplies[parts[3]] = [];
				}
				let users = parts[4].split(' ');
				for (let i in users) {
					let user = users[i];
					let state = "present";
					if ("@+".indexOf(user.charAt(0)) != -1) {
						state = user.charAt(0);
						user = user.substring(1);
					}
					this._nameReplies[parts[3]][user] = state;
				}
			} else if (parts[0] == "366") { // RPL_ENDOFNAMES
				for (let conversation in this._nameReplies) {
					this._service.notifyParticipantList(conversation, this._nameReplies[conversation]);
				}
				this._nameReplies = {};
			} else {
				this._service.notifyMessageReceived("", {from: prefix, message: lineNoPrefix});
			}
		} catch (error) {
			this._service.reportError(error);
		}
	}

	_connect(options) {
		let self = this;

		let kNewLine = '\n'.charCodeAt(0);
		let kCarriageReturn = '\r'.charCodeAt(0);

		let readBuffer = new Uint8Array(0);
		self._socket.read(function(data) {
			if (data) {
				let newBuffer = new Uint8Array(readBuffer.length + data.length);
				newBuffer.set(readBuffer, 0);
				newBuffer.set(data, readBuffer.length);
				readBuffer = newBuffer;

				let end = readBuffer.indexOf(kNewLine);
				while (end != -1) {
					let line = readBuffer.slice(0, (end > 0 && readBuffer[end - 1] == kCarriageReturn) ? end - 1 : end);
					readBuffer = readBuffer.slice(end + 1);
					self._receivedLine(new TextDecoder("UTF-8").decode(line));
					end = readBuffer.indexOf(kNewLine);
				}
			} else {
				self._service.notifyStateChanged("disconnected");
			}
		});
		return self._socket.connect(options.server, options.port).then(function() {
			self._service.notifyStateChanged("connected");
			self._send("USER " + options.user + " 0 * :" + options.realName);
			self._send("NICK " + options.nick);
		}).catch(self._service.reportError);
	}

	sendMessage(target, text) {
		if (!target) {
			this._socket.write(text + "\r\n");
		} else {
			this._socket.write("PRIVMSG " + target + " :" + text + "\r\n");
		}
		this._service.notifyMessageReceived(target || "", {from: this._nick, message: text, timestamp: new Date().toString()});
	}

	disconnect() {
		this._send("QUIT");
		this._socket.close();
		this._service.notifyStateChanged("disconnected");
		exit(0);
	}
};

ChatService.handleMessages(IrcService);