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
		terminal.postMessageToIframe("iframe", {title: gEditEvent.name, contents: gEditEvent.value});
	} else if (event.message.index) {
		back();
	} else {
		gEditEvent.save(event.message.title, event.message.contents).then(back);
	}
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
				function index() {
					parent.postMessage({index: true}, "*");
				}
				function submit() {
					parent.postMessage({
						title: document.getElementById("title").value,
						contents: gEditor.getValue(),
					}, "*");
				}
				function textChanged() {
					var preview = document.getElementById("preview");
					preview.innerHTML = markdeep.format(gEditor.getValue() + "\\n", false);
				}
				window.markdeepOptions = {mode: 'script'};
			</script>
			<script src="https://casual-effects.com/markdeep/latest/markdeep.min.js"></script>
			<script>
				document.head.innerHTML += markdeep.stylesheet();

				window.addEventListener("message", function(message) {
					document.getElementById("title").value = message.data.title;
					gEditor.setValue(message.data.contents);
					textChanged();
				}, false);

				window.addEventListener("load", function() {
					gEditor = CodeMirror.fromTextArea(document.getElementById("contents"), {
						lineNumbers: true
					});
					gEditor.on("change", textChanged);
				});

				parent.postMessage({ready: true}, "*");
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