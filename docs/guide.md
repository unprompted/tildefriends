# Philosophy

Tilde Friends is a platform for making, running, and sharing web applications.

When you visit Tilde Friends in a web browser, you are presented with a
terminal interface, typically with a big text output box covering most of the
page and an input box at the bottom, into which text or commands can be
entered.  A script runs to produce text output and consume user input.

The script is a Tilde Friends application, and it runs on the server, which
means that unlike client-side JavaScript, it can have the ability to read and
write files on the server or create network connections to other machines.
Unlike node.js or other server-side runtime environments, applications are
limited for security reasons to not interfere with each other or bring the
entire server down.

Above the terminal, an "Edit" link brings a visitor to the source code for the
current Tilde Friends application, which they can then edit, save as their own,
and run.

# Architecture

Tilde Friends is a C++ application with a JavaScript runtime that provides
restricted access to filesystem, network, and other system resources.  The core
process runs a core set of scripts that implement a web server, typically
starting a new process for each visitor's session which runs scripts for the
active application and stopping it when the visitor leaves.

Only the core process has access to most system resources, but session
processes can be given accesss through the core process.

Service processes are identical to session processes, but they are not tied to
a user session.

## Communication

In the same way that web browsers expose APIs for scripts running in the
browser to modify the document, play sounds and video, and draw, Tilde Friends
exposes APIs for scripts running on a Tilde Friends server to interact with a
visitor's web browser, read and write files on the server, and otherwise
interact with the world.

There are several distinct classes of APIs.

First, there are low-level functions exposed from C++ to JavaScript.  Most of
these are only available to the core process.  These typically only go through
a basic JavaScript to C++ transition and are relatively fast and immediate.

	// Displays some text to the server's console.
	print("Hello, world!");

There is a mechanism for communicating between processes.  Functions can be
exported and called across process boundaries.  When this is done, any
arguments are serialized to a network protocol, deserialized by the other
process, the function called, and finally any return value is passed back in
the same way.  Any functions referenced by the arguments or return value are
also exported and can be subsequently called across process boundaries.
Functions called across process boundaries are always asynchronous, returning a
Promise.  Care must be taken for security reasons to not pass dangerous
functions ("deleteAllMydata()") to untrusted processes, and it is best for
performance reasons to minimize the data size transferred between processes.

	// Send an "add" function to any other running processes.  When called, it
	// will run in this process.
	core.broadcast({add: function(x, y) { return x + y; }});

	// Receive the above message and call the function.
	core.register("onMessage", function(sender, message) {
		message.add(3, 4).then(x => terminal.print(x.toString()));
	});

Finally, there is a core web interface that runs on the client's browser that
extends access to a running Tilde Friends script.

	// Displays a message in the client's browser.
	terminal.print("Hello, world!");

## API Documentation

The Tilde Friends API is very much evolving.

All currently registered methods can be explored in the
[documentation](https://www.tildefriends.net/~cory/documentation) app.

All browser-facing methods are implemented in [client.js](core/client.js).
Most process-related methods are implemented in [core.js](core/core.js).

Higher-level behaviors are often implemented within library-style apps
themselves and are beyond the scope of this document.

### Terminal
All interaction with a human user is through a terminal-like interface.  Though
it is somewhat limiting, it makes simple things easy, and it is possible to
construct complicated interfaces by creating and interacting with an iframe.

#### terminal.print(arguments...)
Print to the terminal.  Arguments and lists are recursively expanded.  Numerous
special values are supported as implemented in client.cs.

	// Create a link.
	terminal.print({href: "http://www.tildefriends.net/", value: "Tilde Friends!"});

	// Create an iframe.
	terminal.print({iframe: "&lt;b&gt;Hello, world!&lt;/b&gt;", width: 640, height: 480});

	// Use style.
	terminal.print({style: "color: #f00", value: "Hello, world!"});

	// Create a link that when clicked will act as if the user typed a command.
	terminal.print({command: "exit", value: "Get out of here."});

#### terminal.clear()
Clears the terminal output.

#### terminal.readLine()
Read a line of input from the user.

#### terminal.setEcho(echo)
Controls whether the terminal will automatically echo user input.  Defaults to true.

#### terminal.setPrompt(prompt)
Sets the terminal prompt.  The default is "&gt;".

#### terminal.setTitle(title)
Sets the browser window/tab title.

#### terminal.split(terminalList)
Reconfigures the terminal layout, potentially into multiple split panes.

	terminal.split([
		{
			type: "horizontal",
			children: [
				{name: "left", basis: "2in", grow: 0, shrink: 0},
				{name: "middle", grow: 1},
				{name: "right", basis: "2in", grow: 0, shrink: 0},
			],
		},
	]);

#### terminal.select(name)
Directs subsequent output to the named terminal.

#### terminal.postMessageToIframe(iframeName, message)
Sends a message to the iframe that was created with the given name, using the
browser's window.postMessage.

### Database
Tilde Friends uses lmdb as a basic key value store.  Keys and values are all
expected to be of type String.  Each application gets its own isolated
database.

#### database.get(key)
Retrieve the database value associated with the given key.

#### database.set(key, value)
Sets the database value for the given key, overwriting any existing value.

#### database.remove(key)
Remove the database entry for the given key.

#### database.getAlll()
Retrieve a list of all key names.

### Network
Network access is generally not extended to untrusted users.

It is necessary to grant network permissions to an app owner through the
administration app.

Apps that require network access must declare it like this:

	//! { "permissions": ["network"] }

#### network.newConnection()
Creates a Connection object.

#### connection.connect(host, port)
Opens a TCP connection to host:port.

#### connection.read(readCallback)
Begins reading and calls readCallback(data) for all data received.

#### connection.write(data)
Writes data to the connection.

#### connection.close()
Closes the connection.
