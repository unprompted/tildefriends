"use strict";

//! {"permissions": ["network"]}

// md5.js

/*
 * JavaScript MD5 1.0.1
 * https://github.com/blueimp/JavaScript-MD5
 *
 * Copyright 2011, Sebastian Tschan
 * https://blueimp.net
 *
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/MIT
 *
 * Based on
 * A JavaScript implementation of the RSA Data Security, Inc. MD5 Message
 * Digest Algorithm, as defined in RFC 1321.
 * Version 2.2 Copyright (C) Paul Johnston 1999 - 2009
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for more info.
 */

/*jslint bitwise: true */
/*global unescape, define */

'use strict';

/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */
function safe_add(x, y) {
	var lsw = (x & 0xFFFF) + (y & 0xFFFF),
		msw = (x >> 16) + (y >> 16) + (lsw >> 16);
	return (msw << 16) | (lsw & 0xFFFF);
}

/*
 * Bitwise rotate a 32-bit number to the left.
 */
function bit_rol(num, cnt) {
	return (num << cnt) | (num >>> (32 - cnt));
}

/*
 * These functions implement the four basic operations the algorithm uses.
 */
function md5_cmn(q, a, b, x, s, t) {
	return safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s), b);
}
function md5_ff(a, b, c, d, x, s, t) {
	return md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
}
function md5_gg(a, b, c, d, x, s, t) {
	return md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
}
function md5_hh(a, b, c, d, x, s, t) {
	return md5_cmn(b ^ c ^ d, a, b, x, s, t);
}
function md5_ii(a, b, c, d, x, s, t) {
	return md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
}

/*
 * Calculate the MD5 of an array of little-endian words, and a bit length.
 */
function binl_md5(x, len) {
	/* append padding */
	x[len >> 5] |= 0x80 << (len % 32);
	x[(((len + 64) >>> 9) << 4) + 14] = len;

	var i, olda, oldb, oldc, oldd,
		a =  1732584193,
		b = -271733879,
		c = -1732584194,
		d =  271733878;

	for (i = 0; i < x.length; i += 16) {
		olda = a;
		oldb = b;
		oldc = c;
		oldd = d;

		a = md5_ff(a, b, c, d, x[i],       7, -680876936);
		d = md5_ff(d, a, b, c, x[i +  1], 12, -389564586);
		c = md5_ff(c, d, a, b, x[i +  2], 17,  606105819);
		b = md5_ff(b, c, d, a, x[i +  3], 22, -1044525330);
		a = md5_ff(a, b, c, d, x[i +  4],  7, -176418897);
		d = md5_ff(d, a, b, c, x[i +  5], 12,  1200080426);
		c = md5_ff(c, d, a, b, x[i +  6], 17, -1473231341);
		b = md5_ff(b, c, d, a, x[i +  7], 22, -45705983);
		a = md5_ff(a, b, c, d, x[i +  8],  7,  1770035416);
		d = md5_ff(d, a, b, c, x[i +  9], 12, -1958414417);
		c = md5_ff(c, d, a, b, x[i + 10], 17, -42063);
		b = md5_ff(b, c, d, a, x[i + 11], 22, -1990404162);
		a = md5_ff(a, b, c, d, x[i + 12],  7,  1804603682);
		d = md5_ff(d, a, b, c, x[i + 13], 12, -40341101);
		c = md5_ff(c, d, a, b, x[i + 14], 17, -1502002290);
		b = md5_ff(b, c, d, a, x[i + 15], 22,  1236535329);

		a = md5_gg(a, b, c, d, x[i +  1],  5, -165796510);
		d = md5_gg(d, a, b, c, x[i +  6],  9, -1069501632);
		c = md5_gg(c, d, a, b, x[i + 11], 14,  643717713);
		b = md5_gg(b, c, d, a, x[i],      20, -373897302);
		a = md5_gg(a, b, c, d, x[i +  5],  5, -701558691);
		d = md5_gg(d, a, b, c, x[i + 10],  9,  38016083);
		c = md5_gg(c, d, a, b, x[i + 15], 14, -660478335);
		b = md5_gg(b, c, d, a, x[i +  4], 20, -405537848);
		a = md5_gg(a, b, c, d, x[i +  9],  5,  568446438);
		d = md5_gg(d, a, b, c, x[i + 14],  9, -1019803690);
		c = md5_gg(c, d, a, b, x[i +  3], 14, -187363961);
		b = md5_gg(b, c, d, a, x[i +  8], 20,  1163531501);
		a = md5_gg(a, b, c, d, x[i + 13],  5, -1444681467);
		d = md5_gg(d, a, b, c, x[i +  2],  9, -51403784);
		c = md5_gg(c, d, a, b, x[i +  7], 14,  1735328473);
		b = md5_gg(b, c, d, a, x[i + 12], 20, -1926607734);

		a = md5_hh(a, b, c, d, x[i +  5],  4, -378558);
		d = md5_hh(d, a, b, c, x[i +  8], 11, -2022574463);
		c = md5_hh(c, d, a, b, x[i + 11], 16,  1839030562);
		b = md5_hh(b, c, d, a, x[i + 14], 23, -35309556);
		a = md5_hh(a, b, c, d, x[i +  1],  4, -1530992060);
		d = md5_hh(d, a, b, c, x[i +  4], 11,  1272893353);
		c = md5_hh(c, d, a, b, x[i +  7], 16, -155497632);
		b = md5_hh(b, c, d, a, x[i + 10], 23, -1094730640);
		a = md5_hh(a, b, c, d, x[i + 13],  4,  681279174);
		d = md5_hh(d, a, b, c, x[i],      11, -358537222);
		c = md5_hh(c, d, a, b, x[i +  3], 16, -722521979);
		b = md5_hh(b, c, d, a, x[i +  6], 23,  76029189);
		a = md5_hh(a, b, c, d, x[i +  9],  4, -640364487);
		d = md5_hh(d, a, b, c, x[i + 12], 11, -421815835);
		c = md5_hh(c, d, a, b, x[i + 15], 16,  530742520);
		b = md5_hh(b, c, d, a, x[i +  2], 23, -995338651);

		a = md5_ii(a, b, c, d, x[i],       6, -198630844);
		d = md5_ii(d, a, b, c, x[i +  7], 10,  1126891415);
		c = md5_ii(c, d, a, b, x[i + 14], 15, -1416354905);
		b = md5_ii(b, c, d, a, x[i +  5], 21, -57434055);
		a = md5_ii(a, b, c, d, x[i + 12],  6,  1700485571);
		d = md5_ii(d, a, b, c, x[i +  3], 10, -1894986606);
		c = md5_ii(c, d, a, b, x[i + 10], 15, -1051523);
		b = md5_ii(b, c, d, a, x[i +  1], 21, -2054922799);
		a = md5_ii(a, b, c, d, x[i +  8],  6,  1873313359);
		d = md5_ii(d, a, b, c, x[i + 15], 10, -30611744);
		c = md5_ii(c, d, a, b, x[i +  6], 15, -1560198380);
		b = md5_ii(b, c, d, a, x[i + 13], 21,  1309151649);
		a = md5_ii(a, b, c, d, x[i +  4],  6, -145523070);
		d = md5_ii(d, a, b, c, x[i + 11], 10, -1120210379);
		c = md5_ii(c, d, a, b, x[i +  2], 15,  718787259);
		b = md5_ii(b, c, d, a, x[i +  9], 21, -343485551);

		a = safe_add(a, olda);
		b = safe_add(b, oldb);
		c = safe_add(c, oldc);
		d = safe_add(d, oldd);
	}
	return [a, b, c, d];
}

/*
 * Convert an array of little-endian words to a string
 */
function binl2rstr(input) {
	var i,
		output = '';
	for (i = 0; i < input.length * 32; i += 8) {
		output += String.fromCharCode((input[i >> 5] >>> (i % 32)) & 0xFF);
	}
	return output;
}

/*
 * Convert a raw string to an array of little-endian words
 * Characters >255 have their high-byte silently ignored.
 */
function rstr2binl(input) {
	var i,
		output = [];
	output[(input.length >> 2) - 1] = undefined;
	for (i = 0; i < output.length; i += 1) {
		output[i] = 0;
	}
	for (i = 0; i < input.length * 8; i += 8) {
		output[i >> 5] |= (input.charCodeAt(i / 8) & 0xFF) << (i % 32);
	}
	return output;
}

/*
 * Calculate the MD5 of a raw string
 */
function rstr_md5(s) {
	return binl2rstr(binl_md5(rstr2binl(s), s.length * 8));
}

/*
 * Calculate the HMAC-MD5, of a key and some data (raw strings)
 */
function rstr_hmac_md5(key, data) {
	var i,
		bkey = rstr2binl(key),
		ipad = [],
		opad = [],
		hash;
	ipad[15] = opad[15] = undefined;
	if (bkey.length > 16) {
		bkey = binl_md5(bkey, key.length * 8);
	}
	for (i = 0; i < 16; i += 1) {
		ipad[i] = bkey[i] ^ 0x36363636;
		opad[i] = bkey[i] ^ 0x5C5C5C5C;
	}
	hash = binl_md5(ipad.concat(rstr2binl(data)), 512 + data.length * 8);
	return binl2rstr(binl_md5(opad.concat(hash), 512 + 128));
}

/*
 * Convert a raw string to a hex string
 */
function rstr2hex(input) {
	var hex_tab = '0123456789abcdef',
		output = '',
		x,
		i;
	for (i = 0; i < input.length; i += 1) {
		x = input.charCodeAt(i);
		output += hex_tab.charAt((x >>> 4) & 0x0F) +
			hex_tab.charAt(x & 0x0F);
	}
	return output;
}

/*
 * Encode a string as utf-8
 */
function str2rstr_utf8(input) {
	return unescape(input);
}

/*
 * Take string arguments and return either raw or hex encoded strings
 */
function raw_md5(s) {
	return rstr_md5(str2rstr_utf8(s));
}
function hex_md5(s) {
	return rstr2hex(raw_md5(s));
}
function raw_hmac_md5(k, d) {
	return rstr_hmac_md5(str2rstr_utf8(k), str2rstr_utf8(d));
}
function hex_hmac_md5(k, d) {
	return rstr2hex(raw_hmac_md5(k, d));
}

function md5(string, key, raw) {
	if (!key) {
		if (!raw) {
			return hex_md5(string);
		}
		return raw_md5(string);
	}
	if (!raw) {
		return hex_hmac_md5(key, string);
	}
	return raw_hmac_md5(key, string);
}

// end md5.js

// base64.js
/**
*
*  Base64 encode / decode
*  http://www.webtoolkit.info/
*
**/

// private property
var _keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

var Base64 = {

// public method for encoding
encode : function (input) {
    var output = "";
    var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
    var i = 0;

    input = Base64._utf8_encode(input);

    while (i < input.length) {

        chr1 = input.charCodeAt(i++);
        chr2 = input.charCodeAt(i++);
        chr3 = input.charCodeAt(i++);

        enc1 = chr1 >> 2;
        enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
        enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
        enc4 = chr3 & 63;

        if (isNaN(chr2)) {
            enc3 = enc4 = 64;
        } else if (isNaN(chr3)) {
            enc4 = 64;
        }

        output = output +
        _keyStr.charAt(enc1) + _keyStr.charAt(enc2) +
        _keyStr.charAt(enc3) + _keyStr.charAt(enc4);

    }

    return output;
},

// public method for decoding
decode : function (input) {
    var output = "";
    var chr1, chr2, chr3;
    var enc1, enc2, enc3, enc4;
    var i = 0;

    input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

    while (i < input.length) {

        enc1 = _keyStr.indexOf(input.charAt(i++));
        enc2 = _keyStr.indexOf(input.charAt(i++));
        enc3 = _keyStr.indexOf(input.charAt(i++));
        enc4 = _keyStr.indexOf(input.charAt(i++));

        chr1 = (enc1 << 2) | (enc2 >> 4);
        chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        chr3 = ((enc3 & 3) << 6) | enc4;

        output = output + String.fromCharCode(chr1);

        if (enc3 != 64) {
            output = output + String.fromCharCode(chr2);
        }
        if (enc4 != 64) {
            output = output + String.fromCharCode(chr3);
        }

    }

    output = Base64._utf8_decode(output);

    return output;

},

// private method for UTF-8 encoding
_utf8_encode : function (string) {
    string = string.replace(/\r\n/g,"\n");
    var utftext = "";

    for (var n = 0; n < string.length; n++) {

        var c = string.charCodeAt(n);

        if (c < 128) {
            utftext += String.fromCharCode(c);
        }
        else if((c > 127) && (c < 2048)) {
            utftext += String.fromCharCode((c >> 6) | 192);
            utftext += String.fromCharCode((c & 63) | 128);
        }
        else {
            utftext += String.fromCharCode((c >> 12) | 224);
            utftext += String.fromCharCode(((c >> 6) & 63) | 128);
            utftext += String.fromCharCode((c & 63) | 128);
        }

    }

    return utftext;
},

// private method for UTF-8 decoding
_utf8_decode : function (utftext) {
    var string = "";
    var i = 0;
    var c = 0;
    var c1 = 0;
    var c2 = 0;

    while ( i < utftext.length ) {

        c = utftext.charCodeAt(i);

        if (c < 128) {
            string += String.fromCharCode(c);
            i++;
        }
        else if((c > 191) && (c < 224)) {
            c2 = utftext.charCodeAt(i+1);
            string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
            i += 2;
        }
        else {
            c2 = utftext.charCodeAt(i+1);
            c3 = utftext.charCodeAt(i+2);
            string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
            i += 3;
        }

    }

    return string;
}

}

// end base64.js

function xmlEncode(text) {
	return text.replace(/([\&"'<>])/g, function(x, item) {
		return {'&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;', "'": '&apos;'}[item];
	});
}
function xmlDecode(xml) {
	return xml.replace(/(&quot;|&lt;|&gt;|&amp;|&apos;)/g, function(x, item) {
		return {'&amp;': '&', '&quot;': '"', '&lt;': '<', '&gt;': '>', '&apos;': "'"}[item];
	});
}

// xmpp.js
function XmlStreamParser() {
	this.buffer = "";
	this._parsed = [];
	this.reset();
	return this;
}

XmlStreamParser.kText = "text";
XmlStreamParser.kElement = "element";
XmlStreamParser.kEndElement = "endElement";
XmlStreamParser.kAttributeName = "attributeName";
XmlStreamParser.kAttributeValue = "attributeValue";

XmlStreamParser.prototype.reset = function() {
	this._state = XmlStreamParser.kText;
	this._attributes = {};
	this._attributeName = "";
	this._attributeValue = "";
	this._attributeEquals = false;
	this._attributeQuote = "";
	this._slash = false;
	this._value = "";
	this._decl = false;
}

XmlStreamParser.prototype.parse = function(data) {
	this._parsed = [];

	for (var i = 0; i < data.length; i++) {
		var c = data.charAt(i);
		this.parseCharacter(c);
	}

	return this._parsed;
}

XmlStreamParser.prototype.flush = function() {
	var node = {type: this._state};
	if (this._value) {
		node.value = xmlDecode(this._value);
	}
	if (this._attributes.length || this._state == XmlStreamParser.kElement) {
		node.attributes = this._attributes;
	}
	if (this._state != XmlStreamParser.kText || this._value) {
		this.emit(node);
	}
	this.reset();
}

XmlStreamParser.prototype.parseCharacter = function(c) {
	switch (this._state) {
	case XmlStreamParser.kText:
		if (c == '<') {
			this.flush();
			this._state = XmlStreamParser.kElement;
		} else {
			this._value += c;
		}
		break;
	case XmlStreamParser.kElement:
	case XmlStreamParser.kEndElement:
		switch (c) {
		case '>':
			this.finishElement();
			break;
		case '/':
			if (!this._value) {
				this._state = XmlStreamParser.kEndElement;
			} else if (!this._slash) {
				this._slash = true;
			} else {
				this._value += c;
			}
			break;
		case '?':
			if (!this._value) {
				this._decl = true;
			} else {
				this._value += '?';
			}
			break;
		case ' ':
		case '\t':
		case '\r':
		case '\n':
			this._state = XmlStreamParser.kAttributeName;
			break;
		default:
			if (this._slash) {
				this._slash = false;
				this._value += '/';
			}
			this._value += c;
			break;
		}
		break;
	case XmlStreamParser.kAttributeName:
		switch (c) {
		case ' ':
		case '\t':
		case '\r':
		case '\n':
			if (this._attributeName) {
				this._state = XmlStreamParser.kAttributeValue;
			}
			break;
		case '/':
			if (!this._slash) {
				this._slash = true;
			} else {
				this._value += '/';
			}
			break;
		case '=':
			this._state = XmlStreamParser.kAttributeValue;
			break;
		case '>':
			if (this._attributeName) {
				this._attributes[this._attributeName] = null;
			}
			this._state = XmlStreamParser.kElement;
			this.finishElement();
			break;
		default:
			this._attributeName += c;
			break;
		}
		break;
	case XmlStreamParser.kAttributeValue:
		switch (c) {
		case ' ':
		case '\t':
		case '\r':
		case '\n':
			if (this._attributeValue) {
				this._state = XmlStreamParser.kAttributeName;
			}
			break;
		case '"':
		case "'":
			if (!this._attributeValue && !this._attributeQuote) {
				this._attributeQuote = c;
			} else if (this._attributeQuote == c) {
				this._attributes[this._attributeName] = this._attributeValue;
				this._attributeName = "";
				this._attributeValue = "";
				this._attributeQuote = "";
				this._state = XmlStreamParser.kAttributeName;
			} else {
				this._attributeValue += c;
			}
			break;
		case '>':
			this.finishElement();
			break;
		default:
			this._attributeValue += c;
			break;
		}
		break;
	}
}

XmlStreamParser.prototype.finishElement = function() {
	if (this._decl) {
		this.reset();
	} else {
		var value = this._value;
		var slash = this._slash;
		this.flush();
		if (slash) {
			this._state = XmlStreamParser.kEndElement;
			this._value = value;
			this.flush();
		}
	}
	this._state = XmlStreamParser.kText;
}

XmlStreamParser.prototype.emit = function(node) {
	this._parsed.push(node);
}

function XmlStanzaParser(depth) {
	this._depth = depth || 0;
	this._parsed = [];
	this._stack = [];
	this._stream = new XmlStreamParser();
	return this;
}

XmlStanzaParser.prototype.reset = function() {
	this._parsed = [];
	this._stack = [];
	this._stream.reset();
}

XmlStanzaParser.prototype.emit = function(stanza) {
	this._parsed.push(stanza);
}

XmlStanzaParser.prototype.parse = function(data) {
	this._parsed = [];
	var nodes = this._stream.parse(data);
	for (var i = 0; i < nodes.length; i++) {
		this.parseNode(nodes[i]);
	}
	return this._parsed;
}

XmlStanzaParser.prototype.parseNode = function(node) {
	switch (node.type) {
	case XmlStreamParser.kElement:
		this._stack.push({name: node.value, attributes: node.attributes, children: [], text: ""});
		break;
	case XmlStreamParser.kEndElement:
		if (this._stack.length == 1 + this._depth) {
			this.emit(this._stack.pop());
		} else {
			var last = this._stack.pop();
			this._stack[this._stack.length - 1].children.push(last);
		}
		break;
	case XmlStreamParser.kText:
		if (this._stack) {
			this._stack[this._stack.length - 1].text += node.value;
		}
		break;
	}
}

// end xmpp.js

var gFocus = false;
var gUnread = 0;

function updateTitle() {
	if (gUnread) {
		terminal.setTitle("(" + gUnread.toString() + ") ~Friends XMPP");
	} else {
		terminal.setTitle("~Friends XMPP");
	}
}

terminal.print("~Friends XMPP");
updateTitle();
terminal.setEcho(false);
terminal.setPrompt("Username:");
terminal.readLine().then(function(userName) {
	terminal.setPassword(true);
	terminal.setPrompt("Password:");
	terminal.readLine().then(function(password) {
		terminal.setPrompt(">");
		terminal.setPassword(false);
		network.newConnection().then(function(socket) {
			connect(socket, userName, password);
		}).catch(function(error) {
			terminal.print(error);
		});
	});
});

function niceTime(lastTime, thisTime) {
	if (!lastTime) {
		return thisTime;
	}
	let result = [];
	let lastParts = lastTime.split(" ");
	let thisParts = thisTime.split(" ");
	for (let i = 0; i < thisParts.length; i++) {
		if (thisParts[i] !== lastParts[i]) {
			result.push(thisParts[i]);
		}
	}
	return result.join(" ");
}

function formatMessage(message) {
	var result;
	if (typeof message == "string") {
		result = [];
		var regex = /(\w+:\/*\S+?)(?=(?:[\.!?])?(?:$|\s))/gi;
		var match;
		var lastIndex = 0;
		while ((match = regex.exec(message)) !== null) {
			result.push({class: "base1", value: message.substring(lastIndex, match.index)});
			result.push({href: match[0]});
			lastIndex = regex.lastIndex;
		}
		result.push({class: "base1", value: message.substring(lastIndex)});
	} else {
		result = message;
	}
	return result;
}

var lastTimestamp = null;
function printMessage(stanza) {
	var body;
	var delayed = false;
	var now = new Date().toString();
	for (var i in stanza.children) {
		if (stanza.children[i].name == "body") {
			body = stanza.children[i].text;
		}
		if (stanza.children[i].name == "delay") {
			delayed = true;
			now = new Date(stanza.children[i].attributes.stamp).toString();
		}
	}

	var from = stanza.attributes.from || "unknown";
	if (from && from.indexOf('/') != -1) {
		from = from.split("/")[1];
	}

	terminal.print(
		{class: "base0", value: niceTime(lastTimestamp, now)},
		" ",
		{class: "base00", value: "<"},
		{class: "base3", value: from},
		{class: "base00", value: ">"},
		" ",
		formatMessage(body));
	lastTimestamp = now;
}

var gRecent = [];

core.register("focus", function() {
	gFocus = true;
	gUnread = 0;
	updateTitle();
});

core.register("blur", function() {
	gFocus = false;
});

var gPingCount = 0;

function schedulePing(socket) {
	setTimeout(function() {
		socket.write("<iq type='get' id='ping" + (++gPingCount) + "'><ping xmlns='urn:xmpp:ping'/></iq>");
		schedulePing(socket);
	}, 60000);
}

terminal.split([
	{type: "horizontal", children: [
		{name: "terminal", grow: 1},
		{name: "users", grow: 0},
	]},
]);
terminal.select("terminal");

var gPresence = {};

function refreshUsers() {
	terminal.select("users");
	terminal.clear();
	for (var i in gPresence) {
		terminal.print(i);
	}
	terminal.select("terminal");
}

function connect(socket, userName, password) {
	var kTrustedCertificate = "-----BEGIN CERTIFICATE-----\n" +
		"MIICqjCCAhOgAwIBAgIJAPEhMguftPdoMA0GCSqGSIb3DQEBCwUAMG4xCzAJBgNV\n" +
		"BAYTAlVTMQ4wDAYDVQQIDAVUZXhhczEPMA0GA1UEBwwGQXVzdGluMRswGQYDVQQK\n" +
		"DBJUcm91YmxlIEltcGFjdCBMTEMxITAfBgNVBAMMGGphYmJlci50cm91YmxlaW1w\n" +
		"YWN0LmNvbTAeFw0xNDEyMjYwMzU5NDRaFw0yNDEyMjMwMzU5NDRaMG4xCzAJBgNV\n" +
		"BAYTAlVTMQ4wDAYDVQQIDAVUZXhhczEPMA0GA1UEBwwGQXVzdGluMRswGQYDVQQK\n" +
		"DBJUcm91YmxlIEltcGFjdCBMTEMxITAfBgNVBAMMGGphYmJlci50cm91YmxlaW1w\n" +
		"YWN0LmNvbTCBnzANBgkqhkiG9w0BAQEFAAOBjQAwgYkCgYEAueniASgCpF7mQFGt\n" +
		"TycOhMt9VMetFwwDkwVglvO+VKq8JWxWkJaCWm8YYacG6+zn4RlV3zVQhrAcReTU\n" +
		"pPQAe+28wJdqVt/HPyfcwJtLKUEL7Nk5N8mY2s6yyBVvMn9e7Yt/fnv7pOCpcmBi\n" +
		"kuLlwSGEfMnDskt8kH4coidP4w0CAwEAAaNQME4wHQYDVR0OBBYEFOztZhuuqXrN\n" +
		"yUnPo/9aoNNb/o2CMB8GA1UdIwQYMBaAFOztZhuuqXrNyUnPo/9aoNNb/o2CMAwG\n" +
		"A1UdEwQFMAMBAf8wDQYJKoZIhvcNAQELBQADgYEAgK/7yoGEHeG95i6E1A8ZBkeL\n" +
		"monKMys3RxnJciuFdBrUcvymsgOTrAGvatPXatNbHQ/eY8LnkKHtf0pCCs0B/xST\n" +
		"DTO3KdlNCXApMUieFPjVggRzikbmbPCvtTt2BzqQKzVqubf9eM+kbsD7Pkgycm5+\n" +
		"q46TZws0oz5lAvklIgo=\n" +
		"-----END CERTIFICATE-----";
	var resource = "tildefriend" + core.user.index;
	socket.connect("jabber.troubleimpact.com", 5222).then(function() {
		var parse = new XmlStanzaParser(1);
		socket.write("<?xml version='1.0'?>");
		socket.write("<stream:stream to='jabber.troubleimpact.com' xmlns='jabber:client' xmlns:stream='http://etherx.jabber.org/streams' version='1.0'>");

		var started = false;
		var authenticated = false;
		socket.onError(function(error) {
			terminal.print("SOCKET ERROR");
			terminal.print(JSON.stringify(error));
			terminal.print(error);
			terminal.print(error.message);
		});
		socket.read(function(data) {
			try {
				gRecent.push(data);
				while (gRecent.length > 10) {
					gRecent.shift();
				}
				if (data === undefined) {
					terminal.print(JSON.stringify(data));
					terminal.print("Disconnected.");
					terminal.print("Recent data:");
					for (let i = 0; i < gRecent.length; i++) {
						terminal.print(JSON.stringify(gRecent[i]));
					}
					return;
				}
				parse.parse(data).forEach(function(stanza) {
					if (stanza.name == "stream:features") {
						if (!started) {
							socket.write("<starttls xmlns='urn:ietf:params:xml:ns:xmpp-tls'/>");
						} else if (!authenticated) {
							socket.write("<auth xmlns='urn:ietf:params:xml:ns:xmpp-sasl' mechanism='DIGEST-MD5'/>");
						} else {
							socket.write("<iq type='set' id='bind0'><bind xmlns='urn:ietf:params:xml:ns:xmpp-bind'><resource>" + resource + "</resource></bind></iq>");
						}
					} else if (stanza.name == "proceed") {
						if (!started) {
							started = true;
							socket.addTrustedCertificate(kTrustedCertificate);
							socket.startTls().then(function() {
								parse.reset();
								socket.write("<stream:stream to='jabber.troubleimpact.com' xmlns='jabber:client' xmlns:stream='http://etherx.jabber.org/streams' version='1.0'>");
							}).catch(function(e) {
								terminal.print("TLS FAILED: " + e);
							});
						}
					} else if (stanza.name == "success") {
						authenticated = true;
						socket.write("<?xml version='1.0'?>");
						socket.write("<stream:stream to='jabber.troubleimpact.com' xmlns='jabber:client' xmlns:stream='http://etherx.jabber.org/streams' version='1.0'>");
						parse.reset();
					} else if (stanza.name == "iq") {
						if (stanza.attributes.id == "bind0") {
							socket.write("<iq type='set' id='session0'><session xmlns='urn:ietf:params:xml:ns:xmpp-session'/></iq>");
						} else if (stanza.attributes.id == "session0") {
							socket.write("<presence to='chadhappyfuntime@conference.jabber.troubleimpact.com/" + userName + "'><priority>1</priority><x xmlns='http://jabber.org/protocol/muc'/></presence>");
							core.register("onInput", function(input) {
								socket.write("<message type='groupchat' to='chadhappyfuntime@conference.jabber.troubleimpact.com'><body>" + xmlEncode(input) + "</body></message>");
							});
							schedulePing(socket);
						} else if (stanza.attributes.id == "ping" + gPingCount) {
							// Ping response.
						} else {
							terminal.print(JSON.stringify(stanza));
						}
					} else if (stanza.name == "message") {
						printMessage(stanza);
						if (!gFocus) {
							++gUnread;
							updateTitle();
						}
					} else if (stanza.name == "challenge") {
						var challenge = Base64.decode(stanza.text);
						var parts = challenge.split(',');
						challenge = {};
						for (var i = 0; i < parts.length; i++) {
							var equals = parts[i].indexOf("=");
							if (equals != -1) {
								var key = parts[i].substring(0, equals);
								var value = parts[i].substring(equals + 1);
								if (value.length > 2 && value.charAt(0) == '"' && value.charAt(value.length - 1) == '"') {
									value = value.substring(1, value.length - 1);
								}
								challenge[key] = value;
							}
						}
						if (challenge.rspauth) {
							socket.write("<response xmlns='urn:ietf:params:xml:ns:xmpp-sasl'/>");
						} else {
							var realm = "jabber.troubleimpact.com";
							var cnonce = Base64.encode(new Date().toString());
							var x = userName + ":" + realm + ":" + password;
							var y = raw_md5(x);
							var a1 = y + ":" + challenge.nonce + ":" + cnonce;
							var digestUri = "xmpp/" + realm;
							var a2 = "AUTHENTICATE:" + digestUri;
							var ha1 = md5(a1);
							var ha2 = md5(a2);
							var nc = "00000001";
							var kd = ha1 + ":" + challenge.nonce + ":" + nc + ":" + cnonce + ":" + challenge.qop + ":" + ha2;
							var response = md5(kd);
							var value = Base64.encode('username="' + userName + '",realm="' + realm + '",nonce="' + challenge.nonce + '",cnonce="' + cnonce + '",nc=' + nc + ',qop=' + challenge.qop + ',digest-uri="' + digestUri + '",response=' + response + ',charset=utf-8');
							socket.write("<response xmlns='urn:ietf:params:xml:ns:xmpp-sasl'>" + value + "</response>");
						}
					} else if (stanza.name == "presence") {
						var name = stanza.attributes.from.split('/', 2)[1];
						if (stanza.attributes.type == "unavailable") {
							terminal.print(name + " has left the room.");
							delete gPresence[name];
						} else {
							if (!gPresence[name]) {
								terminal.print(name + " has joined the room.");
							}
							gPresence[name] = stanza;
						}
						refreshUsers();
					} else {
						terminal.print(data);
					}
				});
			} catch (error) {
				terminal.print("ERROR: " + error);
				terminal.print("ERROR: " + JSON.stringify(error));
				terminal.print("ERROR: " + error.message);
			}
		});
	}).catch(function(e) {
		terminal.print("connect failed: ", e);
	});
}
