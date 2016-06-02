"use strict";

//! {"description": "A list of all packages and connected users"}

core.register("onSessionBegin", index);
core.register("onSessionEnd", index);

function index() {
	return Promise.all([core.getPackages(), core.getUsers()]).then(function(values) {
		let packages = values[0];
		let users = values[1];
		let usersByApp = {};
		let servicesByApp = {};
		for (let i in users) {
			let user = users[i];
			let key = "/~" + user.packageOwner + "/" + user.packageName;
			if (user.key.substring(0, "service_".length) == "service_") {
				if (!servicesByApp[key]) {
					servicesByApp[key] = [];
				}
				servicesByApp[key].push(user);
			} else {
				if (!usersByApp[key]) {
					usersByApp[key] = [];
				}
				usersByApp[key].push(user.name);
			}
		}

		let packagesByCategory = {};
		packages.forEach(function(app) {
			let category = (app.manifest ? app.manifest.category : null) || "other";
			if (!packagesByCategory[category]) {
				packagesByCategory[category] = [];
			}
			packagesByCategory[category].push(app);
		});

		terminal.cork();
		terminal.clear();
		terminal.print("Available applications [active users]:");
		for (let category in packagesByCategory) {
			terminal.print({style: "font-weight: bold", value: category});
			packagesByCategory[category].sort(function(x, y) {
				return Math.sign(x.owner.localeCompare(y.owner)) * 10 + Math.sign(x.name.localeCompare(y.name)) * 1;
			}).forEach(function(app) {
				let users = usersByApp["/~" + app.owner + "/" + app.name];
				let services = servicesByApp["/~" + app.owner + "/" + app.name];
				let message = [];
				if (users || services) {
					message.push(" [");
					if (users) {
						let counts = {};
						for (let i = 0; i < users.length; i++) {
							counts[users[i]] = (counts[users[i]] || 0) + 1;
						}
						let names = Object.keys(counts).sort();
						for (let i = 0; i < names.length; i++) {
							var name = names[i];
							if (message.length > 1) {
								message.push(", ");
							}
							message.push({class: "orange", value: name});
							if (counts[name] > 1) {
								message.push({class: "base01", value: "(x" + counts[name] + ")"});
							}
						}
					}
					if (services) {
						if (users) {
							message.push(", ");
						}
						message.push("⚒".repeat(services.length));
					}
					message.push("]");
				}
				terminal.print(
					"• ",
					{href: "/~" + app.owner + "/" + app.name, target: "_self"},
					message,
					app.manifest && app.manifest.description ? " - " + app.manifest.description.toString() : "");
			});
		}
		terminal.uncork();
	});
}

index().catch(function(error) {
	terminal.print("ERROR:", error);
});