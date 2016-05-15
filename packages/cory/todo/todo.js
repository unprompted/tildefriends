"use strict";

var kUnchecked = "☐";
var kChecked = "☑";

let activeList = null;
let confirmRemove;
let showHidden = false;

terminal.setPrompt("Add Item>");

core.register("onInput", function(command) {
	if (typeof command == "string" && command.substring(0, "action:".length) == "action:") {
		command = JSON.parse(command.substring("action:".length));
		if (confirmRemove && command.action != "reallyRemoveList" && command.action != "reallyRemove") {
			confirmRemove = false;
		}
		if (command.action == "set") {
			setItem(command.key, command.item, command.value).then(notifyChanged).then(redisplay);
		} else if (command.action == "setHidden") {
			setItemHidden(command.key, command.item, command.hidden).then(notifyChanged).then(redisplay);
		} else if (command.action == "setShowHidden") {
			showHidden = !showHidden;
			redisplay();
		} else if (command.action == "makePublic") {
			let key = JSON.parse(command.key);
			delete key.user;
			key.public = true;
			let newKey = JSON.stringify(key);
			readList(command.key).then(function(data) {
				return writeList(newKey, data);
			}).then(function() {
				activeList = newKey;
				return database.remove(command.key);
			}).then(redisplay);
		} else if (command.action == "remove") {
			confirmRemove = command;
			redisplay();
		} else if (command.action == "reallyRemove") {
			confirmRemove = false;
			removeItem(command.key, command.item).then(notifyChanged).then(redisplay);
		} else if (command.action == "editList") {
			activeList = command.key;
			terminal.setHash(activeList);
			redisplay();
		} else if (command.action == "lists") {
			activeList = null;
			redisplay();
		} else if (command.action == "removeList") {
			confirmRemove = true;
			redisplay();
		} else if (command.action == "reallyRemoveList") {
			confirmRemove = false;
			activeList = null;
			database.remove(command.key).then(notifyChanged).then(redisplay).catch(function(error) {
				terminal.print(JSON.stringify(error));
				terminal.print(command.key);
			});
		}
	} else if (typeof command == "string") {
		if (activeList) {
			addItem(activeList, command).then(notifyChanged).then(redisplay);
		} else {
			activeList = makePrivateKey(command);
			writeList(activeList, {name: command, items: []}).then(notifyChanged).then(redisplay);
		}
	} else if (command.hash) {
		activeList = command.hash;
		if (activeList.charAt(0) == "#") {
			activeList = activeList.substring(1);
		}
		redisplay();
	}
});

core.register("onMessage", function(message) {
	return redisplay();
});

function notifyChanged() {
	return core.broadcast({changed: true});
}

function readList(key) {
	return database.get(key).catch(function(error) {
		return null;
	}).then(function(todo) {
		try {
			todo = JSON.parse(todo);
		} catch (error) {
			todo = {name: "TODO", items: []};
		}
		return todo;
	});
}

function writeList(key, todo) {
	return database.set(key, JSON.stringify(todo));
}

function addItem(key, name) {
	return readList(key).then(function(todo) {
		todo.items.push({name: name, value: false});
		return writeList(key, todo);
	});
}

function setItem(key, name, value) {
	return readList(key).then(function(todo) {
		for (var i = 0; i < todo.items.length; i++) {
			if (todo.items[i].name == name) {
				todo.items[i].value = value;
			}
		}
		return writeList(key, todo);
	});
}

function setItemHidden(key, name, hidden) {
	return readList(key).then(function(todo) {
		for (var i = 0; i < todo.items.length; i++) {
			if (todo.items[i].name == name) {
				todo.items[i].hidden = hidden;
			}
		}
		return writeList(key, todo);
	});
}

function removeItem(key, name) {
	return readList(key).then(function(todo) {
		todo.items = todo.items.filter(function(item) {
			return item.name != name;
		});
		return writeList(key, todo);
	});
}

function printList(name, key, items) {
	terminal.print(name,
		" - ",
		{command: "action:" + JSON.stringify({action: "setShowHidden", value: !showHidden}), value: showHidden ? "stop showing hidden" : "show hidden"},
		" - ",
		{command: "action:" + JSON.stringify({action: "lists"}), value: "back"},
		" - ",
		{command: "action:" + JSON.stringify({action: (confirmRemove === true ? "reallyRemoveList" : "removeList"), key: key}), value: (confirmRemove === true ? "confirm remove" : "remove list")},
		JSON.parse(key).public ? "" : [" - ", {command: "action:" + JSON.stringify({action: "makePublic", key: key}), value: "make public"}]);
	terminal.print("=".repeat(name.length));
	for (var i = 0; i < items.length; i++) {
		var visible = !items[i].hidden;
		if (showHidden || visible) {
			var isChecked = items[i].value;
			var style = ["", "text-decoration: line-through"];
			terminal.print(
				{command: "action:" + JSON.stringify({action: "set", key: key, item: items[i].name, value: !isChecked}), value: isChecked ? kChecked : kUnchecked},
				" ",
				{style: style[isChecked ? 1 : 0], value: items[i].name},
				" (",
				{command: "action:" + JSON.stringify({
					action: "setHidden",
					key: key,
					item: items[i].name,
					hidden: visible,
				}), value: visible ? "hide" : "unhide"},
				" ",
				{command: "action:" + JSON.stringify({
					action: (confirmRemove && confirmRemove.item == items[i].name ? "reallyRemove" : "remove"),
					key: key,
					item: items[i].name}), value: (confirmRemove && confirmRemove.item == items[i].name ? "confirm remove" : "remove")},
				")");
		}
	}
}

function redisplay() {
	terminal.clear();
	terminal.setEcho(false);
	if (activeList) {
		readList(activeList).then(function(data) {
			printList(getName(activeList), activeList, data.items);
		}).catch(function(error) {
			terminal.print("error: " + error);
		});
	} else {
		printListOfLists();
	}
}

function makeId() {
	var alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	var result = "";
	for (var i = 0; i < 32; i++) {
		result += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
	}
	return result;
}

function makePublicKey(name) {
	return JSON.stringify({public: true, id: makeId(), name: name});
}

function makePrivateKey(name) {
	return JSON.stringify({public: false, id: makeId(), name: name, user: core.user.name});
}

function hasPermission(key) {
	let result = false;
	try {
		let data = JSON.parse(key);
		result = data.public || data.user == core.user.name || !data.user;
	} catch (error) {
		result = true;
	}
	return result;
}

function getName(key) {
	let name = "TODO";
	try {
		name = JSON.parse(key).name || name;
	} catch (error) {
	}
	return name;
}

function isPrivate(key) {
	let isPrivate = false;
	try {
		isPrivate = !JSON.parse(key).public;
	} catch (error) {
	}
	return isPrivate;
}

function getVisibleLists() {
	return database.getAll().then(function(data) {
		return data.filter(hasPermission);
	});
}

function printListOfLists() {
	terminal.print("TODO Lists:");
	getVisibleLists().then(function(keys) {
		for (var i = 0; i < keys.length; i++) {
			let key = keys[i];
			terminal.print({
				command: "action:" + JSON.stringify({action: "editList", key: key}),
				value: getName(key),
			}, " ", isPrivate(key) ? "(private)" : "(public)");
		}
	});
}

redisplay();
