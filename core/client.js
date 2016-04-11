"use strict";

var gHaveIndex = -1;
var gSessionId;
var gCredentials;
var gErrorCount = 0;
var gCommandHistory = [];

var kMaxCommandHistory = 16;

function enter(event) {
	if (event.keyCode == 13) {
		gCommandHistory.push(document.getElementById("input").value);
		if (gCommandHistory.length > kMaxCommandHistory) {
			gCommandHistory.shift();
		}
		send();
		event.preventDefault();
	} else if (event.keyCode == 38) {
		if (gCommandHistory.length) {
			var input = document.getElementById("input");
			gCommandHistory.unshift(input.value);
			input.value = gCommandHistory.pop();
			event.preventDefault();
		}
	} else if (event.keyCode == 40) {
		if (gCommandHistory.length) {
			var input = document.getElementById("input");
			gCommandHistory.push(input.value);
			input.value = gCommandHistory.shift();
			event.preventDefault();
		}
	} else if (event.keyCode == 186
		&& !event.metaKey
		&& !event.altKey
		&& !event.ctrlKey
		&& !event.shiftKey) {
		var value = $("#input").val();
		if (value && value[value.length - 1] == '\\') {
			$("#input").val(value.substring(0, value.length - 1) + ";");
			event.preventDefault();
		} else {
			storeTarget(value);
			$("#input").val("");
			event.preventDefault();
		}
	}
}

function url() {
	var hash = window.location.href.indexOf('#');
	var question = window.location.href.indexOf('?');
	var end = -1;
	if (hash != -1 && (hash < end || end == -1))
	{
		end = hash;
	}
	if (question != -1 && (question < end || end == -1))
	{
		end = question;
	}
	return end != -1 ? window.location.href.substring(0, end) : window.location.href;
}

function hash() {
	return window.location.hash != "#" ? window.location.hash : "";
}

function storeTarget(target) {
	$("#target").text(target || "");
}

function split(container, children) {
	if (container) {
		while (container.firstChild) {
			container.removeChild(container.firstChild);
		}
	}
	if (children) {
		for (var i = 0; i < children.length; i++) {
			if (children[i].name) {
				var node = document.createElement("div");
				node.setAttribute("id", "terminal_" + children[i].name);
				var grow = children[i].grow || "1";
				var shrink = children[i].shrink || "1";
				var basis = children[i].basis || "auto";
				node.setAttribute("style", "flex: " + grow + " " + shrink + " " + basis);

				var classes = ["terminal"];
				if (children[i].type == "vertical") {
					classes.push("vbox");
				} else if (children[i].type == "horizontal") {
					classes.push("hbox");
				}
				node.setAttribute("class", classes.join(" "));
				container.appendChild(node);
			} else if (children[i].type) {
				node = document.createElement("div");
				if (children[i].type == "horizontal") {
					node.setAttribute("class", "hbox");
				} else if (children[i].type == "vertical") {
					node.setAttribute("class", "vbox");
				}
				container.appendChild(node);
				split(node, children[i].children);
			}
		}
	}
}

function receive(data) {
	for (var i in data.lines) {
		var line = data.lines[i];

		var target = document.getElementsByClassName("terminal")[0].id;
		if (line && line.terminal) {
			if (document.getElementById("terminal_" + line.terminal)) {
				target = "terminal_" + line.terminal;
			}
			line = line.value;
		}
		if (line && line.action == "ping") {
			gSocket.send(JSON.stringify({action: "pong"}));
		} else if (line && line.action == "session") {
			gSessionId = line.session.sessionId;
			gCredentials = line.session.credentials;
			updateLogin();
		} else if (line && line[0] && line[0].action == "ready") {
			if (window.location.hash) {
				send({event: "hashChange", hash: window.location.hash});
			}
		} else if (line && line[0] && line[0].action == "notify") {
			new Notification(line[0].title, line[0].options);
		} else if (line && line[0] && line[0].action == "title") {
			window.document.title = line[0].value;
		} else if (line && line[0] && line[0].action == "prompt") {
			var prompt = document.getElementById("prompt");
			while (prompt.firstChild) {
				prompt.removeChild(prompt.firstChild);
			}
			prompt.appendChild(document.createTextNode(line[0].value));
		} else if (line && line[0] && line[0].action == "password") {
			var prompt = document.getElementById("input");
			prompt.setAttribute("type", line[0].value ? "password" : "text");
		} else if (line && line[0] && line[0].action == "hash") {
			window.location.hash = line[0].value;
		} else if (line && line[0] && line[0].action == "update") {
			document.getElementById("update").setAttribute("Style", "display: inline");
		} else if (line && line[0] && line[0].action == "split") {
			split(document.getElementById("terminals"), line[0].options);
		} else if (line && line[0] && line[0].action == "postMessageToIframe") {
			var iframe = document.getElementById("iframe_" + line[0].name);
			if (iframe) {
				iframe.contentWindow.postMessage(line[0].message, "*");
			}
		} else {
			print(document.getElementById(target), line);
		}
	}
	if ("index" in data) {
		gHaveIndex = data.index;
	}
}

function autoNewLine(terminal) {
	terminal.appendChild(document.createElement("br"));
}

function print(terminal, data) {
	autoNewLine(terminal);
	printStructured(terminal, data);
	autoScroll(terminal);
}

function printStructured(container, data) {
	if (typeof data == "string") {
		container.appendChild(document.createTextNode(data));
	} else if (data && data[0] !== undefined) {
		for (var i in data) {
			printStructured(container, data[i]);
		}
	} else if (data && data.action == "clear") {
		while (container.firstChild) {
			container.removeChild(container.firstChild);
		}
	} else if (data) {
		var node;
		if (data.href) {
			node = document.createElement("a");
			node.setAttribute("href", data.href);
			node.setAttribute("target", "_blank");
		} else if (data.iframe) {
			node = document.createElement("iframe");
			node.setAttribute("srcdoc", data.iframe);
			node.setAttribute("sandbox", "allow-forms allow-scripts allow-top-navigation");
			node.setAttribute("width", data.width || 320);
			node.setAttribute("height", data.height || 240);
			if (data.name) {
				node.setAttribute("id", "iframe_" + data.name);
			}
		} else if (data.image) {
			node = document.createElement("img");
			node.setAttribute("src", data.image);
		} else {
			node = document.createElement("span");
		}
		if (data.style) {
			node.setAttribute("style", data.style);
		}
		if (data.class) {
			node.setAttribute("class", data.class);
		}
		var value = data.value || data.href || data.command || "";
		if (!value && data.message && data.stackTrace) {
			printStructured(node, data.message);
			node.appendChild(document.createElement("br"));
			printStructured(node, data.fileName + ":" + data.lineNumber + ":");
			node.appendChild(document.createElement("br"));
			if (data.stackTrace.length) {
				for (var i = 0; i < data.stackTrace.length; i++) {
					printStructured(node, data.stackTrace[i]);
					node.appendChild(document.createElement("br"));
				}
			} else {
				printStructured(node, data.sourceLine);
			}
		} else if (value === undefined) {
			printStructured(node, JSON.stringify(value));
		} else {
			printStructured(node, value);
		}
		if (data.command) {
			node.dataset.command = data.command;
			node.onclick = commandClick;
			node.setAttribute("class", "command");
		}
		container.appendChild(node);
	} else {
		printStructured(container, JSON.stringify(data));
	}
}

function commandClick() {
	send(this.dataset.command);
	$("#input").focus();
}

function autoScroll(terminal) {
	terminal.scrollTop = terminal.scrollHeight - terminal.clientHeight;
}

function send(command) {
	var value = command;
	if (!command) {
		var target = $("#target").text();
		var prefix = target ? target + " " : "";
		value = prefix + $("#input").val();
		$("#input").val("");
	}
	try {
		gSocket.send(JSON.stringify({action: "command", command: value}));
	} catch (error) {
		var node = document.getElementById("status");
		while (node.firstChild) {
			node.removeChild(node.firstChild);
		}
		node.appendChild(document.createTextNode("Send failed: " + error));
		node.setAttribute("style", "display: inline; color: #dc322f");
	}
}

function updateLogin() {
	var login = document.getElementById("login");
	while (login.firstChild) {
		login.removeChild(login.firstChild);
	}

	var a = document.createElement("a");
	if (gCredentials && gCredentials.session) {
		a.appendChild(document.createTextNode("logout " + gCredentials.session.name));
		if (gCredentials.session.google) {
			gapi.load("auth2", function() {
				gapi.auth2.init();
			});
			a.setAttribute("onclick", "logoutGoogle()");
			a.setAttribute("href", "#");
		} else {
			a.setAttribute("href", "/login/logout?return=" + encodeURIComponent(url() + hash()));
		}
	} else if (window.location.href.indexOf("?guest=1") != -1) {
		window.location.href = "/login?submit=Proceed+as+Guest&return=" + encodeURIComponent(url() + hash());
	} else {
		window.location.href = "/login?return=" + encodeURIComponent(url() + hash());
	}
	login.appendChild(a);
}

function logoutGoogle() {
	gapi.auth2.getAuthInstance().signOut().then(function() {
		window.location.href = "/login/logout?return=" + encodeURIComponent(url() + hash());
	});
}

var gOriginalInput;
function dragHover(event) {
	event.stopPropagation();
	event.preventDefault();
	if (event.type == "dragover") {
		if (!$("#input").hasClass("drop")) {
			$("#input").addClass("drop");
			gOriginalInput = $("#input").val();
			$("#input").val("drop file to upload");
		}
	} else {
		$("#input").removeClass("drop");
		$("#input").val(gOriginalInput);
	}
}

function fixImage(sourceData, maxWidth, maxHeight, callback) {
	var result = sourceData;
	var image = new Image();
	image.crossOrigin = "anonymous";
	image.referrerPolicy = "no-referrer";
	image.onload = function() {
		if (image.width > maxWidth || image.height > maxHeight) {
			var downScale = Math.min(maxWidth / image.width, maxHeight / image.height);
			var canvas = document.createElement("canvas");
			canvas.width = image.width * downScale;
			canvas.height = image.height * downScale;
			var context = canvas.getContext("2d");
			context.clearRect(0, 0, canvas.width, canvas.height);
			image.width = canvas.width;
			image.height = canvas.height;
			context.drawImage(image, 0, 0, image.width, image.height);
			result = canvas.toDataURL();
		}
		callback(result);
	};
	image.src = sourceData;
}

function sendImage(image) {
	fixImage(image, 320, 240, function(result) {
		send({image: result});
	});
}

function fileDropRead(event) {
	sendImage(event.target.result);
}

function fileDrop(event) {
	dragHover(event);

	var done = false;
	if (!done) {
		var files = event.target.files || event.dataTransfer.files;
		for (var i = 0; i < files.length; i++) {
			var file = files[i];
			if (file.type.substring(0, "image/".length) == "image/") {
				var reader = new FileReader();
				reader.onloadend = fileDropRead;
				reader.readAsDataURL(file);
				done = true;
			}
		}
	}

	if (!done) {
		var html = event.dataTransfer.getData("text/html");
		var match = /<img.*src="([^"]+)"/.exec(html);
		if (match) {
			sendImage(match[1]);
			done = true;
		}
	}

	if (!done) {
		var text = event.dataTransfer.getData("text/plain");
		if (text) {
			send(text);
			done = true;
		}
	}
}

function enableDragDrop() {
	var body = document.body;
	body.addEventListener("dragover", dragHover);
	body.addEventListener("dragleave", dragHover);

	body.addEventListener("drop", fileDrop);
}

function hashChange() {
	send({event: 'hashChange', hash: window.location.hash});
}

function focus() {
	send({event: "focus"});
}

function blur() {
	send({event: "blur"});
}

function onMessage(event) {
	send({event: "onWindowMessage", message: event.data});
}

var gSocket;

$(document).ready(function() {
	if (Notification) {
		Notification.requestPermission();
	}
	$("#input").keydown(enter);
	$("#input").focus();
	window.addEventListener("hashchange", hashChange);
	window.addEventListener("focus", focus);
	window.addEventListener("blur", blur);
	window.addEventListener("message", onMessage, false);
	enableDragDrop();

	gSocket = new WebSocket(
		(window.location.protocol == "https:" ? "wss://" : "ws://")
		+ window.location.hostname
		+ (window.location.port.length ? ":" + window.location.port : "")
		+ "/terminal/socket");
	gSocket.onopen = function() {
		gSocket.send(JSON.stringify({
			action: "hello",
			path: window.location.pathname,
		}));
	}
	gSocket.onmessage = function(event) {
		receive(JSON.parse(event.data));
	}
});
