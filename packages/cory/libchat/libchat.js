"use strict";

exports.ChatService = class {
	static handleMessages(serviceClass) {
		let self = this;
		let sessions = {};

		core.register("onMessage", function(sender, options) {
			let service = sessions[options.name];
			if (!service) {
				service = new serviceClass(options);
				sessions[options.name] = service;
			} else {
				service._service.addCallback(options.callback);
			}
			return service._service.makeInterface(service);
		});
	}

	constructor(callback) {
		this._callbacks = [callback];
		this._conversations = {};
		this._state = null;
	}

	makeInterface(service) {
		let self = this;
		return {
			sendMessage: service.sendMessage.bind(service),
			disconnect: service.disconnect.bind(service),

			getConversations: self.getConversations.bind(self),
			getHistory: self.getHistory.bind(self),
			getParticipants: self.getParticipants.bind(self),
		};
	}

	addCallback(callback) {
		if (this._callbacks.indexOf(callback) == -1) {
			this._callbacks.push(callback);
		}
	}

	_invokeCallback(message) {
		let self = this;
		for (let i = self._callbacks.length - 1; i >= 0; i--) {
			let callback = self._callbacks[i];
			try {
				callback(message);
			} catch (error) {
				self._callbacks.splice(i, 1);

				// XXX: Send it to the other connections?
				print(error);
			}
		}
	}

	_getConversation(conversation) {
		if (!this._conversations[conversation]) {
			this._conversations[conversation] = {history: [], participants: []};
		}
		return this._conversations[conversation];
	}

	notifyMessageReceived(conversation, message) {
		let fullMessage = {action: "message", conversation: conversation || "", message: message};
		this._getConversation(conversation || "").history.push(fullMessage);
		this._invokeCallback(fullMessage);
	}

	notifyPresenceChanged(conversation, user, state) {
		let leaving = state == "unavailable";
		let participants = this._getConversation(conversation).participants;
		let index = participants.indexOf(user);
		if (leaving) {
			participants.splice(index, 1);
		} else if (index == -1) {
			participants.push(user);
		}
		this._invokeCallback({
			action: "presence",
			conversation: conversation,
			user: user,
			presence: state,
		});
	}

	notifyParticipantList(conversation, participants) {
		let current = this._getConversation(conversation).participants;
		for (let i in current) {
			if (!participants[i]) {
				this.notifyPresenceChanged(conversation, i, "unavailable");
			}
		}
		for (let i in participants) {
			this.notifyPresenceChanged(conversation, i, participants[i]);
		}
	}

	notifyStateChanged(state) {
		this._state = state;
		this._invokeCallback({action: state});
	}

	reportError(error) {
		this._invokeCallback({
			action: "error",
			error: error,
		}).catch(function(error) {
			print(error);
		});
	}

	isConversation(conversation) {
		return this._conversations[conversation] != null;
	}

	getConversations() {
		return Object.keys(this._conversations);
	}

	getHistory(conversation) {
		let result;
		if (this._conversations[conversation]) {
			result = this._conversations[conversation].history;
		}
		return result;
	}

	getParticipants(conversation) {
		let result;
		if (this._conversations[conversation]) {
			result = this._conversations[conversation].participants;
		}
		return result;
	}
}