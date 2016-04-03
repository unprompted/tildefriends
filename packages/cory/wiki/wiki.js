"use strict";

terminal.setEcho(false);

core.register("onInput", function(input) {
	if (input == "new page") {
		editPage("new", "");
	} else if (input == "submit") {
		submitNewPost().then(renderBlog);
	} else if (input == "home") {
		renderIndex();
	} else if (input.substring(0, 5) == "open:") {
		var title = input.substring(5);
		database.get(title).then(function(contents) {
			editPage(title, contents);
		});
	} else if (input.substring(0, 7) == "delete:") {
		terminal.clear();
		var title = input.substring(7);
		terminal.print("Are you sure you want to delete page '", title, "'?");
		terminal.print({command: "confirmDelete:" + title, value: "delete it"});
		terminal.print({command: "home", value: "cancel"});
	} else if (input.substring(0, 14) == "confirmDelete:") {
		var title = input.substring(14);
		database.remove(title).then(renderIndex);
	}
});

function renderIndex() {
	terminal.clear();
	terminal.print("Editor Test");
	if (core.user.credentials.permissions.authenticated) {
		terminal.print({command: "new page"});
	}

	database.getAll().then(function(entries) {
		for (var i = 0; i < entries.length; i++) {
			if (core.user.credentials.permissions.authenticated) {
				terminal.print(
					"* ",
					{style: "font-weight: bold", value: {command: "open:" + entries[i], value: entries[i]}},
					" (",
					{command: "delete:" + entries[i], value: "x"},
					")");
			} else {
				terminal.print(
					"* ",
					{style: "font-weight: bold", value: {command: "open:" + entries[i], value: entries[i]}});
			}
		}
	});
}

var gPage = null;

core.register("onWindowMessage", function(event) {
	if (event.message.ready) {
		terminal.postMessageToIframe("iframe", {title: gPage.title, contents: gPage.contents});
	} else if (event.message.index) {
		renderIndex();
	} else {
		database.set(event.message.title, event.message.contents).then(function() {
			renderIndex();
		});
	}
});

function editPage(title, contents) {
	gPage = {title: title, contents: contents};
	terminal.clear();
	terminal.print({iframe: `<html>
		<head>
			<script src="//cdnjs.cloudflare.com/ajax/libs/codemirror/5.13.2/codemirror.min.js"></script>
			<link rel="stylesheet" href="//cdnjs.cloudflare.com/ajax/libs/codemirror/5.13.2/codemirror.min.css"></link>
			<style>
				html, body {
					position: relative;
					margin: 0;
					padding: 0;
					overflow: hidden;
					height: 100%;
				}
				#container {
					display: flex;
					flex-direction: row;
					height: 100%;
				}
				textarea {
					overflow: auto;
					resize: none;
					flex: 1 0 50%;
				}
				.CodeMirror, .CodeMirror-scroll {
					flex: 1 0 50%;
					height: 100%;
				}
				#preview {
					overflow: auto;
					flex: 1 0 50%;
					height: 100%;
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
					preview.innerHTML = markdeep.format(gEditor.getValue(), true);
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
			<input type="button" value="Back" onclick="index()">
			<input type="button" value="Save" onclick="submit()">
			<input type="text" id="title" style="width: 100%" oninput="textChanged()">
			<div id="container">
				<textarea id="contents" oninput="textChanged()"></textarea>
				<div style="background-color: #ccc" id="preview"></div>
			</div>
		</body>
	</html>`, name: "iframe", style: "width: 100%; border: 0; height: 600px"});
}

renderIndex();