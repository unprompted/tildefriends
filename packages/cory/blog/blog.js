"use strict";

//! {"category": "work in progress", "require": ["libdocument", "liblist", "ui"]}

let libdocument = require("libdocument");
let liblist = require("liblist");
let libui = require("ui");

class Blog {
	constructor() {
		this._list = liblist.ListStore("blog:list");
		this._documents = libdocument.DocumentStore("blog:posts");
	}

	async renderIndex() {
		terminal.cork();
		try {
			terminal.split([{name: "terminal"}]);
			terminal.clear();
			let posts = await this._list.get(-1, -10);
			for (let i = 0; i < posts.length; i++) {
				let post = await this._documents.get(posts[i]);
				if (post) {
					let formatted = this.formatPost(post);
					for (let j in formatted) {
						terminal.print(formatted[j]);
					}
				}
			}
			if (core.user.credentials.permissions.administration) {
				terminal.print({command: JSON.stringify({action: "new"}), value: "new post"});
			}
		} finally {
			terminal.uncork();
		}
	}

	formatPost(post) {
		let result = [
			[{style: "font-size: xx-large", value: post.title}],
			[{style: "font-size: x-small", value: post.author}, " ", {style: "font-size: x-small", value: post.created}],
			post.body,
		];
		if (core.user.credentials.permissions.administration) {
			result[0].push({command: JSON.stringify({action: "edit", post: post.name}), value: "edit"});
		}
		return result;
	}

	async submitPost(post) {
		let now = new Date();
		let oldPost = await this._documents.get(post.name);
		if (!oldPost) {
			post.created = now;
			post.author = core.user.name;
			this._list.push(post.name);
		} else {
			for (let key in oldPost) {
				if (!post[key]) {
					post[key] = oldPost[key];
				}
			}
		}
		post.modified = now;
		await this._documents.set(post.name, post);
	}

	async deletePost(name) {
		await this._documents.set(name, null);
	}

	async handleCommand(command) {
		if (command.action == "edit") {
			await this.edit(command.post);
		} else if (command.action == "new") {
			await this.edit(null);
		} else if (command.action == "delete") {
			await this.deletePost(command.post);
		}
	}

	async edit(page) {
		terminal.cork();
		try {
			let self = this;
			self._post = await this._documents.get(page);

			if (!this._onWindowMessage) {
				this._onWindowMessage = function(event) {
					let message = event.message;
					if (message == "load") {
						terminal.postMessageToIframe("iframe", self._post);
					} else if (message.action == "save") {
						self.submitPost(message.post).then(self.renderIndex.bind(self)).catch(terminal.print);
					} else if (message.action == "delete") {
						self.deletePost(message.post).then(self.renderIndex.bind(self)).catch(terminal.print);
					} else if (message.action == "back") {
						self.renderIndex.bind(self)().catch(terminal.print);
					}
				}
				core.register("onWindowMessage", this._onWindowMessage);
			}

			terminal.split([{name: "terminal", type: "vertical"}]);
			terminal.clear();
			terminal.print({iframe: `
<!DOCTYPE html>
<html>
	<head>
			<script src="//cdnjs.cloudflare.com/ajax/libs/codemirror/5.13.2/codemirror.min.js"></script>
			<link rel="stylesheet" href="//cdnjs.cloudflare.com/ajax/libs/codemirror/5.13.2/codemirror.min.css"></link>
			<style>
				html, body, #contents {
					height: 100%;
					margin: 0;
					padding: 0;
				}
				body {
					display: flex;
					flex-direction: column;
					color: #fff;
				}
				.CodeMirror {
					width: 100%;
					height: 100%;
				}
				.CodeMirror-scroll {
				}
			</style>
	</head>
	<body>
		<div>
			<input type="button" id="back" value="Back" onclick="back()">
			<input type="button" id="save" value="Save" onclick="save()">
			<input type="button" id="delete" value="Delete" onclick="deletePost()">
		</div>
		<div><label for="name">Name:</label> <input type="text" id="name"></div>
		<div><label for="title">Title:</label> <input type="text" id="title"></div>
		<textarea id="contents" style="width: 100%; height: 100%"></textarea>
		<script>
			var gEditor;
			window.addEventListener("message", function(event) {
				var message = event.data;
				console.debug(message);
				gEditor.setValue(message.body || "");
				document.getElementById("name").value = message.name || "untitled";
				document.getElementById("title").value = message.title || "untitled";
			});
			window.addEventListener("load", function() {
				gEditor = CodeMirror.fromTextArea(document.getElementById("contents"), {
					lineNumbers: true
				});
				//gEditor.on("change", textChanged);
				parent.postMessage("load", "*");
			});
			function back() {
				parent.postMessage({action: "back"}, "*");
			}
			function save() {
				parent.postMessage({
					action: "save",
					post: {
						name: document.getElementById("name").value,
						title: document.getElementById("title").value,
						body: gEditor.getValue(),
					},
				}, "*");
			}
			function deletePost() {
				parent.postMessage({
					action: "delete",
					post: document.getElementById("name").value,
				}, "*");
			}
		</script>
	</body>
</html>
`, name: "iframe", style: "flex: 1 1 auto; width: 100%; margin: 0; border: 0; padding: 0;"});
		} finally {
			terminal.uncork();
		}
	}
}

terminal.setEcho(false);
let blog = new Blog();
blog.renderIndex().catch(terminal.print);

core.register("onInput", async function(input) {
	try {
		await blog.handleCommand(JSON.parse(input));
	} catch (error) {
		terminal.print(error);
	}
});