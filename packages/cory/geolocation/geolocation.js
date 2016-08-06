"use strict";

let gPosition = null;
let gOrientation = null;
let gError = null;

function draw() {
	terminal.cork();
	terminal.clear();
	if (gPosition) {
		for (let field in gPosition.coords) {
			let value = gPosition.coords[field];
			terminal.print(field, ": ", value != null ? value.toString() : "null");
		}
	}
	if (gOrientation && gOrientation.alpha && gOrientation.beta && gOrientation.gamma) {
		terminal.print(gOrientation.alpha.toString(), ", ", gOrientation.beta.toString(), ", ", gOrientation.gamma.toString(), ", ", gOrientation.absolute.toString());
	}
	if (gError) {
		terminal.print(event.error.message);
		terminal.clearWatch();
	}
	terminal.uncork();
}

core.register("geolocation", function(event) {
	if (event.position) {
		gPosition = event.position;
	} else if (event.error) {
		gError = event.error;
	}
	draw();
});

core.register("deviceorientation", function(event) {
	gOrientation = event.orientation;
	draw();
});

terminal.watchPosition({enableHighAccuracy: true});
terminal.setSendDeviceOrientationEvents(true);