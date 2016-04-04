"use strict";

terminal.setEcho(false);
terminal.setTitle("Live Markdeep Editor");

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
	terminal.split([{name: "terminal"}]);
	terminal.clear();
	terminal.print("Live Markdeep Editor");
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

core.register("hashChange", function(event) {
	var title = event.hash.substring(1);
	database.get(title).then(function(contents) {
		editPage(title, contents);
	});
});

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
			<div id="menu">
				<input type="button" value="Back" onclick="index()">
` + (core.user.credentials.permissions.authenticated ? `
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

renderIndex();