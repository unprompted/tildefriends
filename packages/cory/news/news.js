"use strict";

//! {"require": ["libhttp", "liblist", "libxml"], "permissions": ["network"]}

let http = require("libhttp");
let liblist = require("liblist");
let xml = require("libxml");

function parseNews(response) {
	let news = {items: []};
	let nodes = xml.StanzaParser().parse(response.body);
	for (let node0 of nodes) {
		if (node0.name == "rss") {
			for (let node1 of node0.children) {
				if (node1.name == "channel") {
					for (let node2 of node1.children) {
						if (node2.name == "item") {
							let item = {};
							for (let node3 of node2.children) {
								item[node3.name] = node3.text;
							}
							news.items.push(item);
						}
					}
				}
			}
		}
	}
	return news;
}

async function fetchNews(url) {
	let response;
	let retries = 5;
	while (retries--) {
		response = await http.get(url);
		if (response.headers.location) {
			url = response.headers.location;
		} else {
			break;
		}
	}
	return response;
}

async function storeNews(url, news) {
	let listStore = liblist.ListStore(url);
	for (let item of news.items) {
		let id = item.guid || item.link;
		if (await listStore.getByKey(id) !== undefined) {
			await listStore.setByKey(id, item);
			terminal.print("SET ", id);
		} else {
			await listStore.push(item, id);
			terminal.print("PUSH ", id);
		}
	}
}

function loadNews(url) {
	return liblist.ListStore(url).get(0, 10);
}

async function test(url) {
	await wipeDatabase();
	await dumpDatabase();
	let response = await fetchNews(url);
	let news = parseNews(response);
	await storeNews(url, news);
	await storeNews(url, news);
	terminal.print("That's the news for today:");
	terminal.print(JSON.stringify(await loadNews(url), 0, 2));
	terminal.print("Keys:");
	terminal.print(JSON.stringify(await database.getAll(), 0, 2));
	await dumpDatabase();
}

test("http://www.unprompted.com/rss").catch(terminal.print);