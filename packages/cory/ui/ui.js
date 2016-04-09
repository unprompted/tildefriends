"use strict";

function fileList(title, prefix, editCallback) {
	terminal.setEcho(false);
	terminal.clear();
	terminal.print(title);
	if (core.user.credentials.permissions.authenticated) {
		terminal.print({command: "new"});
	}

	let makeSaveCallback = function(oldName, oldValue) {
		return function(newName, newValue) {
			print(newName, " ", newValue);
			return database.set(prefix + newName, newValue);
		}
	}
	let backCallback = function() {
		return fileList(title, prefix, editCallback);
	}

	return database.getAll().then(function(entries) {
		terminal.readLine().then(function(input) {
			if (input == "new") {
				editCallback("untitled", "", makeSaveCallback("untitled", ""), backCallback);
			} else if (input.substring(0, "open:".length) == "open:") {
				var title = input.substring("open:".length + prefix.length);
				database.get(prefix + title).then(function(contents) {
					editCallback(title, contents, makeSaveCallback(title, contents), backCallback);
				});
			} else if (input == "home") {
				filelist(title, prefix, editCallback);
			} else if (input.substring(0, "delete:".length) == "delete:") {
				terminal.clear();
				var title = input.substring(7);
				terminal.print("Are you sure you want to delete '", title.substring(prefix.length), "'?");
				terminal.print({command: "confirmDelete:" + title, value: "delete it"});
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
				if (core.user.credentials.permissions.authenticated) {
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
	});
}

function testEdit(name, value, save, back) {
	terminal.clear();
	terminal.print("testEdit ", name, " ", value);
	terminal.print({command: "++"});
	terminal.print({command: "--"});
	terminal.print({command: "back"});
	terminal.readLine().then(function(command) {
		if (command == "back") {
			terminal.print("calling back");
			back();
		} else if (command == "++") {
			save(name, (parseInt(value || "0") + 1).toString()).then(back);
		} else if (command == "--") {
			save(name, (parseInt(value || "0") - 1).toString()).then(back);
		}
	});
}

if (imports.terminal) {
	fileList("Test File List", "fileList_", testEdit);
}

exports.fileList = fileList;