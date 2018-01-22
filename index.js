//TODO: gracefully leavegame while choosing
//3 player min
//Less spammy

var TelegramBot = require('node-telegram-bot-api');
var Shuffle = require('shuffle');
var fs = require('fs');

const options = {
    webHook: {
        // Just use 443 directly
        port: 443
    }
};
const url = process.env.NOW_URL;
const bot = new TelegramBot("485322392:AAF2Bol5I8Aw4YN11JbmMRZI1In9sEsr2CM", options);

bot.setWebHook(`${url}/bot485322392:AAF2Bol5I8Aw4YN11JbmMRZI1In9sEsr2CM`);

const creatorID = 202588723;

var debug=false;

function CardResponse(username, response) {
	this.username = username;
	this.response = response;
}

var players = [];
var playerNames = new Object();
var czar;
var czarNumber;
var playerHands = new Object();
var playerPoints = new Object();
var waitingForCardReplies = [];
var waitingForCzarReply = 0;
var cardResponses = [];

try{ 
var whiteCards = fs.readFileSync('cah_white_cards.txt', 'utf8').split("\n");
var blackCards = fs.readFileSync('cah_black_cards.txt', 'utf8').split("\n");

var blackDeck = Shuffle.shuffle({deck: blackCards});
var whiteDeck = Shuffle.shuffle({deck: whiteCards});

bot.on('message', (msg) => {  
    if(debug) {
        bot.sendMessage(creatorID, JSON.stringify(msg));
    }

	if(msg.text && msg.reply_to_message && waitingForCardReplies.indexOf(msg.reply_to_message.message_id) > -1) {
		var text = msg.text;
	        bot.deleteMessage(msg.chat.id, msg.message_id);
		var index = waitingForCardReplies.indexOf(msg.reply_to_message.message_id);
	        if(index > -1) {
                	waitingForCardReplies.splice(index, 1);
		}
		cardResponses.push(new CardResponse(msg.from.username, text));
		if(waitingForCardReplies.length == 0) {
			chooseBestCard(msg);
		}
	}

	if(msg.text && msg.reply_to_message && waitingForCzarReply == msg.reply_to_message.message_id && msg.from.username == czar) {
		var text = msg.text;
	        bot.deleteMessage(msg.chat.id, msg.message_id);
               	waitingForCzarReply = 0;
		for(var i=0; i < cardResponses.length; i++) {
			if(cardResponses[i].response == text) {
				bot.sendMessage(msg.chat.id, "@" + cardResponses[i].username + " won this round with " + text);
				playerPoints[cardResponses[i].username]++;
			}
		}
		cardResponses = [];
		czarNumber++;
		if(czarNumber == players.length) {
			czarNumber = 0;
		}
		czar = playerNames[players[czarNumber].toString()];
		bot.sendMessage(msg.chat.id, "@" + czar + " is the new Card Czar");
		drawAndSendCards(msg.chat.id, false);
	}

    if(msg.text && msg.text.toLowerCase() == "/debug" && msg.from.id == creatorID) {
        debug=!debug;
        bot.sendMessage(msg.from.id, "You have turned debugging to: " + debug);
    }

    if(msg.text && msg.text.toLowerCase() == "/stopgame") {
        bot.sendMessage(msg.chat.id, "@" + msg.from.username + " stopped the game.");
	printScore(msg.chat.id);
	players = [];
	playerNames = new Object();
	czar = "";
	czarNumber = 0;
	playerHands = new Object();
	playerPoints = new Object();
	waitingForCardReplies = [];
	waitingForCzarReply = 0;
	cardResponses = [];
    }

    if(msg.text && msg.text.toLowerCase() == "/rules") {
    }

    if(msg.text && msg.text.toLowerCase() == "/score") {
	printScore(msg.chat.id);
    }

    if(msg.text && msg.text.toLowerCase() == "/joingame") {
        bot.sendMessage(msg.chat.id, msg.from.username + " will be joining us next round");
        players.push(msg.from.id);
        playerNames[msg.from.id.toString()] = msg.from.username;
        bot.deleteMessage(msg.chat.id, msg.message_id);
    }

    if(msg.text && msg.text.toLowerCase() == "/leavegame") {
        var index = players.indexOf(msg.from.id);
        if(index > -1) {
                bot.sendMessage(msg.chat.id, msg.from.username + " is leaving the game");
		players.splice(index, 1);
		delete playerNames[msg.from.id.toString()];
	}
        bot.deleteMessage(msg.chat.id, msg.message_id);
    }    
   
    if(msg.text && msg.text.toLowerCase() == "/listplayers") {
        var playerList = "Players:\n";
	var messageId = 0;

	for (var key in playerNames) {
		playerList += "@" + playerNames[key] + "\n";;
	}

        bot.sendMessage(msg.chat.id, playerList, {reply_to_message_id: msg.message_id});
    }

    if(msg.text && msg.text.toLowerCase() == "/startgame") {
	//Check if 3 players
	bot.sendMessage(msg.chat.id, "Starting Game").then(function(value) {
		drawAndSendCards(value.chat.id, true);
		resetScores();
		bot.sendMessage(msg.chat.id, "@" + playerNames[players[0].toString()] + " is the Card Czar");
		czar = playerNames[players[0].toString()];
		czarNumber = 0;
        }, function(reason) {
        });
    }
});

function drawAndSendCards(chatId, start) {
		var card = blackDeck.draw();
		if(card == undefined) {
			blackDeck = Shuffle.shuffle({deck: blackCards});
			card = blackDeck.draw();
		}
	        bot.sendMessage(chatId, card).then(function(value) {
			bot.pinChatMessage(value.chat.id, value.message_id, {disable_notification: true}).then(function(value) {
				dealWhiteCards(chatId, start);
			}, function(reason) {
			});
		}, function(reason) {
			// rejection
		});
}

function dealWhiteCards(chatId, start) {
		for (var key in playerNames) {
			var playerMessage = "@" + playerNames[key] + ", here are your cards\n";
			if(start) {
				playerHands[key] = whiteDeck.draw(5);
			} else if(playerHands[key].length == 4) {
				playerHands[key].push(whiteDeck.draw());
			}
			var keyboard = new Array();
			playerHands[key].forEach(function(value) {
				keyboard.push(new Array(value));
			});
			if(playerNames[key] != czar) {
		                bot.sendMessage(chatId, playerMessage, {reply_markup: {keyboard: keyboard, one_time_keyboard: true, selective: true}}).then(function(value) {
					waitingForCardReplies.push(value.message_id);
				}, function(reason) {
				});
			}
		}
		bot.sendMessage(chatId, "Select the card you think is the funniest from your hand");

}

function resetScores() {	
	for (var key in playerNames) {
		playerPoints[playerNames[key]] = 0;
	}
}

function chooseBestCard(msg) {
	var response = cardResponses;
	var keyboard = new Array();
	for(var i=0; i<cardResponses.length; i++) {
		keyboard.push(new Array(response[i].response));
		for(var x = 0; x < players.length; x++) {
			var index = playerHands[players[x].toString()].indexOf(response[i].response);
		        if(index > -1) {
               			playerHands[players[x].toString()].splice(index, 1);
			}
		}
	}
	bot.sendMessage(msg.chat.id, "@" + czar + ", choose the funniest card", {reply_markup: {keyboard: keyboard, one_time_keyboard: true, selective: true}}).then(function(value) {
		waitingForCzarReply = value.message_id;
	}, function(reason) {
	});
}

function printScore(chatId) {
	var pointsString = "The score is:\n";
	for(var key in playerPoints) {
		pointsString += "@" + key + ": " + playerPoints[key] + " points\n";
	}
	bot.sendMessage(chatId, pointsString);
}

} catch(error) {
    bot.sendMessage(creatorID, JSON.stringify(error));
}
