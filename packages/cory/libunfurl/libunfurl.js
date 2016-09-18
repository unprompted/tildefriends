"use strict";

//! {"category": "libraries", "require": ["libhttp", "libxml"], "permissions": ["network"]}

let libxml = require("libxml");
let libhttp = require("libhttp");

let gEmbedIndex = 0;
let gCache = {};

async function unfurl(url) {
	let result = {href: url};
	let response = await libhttp.get(url);
	let parsed = libxml.StreamParser().parse(response.body);
	let oEmbedUrl;
	for (let node of parsed) {
		if (node.type == "element" && node.value == "link" && node.attributes.type == "application/json+oembed") {
			oEmbedUrl = node.attributes.href;
			break;
		}
	}

	if (oEmbedUrl) {
		response = await libhttp.get(oEmbedUrl);
		let oEmbed = JSON.parse(response.body);
		gEmbedIndex++;
		result = [{href: url}, "\n", {
			name: "oEmbed" + gEmbedIndex,
			iframe: `
	<style type="text/css">border: 0; padding: 0; margin: 0; overflow: hidden</style>
	${oEmbed.html}<script language="javascript">
		let gResizeMeMessage = {
			event: "resizeMe",
			name: "oEmbed${gEmbedIndex}",
			width: -1,
			height: -1,
		};
		setInterval(function() {
			if (document.body.scrollHeight != gResizeMeMessage.height
				|| document.body.scrollWidth != gResizeMeMessage.width) {
				gResizeMeMessage.width = document.body.scrollWidth;
				gResizeMeMessage.height = document.body.scrollHeight;
				parent.postMessage(gResizeMeMessage, "*");
			}
		}, 100);
	</script>`,
			width: oEmbed.width || 320,
			height: oEmbed.height || 120,
			style: "margin: 0; padding: 0; border: 0; overflow: hidden",
		}];
	}

	return result;
}

async function test() {
	terminal.print(await unfurl("https://twitter.com/511nyAlbany/status/777221230915096576"));
	terminal.print(await unfurl("https://www.youtube.com/watch?v=pTA0DSfrGZ0"));
}

//test().catch(terminal.print);

core.register("onMessage", async function(sender, message) {
	let result = message;
	if (gCache[message] && new Date().valueOf() < gCache[message].expires) {
		result = gCache[message].result;
	} else {
		if (gCache[message]) {
			print("Didn't use", gCache[message]);
		}
		try {
			result = await unfurl(message);
		} catch (error) {
			result = [message, "(error retrieving: ", error, ")"];
		}
		gCache[message] = {
			expires: new Date().valueOf() + 7 * 24 * 60 * 60 * 1000,
			result: result,
		};
	}
	return result;
});