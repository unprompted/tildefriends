"use strict";

//! {"category": "libraries", "permissions": ["network"]}

terminal.print("Hello, world!");

let kServer = "localhost";

class Smtp {
	constructor() {
		this.inBuffer = "";
		this.sentFrom = false;
		this.sentTo = false;
		this.sentData = false;
	}

	send(message) {
		let self = this;
		self.message = message;
		return new Promise(function(resolve, reject) {
			self.resolve = resolve;
			self.reject = reject;
			network.newConnection().then(function(socket) {
				self.socket = socket;
				socket.read(function(data) {
					try {
						self.dataReceived(data);
					} catch (error) {
						reject(error.message);
					}
				});
				socket.connect(kServer, 25).catch(reject);
			});
		});
	}

	dataReceived(data) {
		let self = this;
		if (data === null) {
			return;
		}
		self.inBuffer += data;
		let again = true;
		while (again) {
			again = false;
			let end = self.inBuffer.indexOf("\n");
			if (end != -1) {
				again = true;
				let line = self.inBuffer.substring(0, end);
				self.inBuffer = self.inBuffer.substring(end + 1);
				self.lineReceived(line);
			}
		}
	}

	lineReceived(line) {
		let self = this;
		let parts = line.split(" ", 1);
		if (parts[0] == "220") {
			self.socket.write("HELO " + kServer + "\r\n");
		} else if (parts[0] == "250") {
			if (!self.sentFrom) {
				self.socket.write("MAIL FROM: " + self.message.from + "\r\n");
				self.sentFrom = true;
			} else if (!self.sentTo) {
				self.socket.write("RCPT TO: " + self.message.to + "\r\n");
				self.sentTo = true;
			} else if (!self.sentData) {
				self.socket.write("DATA\r\n");
				self.sentData = true;
			} else {
				self.socket.write("QUIT\r\n").then(self.resolve);
			}
		} else if (parts[0] == "354") {
			self.socket.write("Subject: " + self.message.subject + "\r\n\r\n" + self.message.body + "\r\n.\r\n");
		} else {
			self.reject("Unexpected response: " + line);
		}
	}
}

function sendMail(message) {
	return new Smtp().send(message);
}

core.register("onInput", function(input) {
	sendMail({
		from: core.user.name + "@unprompted.com",
		to: "test1@unprompted.com",
		subject: input,
		body: input,
	}).then(function() {
		terminal.print("sent");
	}).catch(function(error) {
		terminal.print("error: ", error);
	});
});

exports.sendMail = sendMail;