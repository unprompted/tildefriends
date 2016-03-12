# Tilde Friends
Tilde Friends is a program that aims to securely host pure JavaScript web applications.

## Goals
1. Make it easy to run all sorts of servers and web applications.
2. Provide a security model that is easy to understand and protects your data.
3. Make creating and sharing web applications accessible to anyone from a web interface.

## Building
Tilde Friends is [routinely](https://www.unprompted.com/projects/build/tildefriends) built on Linux, Windows, and OS X.

1. Get and build [Google V8](https://code.google.com/p/v8-wiki/wiki/UsingGit) (latest 3.30).
2. Get and build [libuv](https://github.com/libuv/libuv) (latest 1.0).
3. Run:
  ```
  scons uv=path/to/libuv v8=path/to/v8
  ```

## Running
Running the built tildefriends executable will start a web server.  This is a good starting point: <http://localhost:12345/tasks>.

The first use to create an account and log in will be granted administrative privileges.  Everything can be managed entirely from the web interface.

This is a work in progress.

## License
All code unless otherwise noted in [COPYING](https://www.unprompted.com/projects/browser/projects/tildefriends/trunk/COPYING) is provided under the [Affero GPL 3.0](https://www.unprompted.com/projects/browser/projects/tildefriends/trunk/LICENSE) license.
