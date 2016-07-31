"use strict";

//! {"require": ["ui"]}

terminal.setEcho(false);
terminal.setTitle("Live Markdeep Editor");

let gEditEvent = null;

function back() {
	terminal.split([{name: "terminal"}]);
	if (gEditEvent) {
		gEditEvent.back();
	}
}

core.register("onWindowMessage", function(event) {
	if (event.message.ready) {
		core.broadcast({title: gEditEvent.name, sync: true});
		terminal.postMessageToIframe("iframe", {title: gEditEvent.name, contents: gEditEvent.value});
	} else if (event.message.index) {
		back();
	} else if (event.message.cursor) {
		core.broadcast({title: gEditEvent.name, user: core.user.index, cursor: event.message.cursor});
	} else if (event.message.change) {
		core.broadcast({title: gEditEvent.name, user: core.user.index, change: event.message.change});
	} else if (event.message.sync) {
		core.broadcast({title: event.message.title, user: core.user.index, contents: event.message.contents});
	} else {
		gEditEvent.save(event.message.title, event.message.contents).then(function() {
			return core.broadcast({title: gEditEvent.name, contents: event.message.contents, sync: true});
		}).then(back);
	}
});

core.register("onMessage", function(sender, message) {
	if (!gEditEvent || message.title == gEditEvent.name) {
		terminal.postMessageToIframe("iframe", message);
	}
});

core.register("onSessionEnd", function(process) {
	terminal.postMessageToIframe("iframe", {user: process.index, cursor: {}});
});

function editPage(event) {
	gEditEvent = event;
	terminal.split([{name: "terminal", type: "vertical"}]);
	terminal.clear();
	terminal.print({iframe: `<html>
		<head>
			<script src="//cdnjs.cloudflare.com/ajax/libs/codemirror/5.13.2/codemirror.min.js"></script>
			<link rel="stylesheet" href="//cdnjs.cloudflare.com/ajax/libs/codemirror/5.13.2/codemirror.min.css"></link>
			<style>
				html {
					height: 100%;
					margin: 0;
					padding: 0;
				}
				body {
					display: flex;
					flex-direction: column;
					height: 100%;
					margin: 0;
					padding: 0;
				}
				#menu {
					flex: 0 0 auto;
				}
				#container {
					flex: 1 1 auto;
					display: flex;
					flex-direction: row;
					width: 100%;
					background-color: white;
				}
				.CodeMirror {
					width: 100%;
					height: 100%;
				}
				.CodeMirror-scroll {
				}
				#edit { background-color: white }
				#preview { background-color: white }
				#edit, #preview {
					display: flex;
					overflow: auto;
					flex: 0 0 50%;
				}
			</style>
			<script>
				var gEditor;
				var gSelections = {};
				function index() {
					parent.postMessage({index: true}, "*");
				}
				function submit() {
					parent.postMessage({
						title: document.getElementById("title").value,
						contents: gEditor.getValue(),
					}, "*");
				}
				function cursorActivity() {
					var selection = gEditor.listSelections();
					var key = "test";
					var a = selection[0].anchor;
					var b = selection[0].head;
					if (b.line < a.line || a.line == b.line && b.ch < a.ch) {
						[a, b] = [b, a];
					}
					parent.postMessage({cursor: {start: a, end: b}}, "*");
				}
				function textChanged(instance, change) {
					var preview = document.getElementById("preview");
					preview.innerHTML = markdeep.format(gEditor.getValue() + "\\n", false);
					if (change && change.origin != "+remote" && change.origin != "setValue") {
						console.debug(change);
						parent.postMessage({change: change}, "*");
					}
				}
				window.markdeepOptions = {mode: 'script'};
			</script>
			<script src="https://casual-effects.com/markdeep/latest/markdeep.min.js"></script>
			<script>
				document.head.innerHTML += markdeep.stylesheet();

				window.addEventListener("message", function(message) {
					if (message.data.contents) {
						document.getElementById("title").value = message.data.title;
						gEditor.setValue(message.data.contents);
						textChanged();
					} else if (message.data.cursor) {
						if (gSelections[message.data.user]) {
							gSelections[message.data.user].clear();
						}
						if (message.data.cursor.start) {
							gSelections[message.data.user] = gEditor.markText(
								message.data.cursor.start,
								message.data.cursor.end,
								{css: "text-decoration: underline"});
						} else {
							delete gSelections[message.data.user];
						}
					} else if (message.data.change) {
						gEditor.replaceRange(message.data.change.text, message.data.change.from, message.data.change.to, "+remote");
					} else if (message.data.sync) {
						parent.postMessage({
							sync: true,
							title: document.getElementById("title").value,
							contents: gEditor.getValue(),
						}, "*");
					}
				}, false);

				window.addEventListener("load", function() {
					gEditor = CodeMirror.fromTextArea(document.getElementById("contents"), {
						lineNumbers: true
					});
					gEditor.on("change", textChanged);
					gEditor.on("cursorActivity", cursorActivity);

					parent.postMessage({ready: true}, "*");
				});
			</script>
		</head>
		<body>
			<div id="menu">
				<input type="button" value="Back" onclick="index()">
` + (core.user.credentials.permissions && core.user.credentials.permissions.authenticated ? `
				<input type="button" value="Save" onclick="submit()">
` : "") +
	`			<a target="_top" href="https://casual-effects.com/markdeep/">Markdeep</a>
				<input type="text" id="title" oninput="textChanged()">
			</div>
			<div id="container">
				<div id="edit"><textarea id="contents" oninput="textChanged()"></textarea></div>
				<div id="preview"></div>
			</div>
		</body>
	</html>`, name: "iframe", style: "flex: 1 1 auto; border: 0; width: 100%"});
}

require("ui").fileList({
	title: "Live Markdeep Editor",
	edit: editPage,
});