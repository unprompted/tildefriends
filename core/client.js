"use strict";

var gSocket;
var gSessionId;
var gCredentials;
var gErrorCount = 0;
var gCommandHistory = [];
var gSendKeyEvents = false;
var gSendDeviceOrientationEvents = false;
var gGeolocatorWatch;

var kMaxCommandHistory = 16;

function keydown(event) {
	if (event.keyCode == 13) {
		gCommandHistory.push(document.getElementById("input").value);
		if (gCommandHistory.length > kMaxCommandHistory) {
			gCommandHistory.shift();
		}
		send();
		event.preventDefault();
	} else if (event.keyCode == 38 && !event.altKey) {
		if (gCommandHistory.length) {
			var input = document.getElementById("input");
			gCommandHistory.unshift(input.value);
			input.value = gCommandHistory.pop();
			event.preventDefault();
		}
	} else if (event.keyCode == 40 && !event.altKey) {
		if (gCommandHistory.length) {
			var input = document.getElementById("input");
			gCommandHistory.push(input.value);
			input.value = gCommandHistory.shift();
			event.preventDefault();
		}
	} else if (event.keyCode == 69 && event.altKey) {
		window.location.href = url() + "/edit";
		event.preventDefault();
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
				var style = children[i].style || "";
				node.setAttribute("style", style + "; flex: " + grow + " " + shrink + " " + basis);

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
			gSessionId = line.sessionId;
			gCredentials = line.credentials;
			updateLogin();
		} else if (line && line[0] && line[0].action == "ready") {
			if (window.location.hash) {
				send({event: "hashChange", hash: window.location.hash});
			}
		} else if (line && line[0] && line[0].action == "notify") {
			if (window.Notification) {
				new Notification(line[0].title, line[0].options);
			}
		} else if (line && line[0] && line[0].action == "setTitle") {
			window.document.title = line[0].value;
		} else if (line && line[0] && line[0].action == "setPrompt") {
			var prompt = document.getElementById("prompt");
			while (prompt.firstChild) {
				prompt.removeChild(prompt.firstChild);
			}
			prompt.appendChild(document.createTextNode(line[0].value));
		} else if (line && line[0] && line[0].action == "setPassword") {
			var prompt = document.getElementById("input");
			prompt.setAttribute("type", line[0].value ? "password" : "text");
		} else if (line && line[0] && line[0].action == "setHash") {
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
		} else if (line && line[0] && line[0].action == "setSendKeyEvents") {
			var value = line[0].value;
			if (value && !gSendKeyEvents) {
				window.addEventListener("keydown", keyEvent);
				window.addEventListener("keypress", keyEvent);
				window.addEventListener("keyup", keyEvent);
			} else if (!value && gSendKeyEvents) {
				window.removeEventListener("keydown", keyEvent);
				window.removeEventListener("keypress", keyEvent);
				window.removeEventListener("keyup", keyEvent);
			}
			gSendKeyEvents = value;
		} else if (line && line[0] && line[0].action == "getCurrentPosition") {
				navigator.geolocation.getCurrentPosition(geolocationPosition, geolocationError, line[0].options);
		} else if (line && line[0] && line[0].action == "watchPosition") {
			if (navigator && navigator.geolocation && gGeolocatorWatch === undefined) {
				gGeolocatorWatch = navigator.geolocation.watchPosition(geolocationPosition, geolocationError, line[0].options);
			}
		} else if (line && line[0] && line[0].action == "clearWatch") {
			if (navigator && navigator.geolocation && gGeolocatorWatch !== undefined) {
				navigator.geolocation.clearWatch(gGeolocatorWatch);
			}
		} else if (line && line[0] && line[0].action == "setSendDeviceOrientationEvents") {
			let value = line[0].value;
			if (value && !gSendDeviceOrientationEvents) {
				window.addEventListener("deviceorientation", deviceOrientation);
			} else if (!value && gSendDeviceOrientationEvents) {
				window.removeEventListener("deviceorientation", deviceOrientation);
			}
			gSendDeviceOrientationEvents = value;
		} else {
			print(document.getElementById(target), line);
		}
	}
}

function geolocationPosition(position) {
	send({
		event: 'geolocation',
		position: {
			timestamp: position.timestamp,
			coords: {
				latitude: position.coords.latitude,
				longitude: position.coords.longitude,
				altitude: position.coords.altitude,
				accuracy: position.coords.accuracy,
				altitudeAccuracy: position.coords.altitudeAccuracy,
				heading: position.coords.heading,
				speed: position.coords.speed,
			},
		},
	});
}

function geolocationError(error) {
	send({
		event: 'geolocation',
		error: {
			code: error.code,
			message: error.message,
		},
	});
}

function deviceOrientation(event) {
	send({
		event: 'deviceorientation',
		orientation: {
			alpha: event.alpha,
			beta: event.beta,
			gamma: event.gamma,
			absolute: event.absolute,
		},
	});
};

function keyEvent(event) {
	send({
		event: "key",
		type: event.type,
		which: event.which,
		keyCode: event.keyCode,
		charCode: event.charCode,
		character: String.fromCharCode(event.keyCode || event.which),
		altKey: event.altKey,

	});
}

function autoNewLine(terminal) {
	terminal.appendChild(document.createElement("br"));
}

function print(terminal, data) {
	autoNewLine(terminal);
	printStructured(terminal, data);
	autoScroll(terminal);
}

function printSvg(container, data, name, namespace) {
	var node;
	if (typeof data == "string") {
		node = document.createTextNode(data);
	} else {
		node = document.createElementNS("http://www.w3.org/2000/svg", name);
		for (var i in data.attributes) {
			node.setAttribute(i, data.attributes[i]);
		}
		if (data.children) {
			for (var i in data.children) {
				node.appendChild(printSvg(node, data.children[i], data.children[i].name));
			}
		}
	}
	return node;
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
			node.setAttribute("target", data.target || "_blank");
		} else if (data.iframe) {
			node = document.createElement("iframe");
			if (data.src) {
				node.setAttribute("src", data.src);
			} else {
				node.setAttribute("srcdoc", data.iframe);
			}
			node.setAttribute("sandbox", "allow-forms allow-scripts allow-top-navigation allow-same-origin");
			if (data.width !== null) {
				node.setAttribute("width", data.width || 320);
			}
			if (data.height !== null) {
				node.setAttribute("height", data.height || 240);
			}
			if (data.name) {
				node.setAttribute("id", "iframe_" + data.name);
			}
		} else if (data.svg) {
			node = printSvg(container, data.svg, "svg");
		} else if (data.image) {
			node = document.createElement("img");
			node.setAttribute("src", data.image);
		} else if (data.input) {
			node = document.createElement("input");
			node.setAttribute("type", data.input);
			if (data.name) {
				node.name = data.name;
			}
			if (data.input == "submit") {
				node.onclick = submitButton;
			}
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
		if (data.input) {
			node.value = value;
		} else if (!value && data.message && data.stackTrace) {
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
	document.getElementById("input").focus();
}

function autoScroll(terminal) {
	terminal.scrollTop = terminal.scrollHeight - terminal.clientHeight;
}

function setErrorMessage(message) {
	var node = document.getElementById("status");
	while (node.firstChild) {
		node.removeChild(node.firstChild);
	}
	if (message) {
		node.appendChild(document.createTextNode(message));
		node.setAttribute("style", "display: inline; color: #dc322f");
	}
}

function send(command) {
	var value = command;
	if (!command) {
		value = document.getElementById("input").value;
		document.getElementById("input").value = "";
	}
	try {
		gSocket.send(JSON.stringify({action: "command", command: value}));
	} catch (error) {
		setErrorMessage("Send failed: " + error.toString());
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
	} else {
		a.appendChild(document.createTextNode("login"));
		a.setAttribute("href", "/login?return=" + encodeURIComponent(url() + hash()));
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
	var input = document.getElementById("input");
	if (event.type == "dragover") {
		if (!input.classList.contains("drop")) {
			input.classList.add("drop");
			gOriginalInput = input.value;
			input.value = "drop file to upload";
		}
	} else {
		input.classList.remove("drop");
		input.value = gOriginalInput;
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
	if (gSocket && gSocket.readyState == gSocket.CLOSED) {
		connectSocket();
	} else {
		send({event: "focus"});
	}
}

function blur() {
	if (gSocket && gSocket.readyState == gSocket.OPEN) {
		send({event: "blur"});
	}
}

function onMessage(event) {
	if (event.data && event.data.event == "resizeMe" && event.data.width && event.data.height) {
		var iframe = document.getElementById("iframe_" + event.data.name);
		iframe.setAttribute("width", event.data.width);
		iframe.setAttribute("height", event.data.height);
		var node = iframe.parentElement;
		while (node && !node.classList.contains("terminal")) {
			node = node.parentElement;
		}
		if (node) {
			autoScroll(node);
		}
	} else {
		send({event: "onWindowMessage", message: event.data});
	}
}

function submitButton() {
	var inputs = document.getElementsByTagName("input");
	var data = {};
	for (var i in inputs) {
		var input = inputs[i];
		if (input.name) {
			data[input.name] = input.value;
		}
	}
	send({event: "submit", value: data});
}

function connectSocket() {
	if (!gSocket || gSocket.readyState == gSocket.CLOSED) {
		gSocket = new WebSocket(
			(window.location.protocol == "https:" ? "wss://" : "ws://")
			+ window.location.hostname
			+ (window.location.port.length ? ":" + window.location.port : "")
			+ "/terminal/socket");
		gSocket.onopen = function() {
			setErrorMessage(null);
			gSocket.send(JSON.stringify({
				action: "hello",
				path: window.location.pathname,
				terminalApi: [
					['clear'],
					['notify', 'title', 'options'],
					['postMessageToIframe', 'name', 'message'],
					['setHash', 'value'],
					['setPassword', 'value'],
					['setPrompt', 'value'],
					['setTitle', 'value'],
					['split', 'options'],
					['setSendKeyEvents', 'value'],

					['getCurrentPosition', 'options'],
					['watchPosition', 'options'],
					['clearWatch'],

					['setSendDeviceOrientationEvents', 'value'],
				],
			}));
		}
		gSocket.onmessage = function(event) {
			receive(JSON.parse(event.data));
		}
		gSocket.onclose = function(event) {
			setErrorMessage("Connection closed with code " + event.code);
		}
	}
}

window.addEventListener("load", function() {
	if (window.Notification) {
		Notification.requestPermission();
	}
	var input = document.getElementById("input");
	input.addEventListener("keydown", keydown);
	input.focus();
	window.addEventListener("hashchange", hashChange);
	window.addEventListener("focus", focus);
	window.addEventListener("blur", blur);
	window.addEventListener("message", onMessage, false);
	window.addEventListener("online", connectSocket);
	enableDragDrop();
	connectSocket();
});
