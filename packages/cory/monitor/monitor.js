"use strict";

//! {"category": "libraries", "require": ["liblist"]}

function formatUser(user) {
	return [user.name, " ", user.index.toString(), " ", user.packageOwner, " ", user.packageName];
}

let log = require("liblist").ListStore("log");

if (imports.terminal) {
	core.register("onSessionBegin", function(user) {
		terminal.print(new Date().toString(), " begin ", formatUser(user));
	});

	core.register("onSessionEnd", function(user) {
		terminal.print(new Date().toString(), " end ", formatUser(user));
	});

	log.get(-1, -32).then(function(results) {
		for (let result of results) {
			terminal.print(result[0].toString(), " ", result[1], " ", formatUser(result[2]));
		}
	}).catch(terminal.print);

	core.getService("logger");
} else {
	core.register("onSessionBegin", function(user) {
		return log.push([new Date(), "begin", user]);
	});

	core.register("onSessionEnd", function(user) {
		return log.push([new Date(), "end", user]);
	});
}