"use strict";

core.register("geolocation", function(event) {
	terminal.print("hi");
	terminal.cork();
	if (event.position) {
		for (let field in event.position.coords) {
			let value = event.position.coords[field];
			terminal.print(field, ": ", value != null ? value.toString() : "null");
		}
	} else if (event.error) {
		terminal.print(event.error.message);
		terminal.clearWatch();
	}
	terminal.uncork();
});

terminal.watchPosition({enableHighAccuracy: true});
//terminal.watchPosition();