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
//! 		"libchat"
//! 	]
//! }

let ChatService = require("libchat").ChatService;

class IrcService {
	constructor(options) {
		let self = this;
		self._service = new ChatService(options.callback);
		self._name = options.name;
		self._nick = options.nick;
		self._nameReplies = {};

		network.newConnection().then(function(socket) {
			self._socket = socket;
			return self._connect(options);
		});
	}

	_decode(text) {
		if (text) {
			for (let i = 0; i < text.length; i++) {
				if (text.charCodeAt(i) > 128) {
					text = text.substring(0, i) + "?" + text.substring(i + 1);
				}
			}
		}
		return text;
	}

	_send(line) {
		return this._socket.write(line + "\r\n");
	}

	_receivedLine(originalLine) {
		try {
			let line = this._decode(originalLine);
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
				this._service.notifyMessageReceived(conversation, {
					from: prefix.split('!')[0],
					message: parts[parts.length - 1],
					type: parts[0],
				});
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

		let readBuffer = "";
		self._socket.read(function(data) {
			if (data) {
				readBuffer += data;
				let end = readBuffer.indexOf("\n");
				while (end != -1) {
					let line = readBuffer.substring(0, end);
					if (line.charAt(line.length - 1) == "\r") {
						line = line.substring(0, line.length - 1);
					}
					readBuffer = readBuffer.substring(end + 1);
					self._receivedLine(line);
					end = readBuffer.indexOf("\n");
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