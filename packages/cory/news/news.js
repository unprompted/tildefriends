"use strict";

//! {"require": ["libencoding", "libhttp", "liblist", "libxml"], "permissions": ["network"]}

/*
	list news<url>:id {title, description, guid || link}
	list users:username {subscriptions: []}
	list feed:username,url {id, title, modified, read, ...}
*/

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
		} else if (node0.name == "feed") {
			for (let node1 of node0.children) {
				if (node1.name == "entry") {
					let item = {};
					for (let node2 of node1.children) {
						if (node2.name == "title") {
							item.title = node2.text;
						} else if (node2.name == "link") {
							item.link = node2.attributes.href;
						} else if (node2.name == "content" && node2.attributes.type == "html") {
							item.description = node2.text;
						}
					}
					news.items.push(item);
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
	for (let item of news.items) {
		let id = item.guid || item.link;
		await transformListItem(url, id, entry => item);
	}

	let users = await liblist.ListStore("users").get(0, Number.MAX_SAFE_INTEGER);
	terminal.print("users: ", JSON.stringify(users));
	for (let user of users) {
		if (user.subscriptions.indexOf(url) != -1) {
			terminal.print("USER!", user.name);
			for (let item of news.items) {
				let id = item.guid || item.link;
				terminal.print("storing news in ", "feed:" + JSON.stringify([user.name, url]), " ", id);
				await transformListItem("feed:" + JSON.stringify([user.name, url]), id, entry => {
					entry = entry || {url: url, id: id, title: item.title};
					if (item.title != entry.title || !entry.modified) {
						entry.title = item.title;
						entry.modified = new Date();
						entry.read = false;
					}
					return entry;
				});
			}
		}
	}
}

async function setRead(url, id, read) {
	await transformListItem("feed:" + JSON.stringify([core.user.name, url]), id, entry => {
		entry.read = read;
		return entry;
	});
}

const kUrl = "https://www.reddit.com/.rss?feed=d05b33887cf432fd6a28c39acfb1d645bcd5e69b&user=unprompted";

async function transformListItem(list, key, callback, back) {
	let listStore = liblist.ListStore(list);
	let value = await listStore.getByKey(key);
	let have = value !== undefined;
	value = callback(value !== undefined ? value.value : undefined);
	if (have) {
		await listStore.setByKey(key, value);
	} else {
		if (back) {
			await listStore.unshift(value, key);
		} else {
			await listStore.push(value, key);
		}
	}
	return value;
}

async function getAllSubscriptions() {
	let urls = new Set();
	let users = await liblist.ListStore("users").get(0, Number.MAX_SAFE_INTEGER);
	terminal.print("users", JSON.stringify(users));
	for (let user of users) {
		terminal.print(JSON.stringify(user));
		if (user && user.subscriptions) {
			for (let url of user.subscriptions) {
				urls.add(url);
			}
		}
	}
	return Array.from(urls);
}

async function getMySubscriptions() {
	let urls = new Set();
	let value = await liblist.ListStore("users").getByKey(core.user.name);
	return value ? value.value.subscriptions : [];
}

async function subscribe(url) {
	let entry = await transformListItem("users", core.user.name, user => {
		user = user || {name: core.user.name, subscriptions: []};
		if (user.subscriptions.indexOf(url) == -1) {
			user.subscriptions.push(url);
		}
		return user;
	});
	return entry.subscriptions;
}

class TestInterface {
	async fetchNews() {
		try {
			terminal.print("fetching");
			let urls = await getMySubscriptions();
			terminal.print("subscriptions: ", JSON.stringify(urls));
			for (let url of urls) {
				try {
					terminal.print("fetch", url);
					let response = await fetchNews(url);
					terminal.print("parse");
					let news = parseNews(response);
					terminal.print("store", JSON.stringify(news).substring(0, 1024));
					await storeNews(url, news);
					terminal.print("done");
				} catch (error) {
					terminal.print("error", error);
				}
			}
		} catch (error) {
			terminal.print("error", error);
		}
	}

	async aggregate(urls) {
		let news = [];
		for (let url of urls) {
			news = news.concat(await liblist.ListStore("feed:" + JSON.stringify([core.user.name, url])).get(0, 100));
		}
		return news.sort((x, y) => y.modified.localeCompare(x.modified)).slice(0, 100);
	}

	async refreshNews() {
		this.selectedIndex = -1;
		terminal.select("headlines");
		terminal.clear();
		terminal.print("Loading...");
		let subscriptions = await getMySubscriptions();
		this.news = await this.aggregate(subscriptions);
	}

	async redisplay() {
		terminal.cork();
		try {
			terminal.select("headlines");
			terminal.clear();
			this.news.forEach((article, index) => {
				let color = "";
				if (this.selectedIndex == index) {
					color = "red";
				} else if (article.read) {
					color = "gray";
				}
				terminal.print(article.modified.toString(), " ", {
					style: color ? ("color: " + color) : "",
					value: article.title,
				});
			});
			terminal.select("view");
			terminal.clear();
			if (this.news[this.selectedIndex]) {
				let fullArticle = (await liblist.ListStore(this.news[this.selectedIndex].url).getByKey(this.news[this.selectedIndex].id)).value;
				terminal.print({
					iframe: `<h1>${fullArticle.title}</h1>${fullArticle.description}`,
					style: "background-color: #fff; border: 0; margin: 0; padding: 0; flex: 1 1 auto",
					width: null,
					height: null,
				});
			}
		} finally {
			terminal.uncork();
		}
	}

	async moveSelection(delta) {
		this.selectedIndex += delta;
		try {
			let item = this.news[this.selectedIndex];
			if (item) {
				await setRead(item.url, item.id, true);
				item.read = true;
			}
		} catch (error) {
			print("error", error);
		}
		this.redisplay();
	}

	async activate() {
		let self = this;
		terminal.split([
			{name: "headlines", basis: "30%", grow: 0, shrink: 1},
			{name: "view", style: "display: flex", basis: "70%", grow: 2, shrink: 0},
		]);
		self.refreshNews().then(self.redisplay.bind(self)).catch(terminal.print);
		terminal.setSendKeyEvents(true);
		core.register("key", async function(event) {
			if (event.type == "keypress") {
				switch (event.keyCode) {
					case 'j'.charCodeAt(0):
						self.moveSelection(1);
						break;
					case 'k'.charCodeAt(0):
						self.moveSelection(-1);
						break;
					case 'r'.charCodeAt(0):
						await self.fetchNews();
						await self.refreshNews();
						self.redisplay();
						break;
					case 'R'.charCodeAt(0):
						await self.fetchNews();
						break;
					case 'd'.charCodeAt(0):
						self.redisplay();
						break;
				}
			}
		});
	}
}

core.register("onInput", async function(input) {
	try {
		if (input == "wipe") {
			await wipeDatabase();
			terminal.print("database wiped");
		} else if (input == "dump") {
			await dumpDatabase();
		} else if (input.startsWith("subscribe ")) {
			let subscriptions = await subscribe(input.substring("subscribe ".length));
			terminal.print("subscriptions: ", JSON.stringify(subscriptions));
		}
	} catch (error) {
		terminal.print("error", error);
	}
});

/*
async function test() {
	await wipeDatabase();
	let l = liblist.ListStore("test");
	await transformListItem("test", "a", x => "value:a");
	await transformListItem("test", "b", x => "value:b");
	await transformListItem("test", "c", x => "value:c");
	terminal.print("contents: ", JSON.stringify(await l.get(0, 2)));
	await transformListItem("test", "d", x => "value:d");
	terminal.print("contents: ", JSON.stringify(await l.get(0, 2)));
	terminal.print("a?", JSON.stringify(await l.getByKey("a")));
	terminal.print("b?", JSON.stringify(await l.getByKey("b")));
	terminal.print("c?", JSON.stringify(await l.getByKey("c")));
	terminal.print("d?", JSON.stringify(await l.getByKey("d")));
	dumpDatabase();
	await wipeDatabase();
	await transformListItem("test", "a", x => "value:a", true);
	await transformListItem("test", "b", x => "value:b", true);
	await transformListItem("test", "c", x => "value:c", true);
	terminal.print("contents: ", JSON.stringify(await l.get(0, 2)));
	await transformListItem("test", "d", x => "value:d", true);
	terminal.print("contents: ", JSON.stringify(await l.get(0, 2)));
	terminal.print("a?", JSON.stringify(await l.getByKey("a")));
	terminal.print("b?", JSON.stringify(await l.getByKey("b")));
	terminal.print("c?", JSON.stringify(await l.getByKey("c")));
	terminal.print("d?", JSON.stringify(await l.getByKey("d")));
	dumpDatabase();
}
test().catch(terminal.print);
//*/

//test("http://www.unprompted.com/rss").catch(terminal.print);
new TestInterface().activate().catch(terminal.print);