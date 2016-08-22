"use strict";

//! {"category": "tests"}

async function main() {
	terminal.print("Hi.  What's your name?");
	let name = await terminal.readLine();
	terminal.print("Hello, " + name + ".");

	let number = Math.floor(Math.random() * 100);
	let guesses = 0;
	while (true) {
		terminal.print("Guess the number.");
		try {
			let guess = parseInt(await terminal.readLine());
			guesses++;
			if (guess < number) {
				terminal.print("Too low.");
			} else if (guess > number) {
				terminal.print("Too high.");
			} else {
				terminal.print("You got it in " + guesses.toString() + " guesses!  It was " + number.toString() + ".  Good job, " + name + ".");
				break;
			}
		} catch (error) {
			terminal.print(error);
		}
	}
}

main().catch(terminal.print);