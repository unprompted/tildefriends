"use strict";

// A document store.

//! {"category": "libraries"}

class DocumentStore {
	constructor(prefix) {
		this._prefix = prefix;
	}

	async _get(name) {
		let node;
		try {
			node = JSON.parse(await database.get(this._prefix + ":node:" + JSON.stringify(name)));
		} catch (error) {
			node = {version: null};
		}
		return node;
	}

	async _addKey(name) {
		let list = JSON.parse(await database.get(this._prefix + ":keys") || "[]");
		if (list.indexOf(name) == -1) {
			list.push(name);
			list.sort();
		}
		await database.set(this._prefix + ":keys", JSON.stringify(list));
	}

	async _removeKey(name) {
		let list = JSON.parse(await database.get(this._prefix + ":keys") || "[]");
		let index = list.indexOf(name);
		if (index != -1) {
			list.splice(index, 1);
		}
		await database.set(this._prefix + ":keys", JSON.stringify(list));
	}

	async set(name, value) {
		let node = await this._get(name);
		let version = (node.version || 0) + 1;
		await database.set(this._prefix + ":version:" + JSON.stringify(name) + ":" + version.toString(), JSON.stringify(value));
		node.deleted = value == undefined;
		node.version = version;
		await database.set(this._prefix + ":node:" + JSON.stringify(name), JSON.stringify(node));
		if (node.deleted) {
			await this._removeKey(name);
		} else {
			await this._addKey(name);
		}
	}

	async get(name, version) {
		let queryVersion = version || (await this._get(name)).version || 0;
		let value = await database.get(this._prefix + ":version:" + JSON.stringify(name) + ":" + queryVersion.toString());
		return value ? JSON.parse(value) : undefined;
	}

	async getAll() {
		return JSON.parse(await database.get(this._prefix + ":keys") || "[]");
	}

	async setVersion(name, version, value) {
		await database.set(this._prefix + ":version:" + JSON.stringify(name) + ":" + version.toString(), JSON.stringify(value));
	}
}

async function dump() {
	terminal.print("Dumping everything.");
	let keys = await database.getAll();
	for (let key in keys) {
		terminal.print(keys[key], " = ", await database.get(keys[key]));
		database.remove(keys[key]);
	}
}

async function test() {
	terminal.print("Running a test.");
	let ds = new DocumentStore("cory");
	await ds.set("cory", 1);
	await ds.set("cory", 2);
	await ds.set("cory", 3);
	terminal.print((await ds.get("cory")).toString());
	await ds.set("alice", "hello, world!");
	terminal.print(await ds.get("alice"));
	terminal.print(JSON.stringify(await ds.getAll()));
	await ds.set("cory", null);
	terminal.print(JSON.stringify(await ds.getAll()));
	terminal.print((await ds.get("cory", 2)).toString());
	terminal.print("Done.");
}

if (imports.terminal) {
	//dump().then(test).then(dump).catch(terminal.print);
}

exports.DocumentStore = function(name) {
	let ds = new DocumentStore(name);
	return {
		get: ds.get.bind(ds),
		set: ds.set.bind(ds),
		getAll: ds.getAll.bind(ds),
		setVersion: ds.setVersion.bind(ds),
	};
}