"use strict";

//! {"category": "work in progress"}

class Log {
	constructor(name, capacity) {
		this._name = name;
		this._capacity = capacity || -1;
	}

	append(item) {
		var log = this;
		return database.get(log._name + "_head").catch(function(error) {
			return 0;
		}).then(function(head) {
			var newHead = (parseInt(head) || 0) + 1;
			var actions = [
				database.set(log._name + "_" + newHead.toString(), JSON.stringify(item)),
				database.set(log._name + "_head", newHead),
			];
			if (log._capacity >= 0) {
				actions.push(log.truncate(newHead - log._capacity));
			}
			return Promise.all(actions);
		});
	}

	truncate(end) {
		var log = this;
		return database.get(log._name + "_" + end.toString()).then(function(item) {
			if (item) {
				return database.remove(log._name + "_" + end.toString()).then(function() {
					return log.truncate(end - 1);
				});
			}
		});
	}

	get(count, start, result) {
		var log = this;
		if (!count) {
			count = 10;
		}

		if (!start) {
			return database.get(log._name + "_head").then(function(head) {
				if (head !== undefined) {
					return log.get(count, parseInt(head));
				} else {
					return [];
				}
			});
		}

		var promises = [];
		promises.length = count;
		for (var i = 0; i < count; i++) {
			promises[i] = database.get(log._name + "_" + (start - i).toString());
		}
		return Promise.all(promises);
	}
};

/*

if (imports.terminal) {
	core.register("onSubmit", function(message) {
		core.broadcast(message);
	});

	core.register("onMessage", function(from, message) {
		terminal.print(JSON.stringify(message));
	});

	terminal.print("Hello, world!");
	var log = new Log("events");

	function dump() {
		return log.get().then(function(data) {
			terminal.print(JSON.stringify(data));
		}).catch(function(error) {
			terminal.print(error);
		});
	}

	core.register("onInput", function(input) {
		log.append({message: input}).then(dump);
	});
}

core.register("onAtom", function(query) {
	return "hello, world!";
});

*/

terminal.setEcho(false);

var gBlog = new Log("blog");

core.register("onInput", function(input) {
	if (input == "new post") {
		startNewPost();
	} else if (input == "submit") {
		submitNewPost().then(function() {
			core.unregister("onWindowMessage", onWindowMessage);
			renderBlog();
		});
	}
});

function renderBlog() {
	terminal.split([
		{name: "terminal"},
	]);
	terminal.select("terminal");

	terminal.print("Blog Test");
	if (core.user.credentials.permissions.authenticated) {
		terminal.print({command: "new post"});
	}

	gBlog.get(10).then(function(entries) {
		for (var i = 0; i < entries.length; i++) {
			var entry = JSON.parse(entries[i]);
			terminal.print({style: "font-weight: bold", value: entry.title});
			terminal.print(entry.entry);
			terminal.print();
		}
	});
}

var gNewPost;

function submitNewPost() {
	return gBlog.append(gNewPost);
}

function onWindowMessage(message) {
	gNewPost = message.message;
	terminal.cork();
	terminal.select("right");
	terminal.clear();
	terminal.print({style: "font-width: x-large", value: message.message.title});
	terminal.print(message.message.entry);
	terminal.print({command: "submit"});
	terminal.uncork();
}

function startNewPost() {
	core.register("onWindowMessage", onWindowMessage);
	terminal.split([
		{
			type: "horizontal",
			children: [
				{name: "left", grow: "0", shrink: "0", basis: "50%"},
				{name: "right", grow: "0", shrink: "0", basis: "50%"},
			],
		}
	]);
	terminal.select("left");
	terminal.print({iframe: `<html>
		<head>
			<style>
				html, body, textarea {
					position: relative;
					width: 100%;
					height: 100%;
					margin: 0;
					padding: 0;
					overflow: hidden;
				}
				textarea {
					overflow: auto;
					resize: none;
				}
			</style>
			<script>
				function textChanged() {
					parent.postMessage({
						title: document.getElementById("title").value,
						entry: document.getElementById("entry").value,
					}, "*");
				}
			</script>
		</head>
		<body>
			<input type="text" id="title" style="width: 100%" oninput="textChanged()">
			<textarea id="entry" oninput="textChanged()"></textarea>
		</body>
	</html>`, style: "overflow: hidden; position: relative; left: 0; top: 0; right: 0; bottom: 0"});
	terminal.select("right");
}

renderBlog();