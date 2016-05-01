"use strict";

var gFocus = true;
var gUnread = 0;
var gPresence = {};
let gSessions = {};
let gCurrentConversation;

function updateTitle() {
	terminal.setTitle((gUnread ? "(" + gUnread.toString() + ") " : "") + "Chat");
}

let kAccountsKey = JSON.stringify(["accounts", core.user.name]);

function runCommand(data) {
	if (data.action == "addAccount") {
		addAccount();
	} else if (data.action == "deleteAccount") {
		deleteAccount(data.id);
	} else if (data.action == "updateAccount") {
		delete data.action;
		let id = data.id;
		delete data.id;
		configureAccount(id, data);
	} else if (data.action == "connect") {
		connect(data.id);
	} else if (data.action == "disconnect") {
		disconnect(data.id);
	} else if (data.action == "window") {
		gCurrentConversation = gSessions[data.account].conversations[data.conversation];
		updateConversation();
		updateWindows();
	}
}

function addAccount() {
	return database.get(kAccountsKey).then(function(data) {
		let accounts = data ? JSON.parse(data) : [];
		let id = 0;
		for (var i in accounts) {
			id = Math.max(id, accounts[i].id + 1);
		}
		accounts.push({name: "unnamed", id: id});
		return database.set(kAccountsKey, JSON.stringify(accounts));
	}).then(updateWindows);
}

core.register("submit", function(data) {
	if (data.value.submit == "Save Account") {
		let id = data.value.id;
		delete data.value.id;
		delete data.value.submit;
		configureAccount(id, data.value);
	}
});

function configureAccount(id, updates) {
	return Promise.all([database.get(kAccountsKey), core.getPackages()]).then(function(results) {
		let accounts = results[0] ? JSON.parse(results[0]) : [];
		let packages = results[1];
		let account;
		let accountIndex;
		for (let i in accounts) {
			if (accounts[i].id == id) {
				account = accounts[i];
				accountIndex = i;
			}
		}

		let promises = [];

		if (updates) {
			for (let i in updates) {
				account[i] = updates[i];
			}
			promises.push(database.set(kAccountsKey, JSON.stringify(accounts)));
		}

		return Promise.all(promises).then(function() {
			terminal.clear();
			terminal.print(JSON.stringify(account));
			terminal.print({input: "hidden", value: id, name: "id"});
			terminal.print({input: "text", value: account.name, name: "name"});
			terminal.print({command: "/command " + JSON.stringify({action: "deleteAccount", id: id}), value: "delete account"});
			terminal.print({command: "/command " + JSON.stringify({action: "connect", id: id}), value: "connect"});
			terminal.print({command: "/command " + JSON.stringify({action: "disconnect", id: id}), value: "disconnect"});

			if (!account.type) {
				terminal.print("Pick account type:");
				for (let i in packages) {
					let app = packages[i];
					if (app.manifest && app.manifest.chat) {
						terminal.print({command: "/command " + JSON.stringify({action: "updateAccount", id: id, type: app.name}), value: app.name});
					}
				}
			} else {
				let schema;
				for (let i in packages) {
					let app = packages[i];
					if (app.name == account.type && app.manifest && app.manifest.chat) {
						schema = app.manifest.chat.settings;
						break;
					}
				}
				if (schema) {
					for (var i in schema) {
						let field = schema[i];
						terminal.print({input: field.type, name: field.name, value: account[field.name] || field.default});
					}
				}
			}
			terminal.print({input: "submit", value: "Save Account", name: "submit"});
		}).then(updateWindows);
	}).catch(function(error) {
		print("whoops", error);
	});
}

function deleteAccount(id) {
	return database.get(kAccountsKey).then(function(data) {
		let accounts = data ? JSON.parse(data) : [];
		for (var i = 0; i < accounts.length; i++) {
			if (accounts[i] && (!accounts[i].id || accounts[i].id == id)) {
				accounts.splice(i, 1);
				break;
			}
		}
		return database.set(kAccountsKey, JSON.stringify(accounts));
	}).then(terminal.clear).then(updateWindows);
}

function connect(id) {
	return database.get(kAccountsKey).then(function(data) {
		let accounts = data ? JSON.parse(data) : [];
		let account;
		for (var i = 0; i < accounts.length; i++) {
			if (accounts[i] && (!accounts[i].id || accounts[i].id == id)) {
				account = accounts[i];
				break;
			}
		}

		if (account) {
			let self = {account: account};
			let options = {callback: chatCallback.bind(self)};
			for (var i in account) {
				options[i] = account[i];
			}
			return core.getService("chat", account.type).then(function(service) {
				return service.postMessage(options).then(function(sessions) {
					let session = sessions[0];
					self.session = session;
					gSessions[id] = session;
					session.conversations = {};
					getConversation(session, {});
					session.getConversations().then(function(conversations) {
						print(conversations);
						for (let j in conversations) {
							getConversation(session, {conversation: conversations[j]});
						}
					});
				});
			});
		}
	}).catch(function(error) {
		print(error);
	});
}

function disconnect(id) {
	gSessions[id].disconnect();
}

function updateWindows() {
	database.get(kAccountsKey).then(function(data) {
		let accounts = data ? JSON.parse(data) : [];

		terminal.cork();
		terminal.select("windows");
		terminal.clear();
		terminal.print({style: "font-size: x-large", value: "Windows"});
		for (let i in accounts) {
			let account = accounts[i];
			terminal.print({style: "font-size: large", command: "/command " + JSON.stringify({action: "updateAccount", id: account.id}), value: account.name});
			if (gSessions[account.id] && gSessions[account.id].conversations) {
				let conversations = gSessions[account.id].conversations;
				for (let j in conversations) {
					terminal.print({
						command: "/command " + JSON.stringify({action: "window", account: account.id, conversation: j}),
						value: j ? j : "<service>",
						style: (conversations[j] == gCurrentConversation ? "font-weight: bold; " : "") + "color: white",
					});
				}
			}
		}
		terminal.print({style: "color: yellow", command: "/command " + JSON.stringify({action: "addAccount"}), value: "add account"});
		terminal.select("terminal");
		terminal.uncork();
	}).catch(function(error) {
		print(error);
	});
}

function updateConversation() {
	if (gCurrentConversation) {
		Promise.all([
			gCurrentConversation.session.getHistory(gCurrentConversation.name),
			gCurrentConversation.session.getParticipants(gCurrentConversation.name),
		]).then(function(data) {
			print(data);
			let history = data[0];
			let participants = data[1];
			gCurrentConversation.messages = history;
			gCurrentConversation.participants = participants;
			terminal.cork();
			terminal.select("terminal");
			terminal.clear();
			for (var i in gCurrentConversation.messages) {
				printMessage(gCurrentConversation.messages[i]);
			}
			updateUsers();
			terminal.uncork();
		}).catch(function(error) {
			terminal.print(error);
		});
	}
}

function updateUsers() {
	terminal.cork();
	terminal.select("users");
	terminal.clear();
	terminal.print({style: "font-size: x-large", value: "Users"});
	if (gCurrentConversation) {
		for (var i in gCurrentConversation.participants) {
			terminal.print(gCurrentConversation.participants[i]);
		}
	}
	terminal.select("terminal");
	terminal.uncork();
}

terminal.cork();
terminal.split([
	{type: "horizontal", children: [
		{name: "windows", basis: "2in", grow: "0", shrink: "0"},
		{name: "terminal", grow: "1"},
		{name: "users", basis: "2in", grow: "0", shrink: "0"},
	]},
]);
updateTitle();
updateWindows();
updateUsers();
terminal.setEcho(false);
terminal.select("terminal");
terminal.print("~Friends Chat");
terminal.uncork();

function getConversation(session, message) {
	let result;
	for (var i in gSessions) {
		if (session == gSessions[i]) {
			let key = message.conversation || message.from || "";
			if (!session.conversations[key]) {
				session.conversations[key] = {
					session: session,
					name: key,
					messages: [],
					sendMessage: function(message) {
						return session.sendMessage(key, message);
					},
				};
				updateWindows();
			}
			result = session.conversations[key];
			break;
		}
	}
	if (result && !gCurrentConversation) {
		gCurrentConversation = result;
	}
	return result;
}

function chatCallback(event) {
	print(event);
	if (event.action == "message") {
		let conversation = getConversation(this.session, event);
		if (conversation == gCurrentConversation) {
			printMessage(event);
		}
		conversation.messages.push(event);

		if (!gFocus) {
			gUnread++;
			updateTitle();
		}
	} else {
		terminal.print("Unhandled event: ", JSON.stringify(event));
	}
};

core.register("onInput", function(input) {
	if (input.substring(0, "/command ".length) == "/command ") {
		runCommand(JSON.parse(input.substring("/command ".length)));
	} else if (gCurrentConversation) {
		gCurrentConversation.sendMessage(input).catch(function(error) {
			terminal.print("Message not sent: ", error);
		});
	}
});

function niceTime(lastTime, thisTime) {
	if (!lastTime) {
		return thisTime;
	}
	let result = [];
	let lastParts = lastTime.split(" ");
	let thisParts = thisTime.split(" ");
	for (let i = 0; i < thisParts.length; i++) {
		if (thisParts[i] !== lastParts[i]) {
			result.push(thisParts[i]);
		}
	}
	return result.join(" ");
}

function formatMessage(message) {
	var result;
	if (typeof message == "string") {
		result = [];
		var regex = /(\w+:\/*\S+?)(?=(?:[\.!?])?(?:$|\s))/gi;
		var match;
		var lastIndex = 0;
		while ((match = regex.exec(message)) !== null) {
			result.push({class: "base1", value: message.substring(lastIndex, match.index)});
			result.push({href: match[0]});
			lastIndex = regex.lastIndex;
		}
		result.push({class: "base1", value: message.substring(lastIndex)});
	} else {
		result = message;
	}
	return result;
}

var lastTimestamp = null;
function printMessage(message) {
	var now = message.timestamp || new Date().toString();
	var from = message.from || "unknown";

	terminal.print(
		{class: "base0", value: niceTime(lastTimestamp, now)},
		" ",
		{class: "base00", value: "<"},
		{class: "base3", value: from},
		{class: "base00", value: ">"},
		" ",
		formatMessage(message.message));
	lastTimestamp = now;
}

core.register("focus", function() {
	gFocus = true;
	gUnread = 0;
	updateTitle();
});

core.register("blur", function() {
	gFocus = false;
});

// Connect all accounts on start.
Promise.all([database.get(kAccountsKey), core.getPackages()]).then(function(results) {
	let accounts = results[0] ? JSON.parse(results[0]) : [];
	for (let i in accounts) {
		connect(accounts[i].id);
	}
});