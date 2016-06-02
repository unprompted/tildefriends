"use strict";

function fileList(settings) {
	let prefix = settings.prefix || "";

	let makeSaveCallback = function(oldName, oldValue) {
		return function(newName, newValue) {
			return database.set(prefix + newName, newValue);
		}
	}
	let backCallback = function() {
		terminal.setHash("");
		return fileList(settings);
	}

	let hashChange = function(event) {
		var name = event.hash.substring(1);
		if (name.length) {
			database.get(prefix + name).then(function(value) {
				settings.edit({
					name: name,
					value: value,
					save: makeSaveCallback(name, value),
					back: backCallback,
				});
			});
		}
	};
	core.register("hashChange", hashChange);

	return database.getAll().then(function(entries) {
		terminal.cork();
		terminal.setEcho(false);
		terminal.clear();
		terminal.print(settings.title);
		if (core.user.credentials
			&& core.user.credentials.permissions
			&& core.user.credentials.permissions.authenticated) {
			terminal.print({command: "new"});
		}

		terminal.readLine().then(function(input) {
			if (input == "new") {
				terminal.setHash(name);
				settings.edit({
					name: "untitled",
					value: "",
					save: makeSaveCallback("untitled", ""),
					back: backCallback
				});
			} else if (input.substring(0, "open:".length) == "open:") {
				let name = input.substring("open:".length + prefix.length);
				terminal.setHash(name);
				database.get(prefix + name).then(function(contents) {
					settings.edit({
						name: name,
						value: contents,
						save: makeSaveCallback(name, contents),
						back: backCallback
					});
				});
			} else if (input == "home") {
				filelist(settings);
			} else if (input.substring(0, "delete:".length) == "delete:") {
				terminal.clear();
				var name = input.substring(7);
				terminal.print("Are you sure you want to delete '", name.substring(prefix.length), "'?");
				terminal.print({command: "confirmDelete:" + name, value: "delete it"});
				terminal.print({command: "home", value: "cancel"});
				terminal.readLine().then(function(input) {
					if (input == "home") {
						backCallback();
					} else if (input.substring(0, "confirmDelete:".length) == "confirmDelete:") {
						var title = input.substring("confirmDelete:".length);
						return database.remove(title).then(backCallback);
					} else {
						backCallback();
					}
				});
			}
		});
		for (var i = 0; i < entries.length; i++) {
			if (entries[i].substring(0, prefix.length) == prefix) {
				if (core.user.credentials
					&& core.user.credentials.permissions
					&& core.user.credentials.permissions.authenticated) {
					terminal.print(
						"* ",
						{style: "font-weight: bold", value: {command: "open:" + entries[i], value: entries[i].substring(prefix.length)}},
						" (",
						{command: "delete:" + entries[i], value: "x"},
						")");
				} else {
					terminal.print(
						"* ",
						{style: "font-weight: bold", value: {command: "open:" + entries[i], value: entries[i].substring(prefix.length)}});
				}
			}
		}
		terminal.uncork();
	});
}

function testEdit(event) {
	terminal.clear();
	terminal.print("testEdit ", event.name, " ", event.value);
	terminal.print({command: "++"});
	terminal.print({command: "--"});
	terminal.print({command: "back"});
	terminal.readLine().then(function(command) {
		if (command == "back") {
			terminal.print("calling back");
			event.back();
		} else if (command == "++") {
			event.save(event.name, (parseInt(event.value || "0") + 1).toString()).then(event.back);
		} else if (command == "--") {
			event.save(event.name, (parseInt(event.value || "0") - 1).toString()).then(event.back);
		}
	});
}

/*if (imports.terminal) {
	fileList({
		title: "Test File List",
		prefix: "fileList_",
		edit: testEdit,
	});
}*/

exports.fileList = fileList;