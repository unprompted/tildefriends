var gBackup;
var gEditor;

window.addEventListener("load", function() {
	gEditor = CodeMirror.fromTextArea(document.getElementById("editor"), {
		'theme': 'base16-dark',
		'lineNumbers': true,
		'tabSize': 4,
		'indentUnit': 4,
		'indentWithTabs': true,
		'showTrailingSpace': true,
	});
	gBackup = gEditor.getValue();
	gEditor.focus();
});

window.addEventListener("keydown", function(event) {
	if (event.keyCode == 83 && event.altKey) {
		save();
	} else if (event.keyCode == 66 && event.altKey) {
		back();
	}
});

function explodePath() {
	return /^\/~([^\/]+)\/([^\/]+)(.*)/.exec(window.location.pathname);
}

function packageOwner() {
	return explodePath()[1];
}

function packageName() {
	return explodePath()[2];
}

function back(uri) {
	if (uri) {
		window.location.pathname = uri;
	} else {
		window.location.pathname = "/~" + packageOwner() + "/" + packageName();
	}
}

function save(newName) {
	document.getElementById("save").disabled = true;
	document.getElementById("saveAs").disabled = true;

	var contents = gEditor.getValue();
	var run = document.getElementById("run").checked;

	var request = new XMLHttpRequest();

	var always = function() {
		document.getElementById("save").disabled = false;
		document.getElementById("saveAs").disabled = false;
	};

	request.addEventListener("error", function() {
		alert("Error saving: " + request.responseText);
		always();
	});
	request.addEventListener("loadend", function() {
		if (request.status == 200) {
			gBackup = contents;
			if (run) {
				back(request.responseText);
			}
		} else {
			alert("Unable to save: " + request.responseText);
		}
		always();
	});
	request.addEventListener("timeout", function() {
		alert("Timed out saving: " + request.responseText);
		always();
	});
	request.addEventListener("abort", function() {
		alert("Save aborted: " + request.responseText);
		always();
	});
	request.open("POST", newName ? "../" + newName + "/save" : "save", true);
	request.setRequestHeader("Content-Type", "text/plain");
	request.send(contents);
}

function saveAs() {
	var newName = prompt("Save as:", packageName());
	if (newName) {
		save(newName);
	}
}

function revert() {
	gEditor.setValue(gBackup);
}

function addLicense() {
	var contents = "/*\n" +
		"<one line to give the program's name and a brief idea of what it does.>\n" +
		"Copyright (C) <year>  <name of author>\n".replace("<year>", new Date().getFullYear()) +
		"\n" +
		"This program is free software: you can redistribute it and/or modify\n" +
		"it under the terms of the GNU Affero General Public License as published by\n" +
		"the Free Software Foundation, either version 3 of the License, or\n" +
		"(at your option) any later version.\n" +
		"\n" +
		"This program is distributed in the hope that it will be useful,\n" +
		"but WITHOUT ANY WARRANTY; without even the implied warranty of\n" +
		"MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n" +
		"GNU Affero General Public License for more details.\n" +
		"\n" +
		"You should have received a copy of the GNU Affero General Public License\n" +
		"along with this program.  If not, see <http://www.gnu.org/licenses/>.\n" +
		"*/\n\n" +
		gEditor.getValue();
	gEditor.setValue(contents);
}
