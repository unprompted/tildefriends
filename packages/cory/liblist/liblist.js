//! {"category": "libraries"}

"use strict";

class DatabaseList {
	constructor(name) {
		this._prefix = name;
	}

	async _insert(item, end, desiredKey) {
		let key = this._prefix + ":head";
		let listNode = await database.get(key);
		if (!listNode) {
			await database.set(key, JSON.stringify({next: key, previous: key, value: item, count: 1, nextId: 1, key: desiredKey}));
		} if (listNode) {
			listNode = JSON.parse(listNode);
			listNode.count++;
			let id = desiredKey;
			if (id && await database.get(this._prefix + ":node:" + id.toString())) {
				throw new Error("Key '" + desiredKey + "' already exists.");
			}
			if (!id) {
				id = listNode.nextId++;
			}
			if (end) {
				let newKey = this._prefix + ":node:" + id.toString();
				await database.set(newKey, JSON.stringify({next: key, previous: listNode.previous, value: item}));

				if (listNode.previous !== key) {
					let previous = JSON.parse(await database.get(listNode.previous));
					previous.next = newKey;
					await database.set(listNode.previous, JSON.stringify(previous));

					listNode.previous = newKey;
					await database.set(key, JSON.stringify(listNode));
				} else {
					listNode.previous = newKey;
					listNode.next = newKey;
					await database.set(key, JSON.stringify(listNode));
				}
			} else {
				let newKey = listNode.key || id.toString();
				await database.set(newKey, JSON.stringify({next: listNode.next, previous: key, value: listNode.value}));
				listNode.value = item;
				listNode.key = id;

				if (listNode.next !== key) {
					let next = JSON.parse(await database.get(listNode.next));
					next.previous = newKey;
					await database.set(listNode.next, JSON.stringify(next));

					listNode.next = newKey;
					await database.set(key, JSON.stringify(listNode));
				} else {
					listNode.previous = newKey;
					listNode.next = newKey;
					await database.set(key, JSON.stringify(listNode));
				}
			}
		}
	}

	async _remove(end) {
		let key = this._prefix + ":head";
		let listNode = await database.get(key);
		let result;
		if (listNode) {
			listNode = JSON.parse(listNode);
			listNode.count--;
			if (end) {
				if (listNode.previous === key) {
					await database.remove(key);
					result = listNode.value;
				} else {
					let removeKey = listNode.previous;
					let previous = JSON.parse(await database.get(listNode.previous));
					result = previous.value;
					if (previous.previous !== key) {
						let previousPrevious = JSON.parse(await database.get(previous.previous));
						previousPrevious.next = key;
						listNode.previous = previous.previous;
						await database.set(previous.previous, JSON.stringify(previousPrevious));
						await database.set(key, JSON.stringify(listNode));
						await database.remove(removeKey);
					} else {
						listNode.next = key;
						listNode.previous = key;
						await database.set(key, JSON.stringify(listNode));
						await database.remove(removeKey);
					}
				}
			} else {
				result = listNode.value;
				if (listNode.next === key) {
					await database.remove(key);
				} else {
					let removeKey = listNode.next;
					let next = JSON.parse(await database.get(listNode.next));
					listNode.value = next.value;
					if (next.next !== key) {
						let nextNext = JSON.parse(await database.get(next.next));
						nextNext.previous = key;
						listNode.next = next.next;
						await database.set(next.next, JSON.stringify(nextNext));
						await database.set(key, JSON.stringify(listNode));
						await database.remove(removeKey);
					} else {
						listNode.next = key;
						listNode.previous = key;
						await database.set(key, JSON.stringify(listNode));
						await database.remove(removeKey);
					}
				}
			}
		}
		return result;
	}

	push(item, key) {
		return this._insert(item, true, key);
	}

	unshift(item, key) {
		return this._insert(item, false, key);
	}

	pop() {
		return this._remove(true);
	}

	shift() {
		return this._remove(false);
	}

	async get(offset, count) {
		const head = this._prefix + ":head";
		let key = head;
		let result = [];

		while (offset) {
			let node = await database.get(key);
			if (!node) {
				break;
			}
			node = JSON.parse(node);
			if (offset > 0) {
				key = node.next;
				offset--;
			} else if (offset < 0) {
				key = node.previous;
				offset++;
			}
		}

		while (count) {
			let node = await database.get(key);
			if (!node) {
				break;
			}
			node = JSON.parse(node);
			result.push(node.value);
			if (count > 0) {
				key = node.next;
				if (key == head) {
					break;
				}
				count--;
			} else if (count < 0) {
				key = node.previous;
				count++;
				if (key == head) {
					count = -1;
				}
			}
		}

		return result;
	}

	async getByKey(key) {
		let value = await database.get(this._prefix + ":node:" + key.toString());
		if (value !== undefined) {
			value = JSON.parse(value);
		} else {
			let node = await database.get(this._prefix + ":head");
			if (node !== undefined) {
				node = JSON.parse(node);
				if (node.key == key) {
					value = node;
				}
			}
		}
		return value;
	}

	async setByKey(key, value) {
		let node = await database.get(this._prefix + ":head");
		let done = false;
		if (node !== undefined) {
			node = JSON.parse(node);
			if (node.key == key) {
				node.value = value;
				await database.set(this._prefix + ":head", JSON.stringify(node));
				done = true;
			}
		}

		if (!done) {
			node = JSON.parse(await database.get(this._prefix + ":node:" + key));
			node.value = value;
			await database.set(this._prefix + ":node:" + key, JSON.stringify(node));
			done = true;
		}
	}
}

function wipeDatabase() {
	let promises = [];
	return database.getAll().then(function(list) {
		for (let i = 0; i < list.length; i++) {
			promises.push(database.remove(list[i]));
		}
	});
	return Promise.all(promises);
}

async function dumpDatabase() {
	for (let key of await database.getAll()) {
		let value = await database.get(key);
		try {
			value = JSON.parse(value);
		} catch (error) {
			// eh
		}
		terminal.print("DUMP: ", key, " ", JSON.stringify(value, 0, 2));
	}
}

/*async function test() {
	let x = new DatabaseList("list");
	await x.push("1");
	await x.push("2");
	await x.push("3");
	await dumpDatabase();
	terminal.print(await x.get(0, 10));
	terminal.print(await x.get(-1, -10));
	terminal.print(await x.pop());
	terminal.print(await x.pop());
	terminal.print(await x.pop());
	await dumpDatabase();
	await x.unshift("1");
	await x.unshift("2");
	await x.unshift("3");
	await dumpDatabase();
	await x.push("cory", "coryKey");
	await x.push("yo", "yoKey");
	terminal.print(await x.get(0, 10));
	terminal.print(await x.shift());
	terminal.print(await x.shift());
	terminal.print(await x.shift());
	await dumpDatabase();
}*/

if (imports.terminal) {
	//wipeDatabase();
	//dumpDatabase().then(wipeDatabase).then(test).catch(terminal.print);
	/*let x = new DatabaseList("list");
	core.register("onInput", function(input) {
		if (input == "clear") {
			wipeDatabase().then(function() {
				terminal.print("Database is now empty.");
			});
		} else if (input.substring(0, "push ".length) == "push ") {
			x.push(input.substring("push ".length)).then(dumpDatabase).catch(terminal.print);
		} else if (input.substring(0, "unshift ".length) == "unshift ") {
			x.unshift(input.substring("unshift ".length)).then(dumpDatabase).catch(terminal.print);
		} else if (input == "pop") {
			x.pop().then(function(out) {
				terminal.print("POPPED: ", out);
			}).then(dumpDatabase).catch(terminal.print);
		} else if (input == "shift") {
			x.shift().then(function(out) {
				terminal.print("SHIFTED: ", out);
			}).then(dumpDatabase).catch(terminal.print);
		} else if (input.substring(0, "get ".length) == "get ") {
			let parts = input.split(" ");
			x.get(parseInt(parts[1])).then(function(result) {
				terminal.print(JSON.stringify(result))
			}).catch(terminal.print);
		} else {
			dumpDatabase();
		}
	});*/
}

exports.ListStore = function(name) {
	let ls = new DatabaseList(name);
	return {
		push: ls.push.bind(ls),
		pop: ls.pop.bind(ls),
		shift: ls.shift.bind(ls),
		unshift: ls.unshift.bind(ls),
		get: ls.get.bind(ls),
		getByKey: ls.getByKey.bind(ls),
		setByKey: ls.setByKey.bind(ls),
	};
}