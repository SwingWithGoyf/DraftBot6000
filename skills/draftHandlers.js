/*

Botkit Studio Skill module to enhance the "add draft" script

*/

module.exports = function(controller) {
    
    var messageArray = {};

    controller.hears(['^call me (.*)', '^my name is (.*)'], 'direct_message,direct_mention,mention', function(bot, message) {
        var name = message.match[1];
        controller.storage.users.get(message.user, function(err, user) {
            if (!user) {
                user = {
                    id: message.user,
                };
            }
            user.name = name;

            controller.storage.users.save(user, function(err, id) {
                bot.reply(message, 'Got it. I will call you `' + user.name + '` from now on.  This will also be the default nickname I will map for you in subsequent drafts');
            });
        });
    });
    
    controller.hears(['^what is my name', '^who am i'], 'direct_message,direct_mention,mention', function(bot, message) {
    
        getNickNameFromConvo(controller, message, function(userName) {
            bot.reply(message, 'Your stored nickname is ' + userName + '.  Note you can use the `call me <foo>` command to change this later.');
        });
    });
    
    controller.hears(['^new draft (.*)', '^add draft (.*)'], 'direct_message,direct_mention,mention', function(bot, message) {
        
        var draftName = message.match[1];

        // make sure the default user mappings are present first
        storeDefaultUsers(controller, function(defaultUser) {
            controller.storage.users.get(defaultUser.id, function(err, user) {
                if (!user) {
                    user = {
                        id: defaultUser.id,
                        name: defaultUser.name
                    };
                    controller.storage.users.save(user, function(err, id) {
                        console.log('Saving default user with name ' + user.name + ' and id ' + user.id);
                    });
                }
            });
        });
    
        controller.storage.teams.get(message.team, function(err, team) {
            bot.startConversation(message, function(err, convo) {
                if (!err) {
                    convo.say('Alright, lets start a new draft...');
    
                    if (draftName) {
                        convo.ask('You want me to create a new draft called `' + draftName + '`?', [
                            {
                                pattern: 'yes',
                                callback: function(response, convo) {
                                    // since no further messages are queued after this,
                                    // the conversation will end naturally with status == 'completed'
                                    convo.next();
                                }
                            },
                            {
                                pattern: 'no',
                                callback: function(response, convo) {
                                    // stop the conversation. this will cause it to end with status == 'stopped'
                                    convo.stop();
                                }
                            },
                            {
                                default: true,
                                callback: function(response, convo) {
                                    convo.repeat();
                                    convo.next();
                                }
                            }
                        ]);
                        
                        convo.next();
                    }
    
                    convo.on('end', function(convo) {
                        if (convo.status == 'completed') {
    
                            controller.storage.teams.get(message.team, function(err, team) {
                                if (!team) {
                                    team = {
                                        id: message.team,
                                    };
                                }
                                var today = new Date();
                                if (!team.drafts || team.drafts.length == 0) {
                                    team.drafts = [{
                                        name: draftName,
                                        players: [],
                                        default: true,
                                        createdDate: today.getFullYear() + "/" + (today.getMonth() + 1) + "/" + today.getDate(),
                                        status: 
                                        {
                                            id: 0,
                                            name: "not started"
                                        },
                                        numExtraRares: 0,
                                        rareList: [],
                                        redraftPicks: []
                                    }];
                                } else {
                                    team.drafts.push(
                                    {
                                        name: draftName,
                                        players: [],
                                        default: false,
                                        createdDate: today.getFullYear() + "/" + (today.getMonth() + 1) + "/" + today.getDate(),
                                        status: 
                                        {
                                            id: 0,
                                            name: "not started"
                                        },
                                        numExtraRares: 0,
                                        rareList: [],
                                        redraftPicks: []
                                    });
                                }
                                controller.storage.teams.save(team, function(err, id) {
                                    controller.storage.users.all(function(err, allUserData) {
                                        var messageBody = getDraftListMessageBody(team.drafts, allUserData, 'Got it. Added new draft ' + team.drafts[team.drafts.length - 1].name + '.\n');
                                        bot.reply(message, messageBody);
                                    });
                                });
                            });
    
                        } else {
                            // this happens if the conversation ended prematurely for some reason
                            bot.reply(message, 'OK, nevermind!');
                        }
                    });
                }
            });
        });
    });
    
    controller.hears(['^new draft', '^add draft'], 'direct_message,direct_mention,mention', function(bot, message) {
        
        // make sure the default user mappings are present first
        storeDefaultUsers(controller, function(defaultUser) {
            controller.storage.users.get(defaultUser.id, function(err, user) {
                if (!user) {
                    user = {
                        id: defaultUser.id,
                        name: defaultUser.name
                    };
                    controller.storage.users.save(user, function(err, id) {
                        console.log('Saving default user with name ' + user.name + ' and id ' + user.id);
                    });
                }
            });
        });

        controller.storage.teams.get(message.team, function(err, team) {
            bot.startConversation(message, function(err, convo) {
                if (!err) {
                    convo.say('Alright, lets start a new draft...');
    
                    convo.ask(':robot_face:What would you like to call it?', function(response, convo) {
                        convo.ask(':robot_face:You want me to create a new draft called `' + response.text + '`?', [
                            {
                                pattern: 'yes',
                                callback: function(response, convo) {
                                    // since no further messages are queued after this,
                                    // the conversation will end naturally with status == 'completed'
                                    convo.next();
                                }
                            },
                            {
                                pattern: 'no',
                                callback: function(response, convo) {
                                    // stop the conversation. this will cause it to end with status == 'stopped'
                                    convo.stop();
                                }
                            },
                            {
                                default: true,
                                callback: function(response, convo) {
                                    convo.repeat();
                                    convo.next();
                                }
                            }
                        ]);
    
                        convo.next();
    
                    }, {'key': 'draftname'}); // store the results in a field called draftname
    
                    convo.on('end', function(convo) {
                        if (convo.status == 'completed') {
    
                            controller.storage.teams.get(message.team, function(err, team) {
                                if (!team) {
                                    team = {
                                        id: message.team,
                                    };
                                }
                                var today = new Date();
                                if (!team.drafts || team.drafts.length == 0) {
                                    team.drafts = [{
                                        name: convo.extractResponse('draftname'),
                                        players: [],
                                        default: true,
                                        createdDate: today.getFullYear() + "/" + (today.getMonth() + 1) + "/" + today.getDate(),
                                        status: 
                                        {
                                            id: 0,
                                            name: "not started"
                                        },
                                        numExtraRares: 0,
                                        rareList: [],
                                        redraftPicks: []
                                    }];
                                } else {
                                    team.drafts.push(
                                    {
                                        name: convo.extractResponse('draftname'),
                                        players: [],
                                        default: false,
                                        createdDate: today.getFullYear() + "/" + (today.getMonth() + 1) + "/" + today.getDate(),
                                        status: 
                                        {
                                            id: 0,
                                            name: "not started"
                                        },
                                        numExtraRares: 0,
                                        rareList: [],
                                        redraftPicks: []
                                    });
                                }
                                controller.storage.teams.save(team, function(err, id) {
                                    controller.storage.users.all(function(err, allUserData) {
                                        var messageBody = getDraftListMessageBody(team.drafts, allUserData, 'Got it. Added new draft ' + team.drafts[team.drafts.length - 1].name + '.\n');
                                        bot.reply(message, messageBody);
                                    });
                                });
                            });
                        } else {
                            // this happens if the conversation ended prematurely for some reason
                            bot.reply(message, 'OK, nevermind!');
                        }
                    });
                }
            });
        });
    });

    controller.hears(['^list my rares', '^my rares', '^show my rares'], 'direct_message,direct_mention,mention', function(bot, message) {
        
        controller.storage.teams.get(message.team, function(err, team) {
        
            if (team && team.drafts && team.drafts.length > 0) {
        
                var draftID = getDefaultDraftID(team);
                
                if (draftID == -1) {
                    bot.reply(message, "Something went wrong - couldn't find a default draft - consult tech support!");
                    return;
                }
                
                if (!isUserIDInDraft(message.user, team.drafts[draftID])) {
                    bot.reply(message, ':x: Error: <@' + message.user + '>, you are not in my list of saved players for the default draft so I cannot add drafted rares for you.  Use the `add me` command to register yourself, or the `add on behalf of` command to add rares for someone else.');
                } else {
                    bot.reply(message, displayRaresForPlayer(team, message.user));
                }
            }
        });
    });

    controller.hears(['^list rare', '^get rare'], 'direct_message,direct_mention,mention', function(bot, message) {
        
        controller.storage.teams.get(message.team, function(err, team) {
            controller.storage.users.all(function(err, allUserData) {
                if (team && team.drafts && team.drafts.length > 0) {
                    var draftID = getDefaultDraftID(team);
                    var draftObj = team.drafts[draftID];

                    // reload prices for rares
                    for (var j = 0; j < draftObj.rareList.length; j++) {
                        var rareInfo = draftObj.rareList[j];
                        var isFoil = false;
                        if (rareInfo.isFoil) {
                            isFoil = true;
                        }

                        // take this opportunity to reload the buy and sell price
                        loadCardPrices(team, controller, draftID, unDecorateCardName(rareInfo.cardName), isFoil);
                    }
                    
                    if (draftObj.status.id == 2) {
                        // also reload prices for redrafts
                        for (var j = 0; j < draftObj.redraftPicks.length; j++) {
                            var redraftInfo = draftObj.redraftPicks[j];
                            var isFoil = false;
                            if (redraftInfo.isFoil) {
                                isFoil = true;
                            }
                
                            // take this opportunity to reload the buy and sell price
                            loadCardPrices(team, controller, draftID, unDecorateCardName(redraftInfo.cardName), isFoil);
                        }
                        
                        var messageBody = getRedraftListMessageBody(draftObj, allUserData, "Here are the rares I have for the default draft (sorted by buy price descending): \n");
                        bot.reply(message, messageBody);
                    } else {
                        var messageBody = getRareListMessageBody(draftObj, allUserData, "Here are the rares I have for the default draft (sorted by buy price descending): \n");
                        bot.reply(message, messageBody);
                    }
                } else {
                    bot.reply(message, "No drafts stored, no rares to list!");
                }
            });   
        });
    });
    
    controller.hears(['^list other rares', '^get rare'], 'direct_message,direct_mention,mention', function(bot, message) {
        
        controller.storage.teams.get(message.team, function(err, team) {
            controller.storage.users.all(function(err, allUserData) {
                if (team && team.drafts && team.drafts.length > 0) {
                    
                    bot.startConversation(message, function(err, convo) {
                        if (!err) {
                            var messageBody = getDraftListMessageBody(team.drafts, allUserData, "Here are the drafts I have saved (default draft is in green):");
                            convo.say(messageBody);
                            convo = pickDraftNumberFromConversation(team, convo, '\n:robot_face:For which number draft would you like to list rares? (Or \'q\' to quit)');
            
                            convo.on('end', function(convo) {
                                if (convo.status == 'completed') {

                                    var draftID = convo.extractResponse('draftID');
                            
                                    var draftObj = team.drafts[draftID];

                                    // reload prices for rares
                                    for (var j = 0; j < draftObj.rareList.length; j++) {
                                        var rareInfo = draftObj.rareList[j];
                                        var isFoil = false;
                                        if (rareInfo.isFoil) {
                                            isFoil = true;
                                        }

                                        // take this opportunity to reload the buy and sell price
                                        loadCardPrices(team, controller, draftID, unDecorateCardName(rareInfo.cardName), isFoil);
                                    }
                                    
                                    if (draftObj.status.id == 2) {
                                        // also reload prices for redrafts
                                        for (var j = 0; j < draftObj.redraftPicks.length; j++) {
                                            var redraftInfo = draftObj.redraftPicks[j];
                                            var isFoil = false;
                                            if (redraftInfo.isFoil) {
                                                isFoil = true;
                                            }
                                
                                            // take this opportunity to reload the buy and sell price
                                            loadCardPrices(team, controller, draftID, unDecorateCardName(redraftInfo.cardName), isFoil);
                                        }
                                        
                                        var messageBody = getRedraftListMessageBody(draftObj, allUserData, "Here are the rares I have for the specified draft (sorted by buy price descending): \n");
                                        bot.reply(message, messageBody);
                                    } else {
                                        var messageBody = getRareListMessageBody(draftObj, allUserData, "Here are the rares I have for the specified draft (sorted by buy price descending): \n");
                                        bot.reply(message, messageBody);
                                    }
                                } else {
                                    // this happens if the conversation ended prematurely for some reason
                                    bot.reply(message, 'OK, nevermind!');
                                }
                            });
                        }
                    });
                } else {
                    bot.reply(message, "No drafts stored, no rares to list!");
                }
            });   
        });
    });

    controller.hears(['^list player', '^get player'], 'direct_message,direct_mention,mention', function(bot, message) {
        
        controller.storage.teams.get(message.team, function(err, team) {

            if (team && team.drafts && team.drafts.length > 0) {
                var draftID = getDefaultDraftID(team);
                controller.storage.users.all(function(err, allUserData) {
                    var messageBody = getPlayerListMessageBody(team.drafts[draftID], allUserData, "Here are the players (and associated rares) I have for the default draft: \n");
                    bot.reply(message, messageBody);
                }); 
                
            } else {
                bot.reply(message, "No drafts stored, no players to list!");
            }
        });
    }); 
    
    controller.hears(['^list draft', '^list', '^get draft'], 'direct_message,direct_mention,mention', function(bot, message) {
        controller.storage.teams.get(message.team, function(err, team) {
            controller.storage.users.all(function(err, allUserData) {
                var messageBody = getDraftListMessageBody(team.drafts, allUserData, "Here are the drafts I have saved (default draft is in green):");
                bot.reply(message, messageBody);
            });            
        });
    });

    controller.hears(['standing'], 'direct_message,direct_mention,mention', function(bot, message) {
        controller.storage.teams.get(message.team, function(err, team) {
            controller.storage.users.all(function(err, allUserData) {
                var draftID = getDefaultDraftID(team);
                if (team && team.drafts && team.drafts[draftID]) {
                    var messageBody = getStandingsMessageBody(team.drafts[draftID], allUserData, message.user);
                    bot.reply(message, messageBody);
                } else {
                    bot.reply(message, ":x:No default draft, no standings to show!");
                }
            });            
        });
    });
 
    controller.hears(['^matches left'], 'direct_message,direct_mention,mention', function(bot, message) {
        controller.storage.teams.get(message.team, function(err, team) {
            controller.storage.users.all(function(err, allUserData) {
                var draftID = getDefaultDraftID(team);
                if (team && team.drafts && team.drafts[draftID]) {
                    var messageBody = getMatchesLeftMessageBody(team.drafts[draftID], allUserData, message.user);
                    bot.reply(message, messageBody);
                } else {
                    bot.reply(message, ":x:No default draft, no matches to show!");
                }
            });            
        });
    });
    
    controller.hears(['^set default draft', '^choose default', '^set default'], 'direct_message,direct_mention,mention', function(bot, message) {
        
        controller.storage.teams.get(message.team, function(err, team) {
    
            if (team && team.drafts && team.drafts.length > 0) {
    
                bot.startConversation(message, function(err, convo) {
                    if (!err) {
                        convo.say('Alright, lets pick a new default draft...\n');
                        
                        controller.storage.users.all(function(err, allUserData) {
                            var messageBody = getDraftListMessageBody(team.drafts, allUserData, "Here are the drafts I have saved (default draft is in green):");
                            convo.say(messageBody);
                            convo = pickDraftNumberFromConversation(team, convo, '\n:robot_face:Which number draft would you like to set as the new default? (Or \'q\' to quit)');
                        }); 
    
                        convo.on('end', function(convo) {
                            if (convo.status == 'completed') {
    
                                var draftID = convo.extractResponse('draftID');
    
                                controller.storage.teams.get(message.team, function(err, team) {
                                    if (!team) {
                                        team = {
                                            id: message.team,
                                        };
                                    }
                                    
                                    for (var i = 0; i < team.drafts.length; i++) {
                                        if (i == draftID) {
                                            team.drafts[i].default = true;
                                        } else {
                                            team.drafts[i].default = false;
                                        }
                                    }
                                    
                                    controller.storage.teams.save(team, function(err, id) {
                                        controller.storage.users.all(function(err, allUserData) {
                                            var messageBody = getDraftListMessageBody(team.drafts, allUserData, "Got it. Set the specified draft as the default draft.\n");
                                            bot.reply(message, messageBody);
                                        }); 
                                    });
                                });
    
                            } else {
                                // this happens if the conversation ended prematurely for some reason
                                bot.reply(message, 'OK, nevermind!');
                            }
                        });
                    }
                });
            } else {
                bot.reply(message, "No drafts stored, can't set default draft!");
            }
        });
    });
    
    controller.hears(['^set extra rare', '^add extra rare'], 'direct_message,direct_mention,mention', function(bot, message) {
        
        controller.storage.teams.get(message.team, function(err, team) {
            
            if (team && team.drafts && team.drafts.length > 0) {
                var draftID = getDefaultDraftID(team);
    
                if (team.drafts[draftID] && team.drafts[draftID].players && team.drafts[draftID].players.length > 0) {
    
                    bot.startConversation(message, function(err, convo) {
                        if (!err) {
    
                            convo.ask(':robot_face:Enter the number of additional total rares in the draft (usually foils) above and beyond the baseline total of (# of players) * 3 = `' + team.drafts[draftID].players.length * 3 + '` packs (or hit \'q\' to quit)', function(response, convo) {
    
                                var rareNum = response.text;
                                
                                if (rareNum.toLowerCase() == 'q') {
                                    // stop the conversation. this will cause it to end with status == 'stopped'
                                    convo.stop();
                                }
                                else if(isNaN(Number(rareNum))) {
                                    convo.say('Please enter a number...');
                                    convo.repeat();
                                    convo.next();
                                }
                                else {
                                    // since no further messages are queued after this,
                                    // the conversation will end naturally with status == 'completed'
                                    convo.next();
                                }
                            }, {'key': 'numExtraRares'}); // store the results in a field called numExtraRares
    
                            convo.on('end', function(convo) {
                                if (convo.status == 'completed') {
        
                                    var numExtraRares = convo.extractResponse('numExtraRares');
        
                                    controller.storage.teams.get(message.team, function(err, team) {
                                        if (!team) {
                                            team = {
                                                id: message.team,
                                            };
                                        }
    
                                        team.drafts[draftID].numExtraRares = numExtraRares;
                                        
                                        controller.storage.teams.save(team, function(err, id) {
                                            controller.storage.users.all(function(err, allUserData) {
                                                var messageBody = getDraftListMessageBody(team.drafts, allUserData, "Got it. Set the number of extra rares for the default draft.\n");
                                                bot.reply(message, messageBody);
                                            });
                                        });
                                    });
        
                                } else {
                                    // this happens if the conversation ended prematurely for some reason
                                    bot.reply(message, 'OK, nevermind!');
                                }
                            });
                        }
                    });
                } else {
                    bot.reply(message, "Selected draft has no players, can't add extra rares!");
                }
            } else {
                bot.reply(message, "No drafts have been added, can't add extra rares!");
            }
        });
    });

    controller.hears(['^set expansion', '^pick expansion', '^choose set'], 'direct_message,direct_mention,mention', function(bot, message) {
        
        controller.storage.teams.get(message.team, function(err, team) {
            
            if (team && team.drafts && team.drafts.length > 0) {
                var draftID = getDefaultDraftID(team);
    
                if (team.drafts[draftID]) {
    
                    bot.startConversation(message, function(err, convo) {
                        if (!err) {
    
                            convo.ask(':robot_face:Choose an expansion (or *semicolon delimited* list of expansions) for the default draft. (or hit \'q\' to quit)', function(response, convo) {

                                /// PICK UP HERE
                                
                                var rareNum = response.text;
                                
                                if (rareNum.toLowerCase() == 'q') {
                                    // stop the conversation. this will cause it to end with status == 'stopped'
                                    convo.stop();
                                }
                                else if(isNaN(Number(rareNum))) {
                                    convo.say('Please enter a number...');
                                    convo.repeat();
                                    convo.next();
                                }
                                else {
                                    // since no further messages are queued after this,
                                    // the conversation will end naturally with status == 'completed'
                                    convo.next();
                                }
                            }, {'key': 'numExtraRares'}); // store the results in a field called numExtraRares
    
                            convo.on('end', function(convo) {
                                if (convo.status == 'completed') {
        
                                    var numExtraRares = convo.extractResponse('numExtraRares');
        
                                    controller.storage.teams.get(message.team, function(err, team) {
                                        if (!team) {
                                            team = {
                                                id: message.team,
                                            };
                                        }
    
                                        team.drafts[draftID].numExtraRares = numExtraRares;
                                        
                                        controller.storage.teams.save(team, function(err, id) {
                                            controller.storage.users.all(function(err, allUserData) {
                                                var messageBody = getDraftListMessageBody(team.drafts, allUserData, "Got it. Set the number of extra rares for the default draft.\n");
                                                bot.reply(message, messageBody);
                                            });
                                        });
                                    });
        
                                } else {
                                    // this happens if the conversation ended prematurely for some reason
                                    bot.reply(message, 'OK, nevermind!');
                                }
                            });
                        }
                    });
                } else {
                    bot.reply(message, "Selected draft has no players, can't add extra rares!");
                }
            } else {
                bot.reply(message, "No drafts have been added, can't add extra rares!");
            }
        });
    });
        
    controller.hears(['^set draft status', '^set status'], 'direct_message,direct_mention,mention', function(bot, message) {
        
        //TODO: add checks that prevent status changes unless preconditions are met (e.g. all expected rares entered before moving to redraft phase)

        controller.storage.teams.get(message.team, function(err, team) {
    
            if (team && team.drafts && team.drafts.length > 0) {
    
                bot.startConversation(message, function(err, convo) {
                    if (!err) {
                        var draftID = getDefaultDraftID(team);
                        convo = pickDraftStatusFromList(convo, team.drafts[draftID].name);
    
                        convo.on('end', function(convo) {
                            if (convo.status == 'completed') {
    
                                var statusID = convo.extractResponse('statusID');
    
                                controller.storage.teams.get(message.team, function(err, team) {
                                    if (!team) {
                                        team = {
                                            id: message.team,
                                        };
                                    }

                                    var expectedRareCount = getExpectedRareCount(team.drafts[draftID]);     
                                    var enteredRareCount = getEnteredRareCount(team.drafts[draftID]);
                                    var isStatusChangeValid = false;

                                    if(statusID == team.drafts[draftID].status.id) {
                                        bot.reply(message, ':x: ERROR: Specified status is the same as current status, nothing to do!');
                                    } else if (!team.drafts[draftID].players || team.drafts[draftID].players.length == 0) {
                                        bot.reply(message, ':x: ERROR: Can\`t change draft status until you add players - use the `add players` command.');
                                    } else if (statusID == 2) {

                                        // need to run some checks before we can enter the redraft phase
                                        if(expectedRareCount != enteredRareCount || enteredRareCount == 0) {
                                            bot.reply(message, ':x: ERROR: Cannot change draft state to redraft phase - the entered rare count `' + enteredRareCount + '` and expected rare count `' + expectedRareCount + '` do not match.  You must either enter more rares using the `add rares` command or modify the "extra" rares (foils, etc) using the `set extra rares` command');
                                        } else if (!playerListHasValidRanks(team)) {
                                            bot.reply(message, ':x: ERROR: Cannot change draft state to redraft phase - you must first enter a set of valid draft ranks (i.e. the final draft standings) using the `add ranking` command');
                                        } else {
                                            isStatusChangeValid = true;
                                        }
                                    } else {
                                        isStatusChangeValid = true;
                                    }

                                    if (isStatusChangeValid) {

                                        // either we're setting a status that doesn't need checks, or we passed all the checks

                                        team.drafts[draftID].status = 
                                        {
                                            id: statusID,
                                            name: getDraftStatusByID(statusID)
                                        };

                                        // redraft state gets reset any time the draft changes state (may need a warning?)
                                        team.drafts[draftID].redraftPickNumber = 0;
                                        resetRedraftList(team, draftID, controller);
                                        
                                        controller.storage.teams.save(team, function(err, id) {
                                            if (statusID == 2) {
                                                bot.reply(message, "Alright gang... starting the rare redraft!\n" + getRareRedraftMessage(team.drafts[draftID]));
                                            } else {
                                                bot.reply(message, "Got it. Changed the draft status as specified.");
                                            }
                                        });
                                    }
                                });
    
                            } else {
                                // this happens if the conversation ended prematurely for some reason
                                bot.reply(message, 'OK, nevermind!');
                            }
                        });
                    }
                });
            } else {
                bot.reply(message, "No drafts stored, nothing to do!");
            }
        });
    });
    
    controller.hears(['^delete draft', '^remove draft'], 'direct_message,direct_mention,mention', function(bot, message) {
        
        controller.storage.teams.get(message.team, function(err, team) {
    
            if (team && team.drafts && team.drafts.length > 0) {
    
                bot.startConversation(message, function(err, convo) {
                    if (!err) {
                        convo.say('Alright, lets clean things up...\n');
                        controller.storage.users.all(function(err, allUserData) {
                            var messageBody = getDraftListMessageBody(team.drafts, allUserData, "Here are the drafts I have saved (default draft is in green):");
                            convo.say(messageBody);
                            convo = pickDraftNumberFromConversation(team, convo, '\n:robot_face:Which number draft would you like to remove? (Or \'q\' to quit)');
                        });
    
                        convo.on('end', function(convo) {
                            if (convo.status == 'completed') {
    
                                var draftID = convo.extractResponse('draftID');
    
                                controller.storage.teams.get(message.team, function(err, team) {
                                    if (!team) {
                                        team = {
                                            id: message.team,
                                        };
                                    }
    
                                    var pickNewDefault = false;
                                    
                                    // check whether we're deleting the default draft
                                    if (team.drafts[draftID].default) {
                                        pickNewDefault = true;
                                    }
    
                                    team.drafts.splice(draftID, 1);
    
                                    // if there's at least one draft left and we're deleting the default draft, set the first one as the default (otherwise don't need to do anything since we have no drafts)
                                    if (team.drafts.length > 0  && pickNewDefault) {
                                        team.drafts[0].default = true;
                                    }
                                    
                                    controller.storage.teams.save(team, function(err, id) {
                                        controller.storage.users.all(function(err, allUserData) {
                                            var messageBody = getDraftListMessageBody(team.drafts, allUserData, "Got it. Deleted the specified draft.\n");
                                            bot.reply(message, messageBody);
                                        });
                                    });
                                });
    
                            } else {
                                // this happens if the conversation ended prematurely for some reason
                                bot.reply(message, 'OK, nevermind!');
                            }
                        });
                    }
                });
            } else {
                bot.reply(message, "No drafts stored, nothing to delete!");
            }
        });
    });

    controller.hears(['^add me'], 'direct_message,direct_mention,mention', function(bot, message) {
        
        var playerList;

        getNickNameFromConvo(controller, message, function(userID) {

            controller.storage.teams.get(message.team, function(err, team) {
                if (!team) {
                    team = {
                        id: message.team,
                    };
                }
                playerList = [{
                    id: message.user
                }];
                var draftID = getDefaultDraftID(team);
                var playersAdded = addUniquePlayers(team, controller, draftID, playerList);

                if (playersAdded == 0) {
                    bot.reply(message, 'You\'re already in the default draft!');
                } else {            
                    controller.storage.teams.save(team, function(err, id) {
                        bot.reply(message, 'Got it. Added you to the default draft, welcome aboard!\n');
                    });
                }
            });
        });              
    });

    controller.hears(['^add player (.*)', '^new player (.*)', '^add players (.*)', '^new players (.*)', '^add player', '^new player', '^add players', '^new players'], 'direct_message,direct_mention,mention', function(bot, message) {
        
        var playerResponse = message.match[1];
    
        controller.storage.teams.get(message.team, function(err, team) {
            controller.storage.users.all(function(err, allUserData) {
            
                if (team && team.drafts && team.drafts.length > 0) {
        
                    var draftID = getDefaultDraftID(team);
                    
                    if (draftID == -1) {
                        bot.reply(message, "Something went wrong - couldn't find a default draft - consult tech support!");
                        return;
                    }
        
                    var playerList = [];
                    var playerArray = [];
                    
                    if (!playerResponse) {

                        // start a new conversation 
                        bot.startConversation(message, function(err, convo) {
                            if (!err) {
                                convo.say('Alright, lets add some players...\n');
                                
                                var draftStatus = team.drafts[draftID].status;
                                    
                                if (Number(draftStatus.id) == 2) {
                                    convo.say(':x: Error: cannot add players to a draft with status `' + draftStatus.name + '`, use the `set status` command to change status of the default draft or the `set default` command to pick a different draft.');
                                }
                                else {

                                    convo.ask(':robot_face:Enter a player name to be added or a comma-separated list of player names to be added (or \'q\' to quit)', function(response, convo) {
                                        playerResponse = response.text;
                                        
                                        if (playerResponse.toLowerCase() == 'q') {
                                            // stop the conversation. this will cause it to end with status == 'stopped'
                                            convo.stop();
                                        }
                                        else {
                                            playerArray = playerResponse.split(',');

                                            // since no further messages are queued after this,
                                            // the conversation will end naturally with status == 'completed'
                                            convo.next();
                                        }
                                    }, {'key': 'playerList'}); // store the results in a field called playerList

                                    convo.on('end', function(convo) {
                                        if (convo.status == 'completed') {
                                            if (playerArray.length == 1 && playerArray[0] == "$defaultcrew$") {
                                                playerList = createDefaultPlayerList(message.channel);
                                            } else {
                                                playerList = createPlayerList(playerArray, allUserData);
                                            }
                                                            
                                            var playersAdded = addUniquePlayers(team, controller, draftID, playerList);
                                            
                                            controller.storage.teams.save(team, function(err, id) {
                                                var messageBody = getDraftListMessageBody(team.drafts, allUserData, 'Got it. Added `' + playersAdded + '` players out of the specified `' + playerList.length + '` player(s) (delta is due to removing duplicates).\n');
                                                bot.reply(message, messageBody);
                                            });
                                        } else {
                                            // this happens if the conversation ended prematurely for some reason
                                            bot.reply(message, 'OK, nevermind!');
                                        }
                                    });
                                }
                            }
                        });
                    } else {
                        playerArray = playerResponse.split(',');
                    
                        if (playerArray.length == 1 && playerArray[0] == "$defaultcrew$") {
                            playerList = createDefaultPlayerList(message.channel);
                        } else {
                            playerList = createPlayerList(playerArray, allUserData);
                        }
                                        
                        var playersAdded = addUniquePlayers(team, controller, draftID, playerList);
                        
                        controller.storage.teams.save(team, function(err, id) {
                            var messageBody = getDraftListMessageBody(team.drafts, allUserData, 'Got it. Added `' + playersAdded + '` players out of the specified `' + playerList.length + '` player(s) (delta is due to removing duplicates).\n');
                            bot.reply(message, messageBody);
                        });
                    }
                } else {
                    bot.reply(message, "No drafts stored, nothing to delete!");
                }
            });
        });            
    });
        
    controller.hears(['^remove player (.*)', '^delete player (.*)', '^remove players (.*)', '^delete players (.*)'], 'direct_message,direct_mention,mention', function(bot, message) {
        
        var playerResponse = message.match[1];
    
        controller.storage.teams.get(message.team, function(err, team) {
            controller.storage.users.all(function(err, allUserData) {
            
                if (team && team.drafts && team.drafts.length > 0) {
                        
                    var draftID = getDefaultDraftID(team);
                    
                    if (draftID == -1) {
                        bot.reply(message, "Something went wrong - couldn't find a default draft - consult tech support!");
                        return;
                    }
        
                    if(!team.drafts[draftID].players || team.drafts[draftID].players.length == 0) {
                        bot.reply(message, "Selected draft has no players, nothing to do!");
                    } else {
        
                        // start a new conversation 
                        bot.startConversation(message, function(err, convo) {
                            if (!err) {
                                if(playerResponse) {
        
                                    var draftStatus = team.drafts[draftID].status;
        
                                    if (Number(draftStatus.id) == 2) {
                                        convo.say(':x: Error: cannot remove players from a draft with status `' + draftStatus.name + '`, use the `set status` command to change status of the default draft or the `set default` command to pick a different draft.');
                                    }
                                    else {
        
                                        var toRemovePlayerList = playerResponse.split(',');
        
                                        convo.ask(':robot_face:You want me to remove the following list of players `' + playerResponse + '` from default draft `' + team.drafts[draftID].name 
                                            + '`?  (If you want to remove players from a different draft, set a different default draft using the `set default` command)', [
                                            {
                                                pattern: 'yes',
                                                callback: function(response, convo) {
                                                    // since no further messages are queued after this,
                                                    // the conversation will end naturally with status == 'completed'
                                                    convo.next();
                                                }
                                            },
                                            {
                                                pattern: 'no',
                                                callback: function(response, convo) {
                                                    // stop the conversation. this will cause it to end with status == 'stopped'
                                                    convo.stop();
                                                }
                                            },
                                            {
                                                default: true,
                                                callback: function(response, convo) {
                                                    convo.repeat();
                                                    convo.next();
                                                }
                                            }
                                        ]);
                                        
                                        convo.next();
        
                                        convo.on('end', function(convo) {
                                            if (convo.status == 'completed') {
                                                deletePlayers(team, controller, message, allUserData, toRemovePlayerList);
                                            } else {
                                                // this happens if the conversation ended prematurely for some reason
                                                bot.reply(message, 'OK, nevermind!');
                                            }
                                        });
                                    }
                                }
                            }
                        });
                    }
                } else {
                    bot.reply(message, "No drafts stored, can't delete players!");
                }
            });
        });
    });
    
    controller.hears(['^remove player', '^delete player'], 'direct_message,direct_mention,mention', function(bot, message) {
        
        controller.storage.teams.get(message.team, function(err, team) {
            controller.storage.users.all(function(err, allUserData) {

                if (team && team.drafts && team.drafts.length > 0) {
                        
                    var draftID = getDefaultDraftID(team);
                    
                    if (draftID == -1) {
                        bot.reply(message, "Something went wrong - couldn't find a default draft - consult tech support!");
                        return;
                    }
        
                    var toRemovePlayerList = [];
        
                    if(!team.drafts[draftID].players || team.drafts[draftID].players.length == 0) {
                        bot.reply(message, "Selected draft has no players, nothing to do!");
                    } else {

                        var draftStatus = team.drafts[draftID].status;
                        if (Number(draftStatus) == 2) {
                            bot.reply(message, ':x: Error: cannot remove players from a draft with status `' + draftStatus.name + '`, use the `set status` command to change status of the default draft or the `set default` command to pick a different draft.');
                        } else {
        
                            // start a new conversation 
                            bot.startConversation(message, function(err, convo) {
                                if (!err) {
                                    
                                    var messageBody = getUserListConcise(team.drafts[draftID], allUserData);
                                    convo.say(messageBody);

                                    convo.say('Alright, lets remove some players...\n');
                                
                                    convo.say('\nI will be removing players from the default draft \'' + team.drafts[draftID].name 
                                        + '\'.  If you want to remove players from a different draft, set a different default draft using the `set default` command');
                
                                    convo.ask(':robot_face:Enter a player name to be removed or a comma-separated list of player names to be removed (or \'q\' to quit)', function(response, convo) {
                                        var playerResponse = response.text;
                                        
                                        if (playerResponse.toLowerCase() == 'q') {
                                            // stop the conversation. this will cause it to end with status == 'stopped'
                                            convo.stop();
                                        }
                                        else {
                                            toRemovePlayerList = playerResponse.split(',');
            
                                            // since no further messages are queued after this,
                                            // the conversation will end naturally with status == 'completed'
                                            convo.next();
                                        }
                                    }, {'key': 'playerList'}); // store the results in a field called playerList
        
                                    convo.on('end', function(convo) {
                                        if (convo.status == 'completed') {
                                            deletePlayers(team, controller, message, allUserData, toRemovePlayerList);
                                        } else {
                                            // this happens if the conversation ended prematurely for some reason
                                            bot.reply(message, 'OK, nevermind!');
                                        }
                                    });
                                }
                            });
                        }
                    }
                } else {
                    bot.reply(message, "No drafts stored, can't delete players!");
                }
            });
        });
    });

    controller.hears(['^add rare on behalf of (.*)', '^add rares on behalf of (.*)'], 'direct_message,direct_mention,mention', function(bot, message) {
        
        var playerNameArg = message.match[1];

        controller.storage.teams.get(message.team, function(err, team) {
            controller.storage.users.all(function(err, allUserData) {

                if (team && team.drafts && team.drafts.length > 0) {

                    var draftID = getDefaultDraftID(team);
                    
                    if (draftID == -1) {
                        bot.reply(message, "Something went wrong - couldn't find a default draft - consult tech support!");
                        return;
                    }

                    var draftStatus = team.drafts[draftID].status;
                    
                    if (Number(draftStatus.id) == 2) {
                        bot.reply(message, ':x: Error: cannot add drafted rares to a draft with status `' + getDraftStatusByID(2) + '`, use the `set status` command to change status of the default draft or the `set default` command to pick a different draft.');
                    } else {
                    
                        bot.startConversation(message, function(err, convo) {
                            if (!err) {
                                var playerID = "";
                                if (playerNameArg) {
                                    if(!playerFound(playerNameArg, team.drafts[draftID], allUserData))
                                    {
                                        bot.reply(message, ':x: Error: specified player name is not in default draft!');
                                        convo.stop();
                                    } else {
                                        playerID = mapUserNametoUserID(playerNameArg, allUserData, team.drafts[draftID].players);
                                        pickRaresFromConversation(team, convo, message, controller, playerID);
                                    }
                                } else {
                                    var messageBody = getUserListConcise(team.drafts[draftID], allUserData);
                                    convo.say(messageBody);
                                    
                                    convo = pickPlayerFromConversation(team, convo, allUserData, ':robot_face:Specify a player name from the above list for which you\'d like to add rares. (Or \'q\' to quit)');
                                
                                    convo.on('end', function(convo) {
                                        if (convo.status == 'completed') {

                                            var playerName = convo.extractResponse('playerName');
                                            playerID = mapUserNametoUserID(playerName, allUserData, team.drafts[draftID].players);

                                            var rareListToAdd = [];
                            
                                            // start a new conversation for the rares
                                            pickRaresFromConversation(team, convo, message, controller, playerID);                                    
                                            
                                        } else {
                                            // this happens if the conversation ended prematurely for some reason
                                            bot.reply(message, 'OK, nevermind!');
                                        }
                                    });
                                }
                            }
                        });
                    }
                } else {
                    bot.reply(message, "No drafts stored, can't enter rares!");
                }
            });
        });
    });

    controller.hears(['^add rare'], 'direct_message,direct_mention,mention', function(bot, message) {

        controller.storage.teams.get(message.team, function(err, team) {

            if (!messageArray[message.user]) {
                messageArray[message.user] = true;
                
                if (team && team.drafts && team.drafts.length > 0) {

                    var draftID = getDefaultDraftID(team);
                    
                    if (draftID == -1) {
                        bot.reply(message, "Something went wrong - couldn't find a default draft - consult tech support!");
                        return;
                    }

                    var draftStatus = team.drafts[draftID].status;
                    
                    if (Number(draftStatus.id) == 2) {
                        bot.reply(message, ':x: Error: cannot add drafted rares to a draft with status `' + getDraftStatusByID(2) + '`, use the `set status` command to change status of the default draft or the `set default` command to pick a different draft.');
                    } else if (!isUserIDInDraft(message.user, team.drafts[draftID])) {
                        bot.reply(message, ':x: Error: <@' + message.user + '>, you are not in my list of saved players for the default draft so I cannot add drafted rares for you.  Use the `add me` command to register yourself, or the `add on behalf of` command to add rares for someone else.');
                    } else {
                        // start a new conversation for the rares
                        bot.startConversation(message, function(err, convo) {
                            if (!err) {
                                convo.say('Alright <@' + message.user + '>, ready to add your rares. (Note: you should do this part in a DM if you\'d like to keep your rares a secret)');
                                pickRaresFromConversation(team, convo, message, controller, message.user);
                            }
                        });
                    }   
                } else {
                    bot.reply(message, "No drafts stored, can't enter rares!");
                }

                messageArray[message.user] = null;
            }
        });
    });

    controller.hears(['^delete rares', '^remove rares'], 'direct_message,direct_mention,mention', function(bot, message) {
        
        controller.storage.teams.get(message.team, function(err, team) {
            controller.storage.users.all(function(err, allUserData) {

                if (team && team.drafts && team.drafts.length > 0) {

                    var draftID = getDefaultDraftID(team);
                    
                    if (draftID == -1) {
                        bot.reply(message, "Something went wrong - couldn't find a default draft - consult tech support!");
                        return;
                    }

                    var draftStatus = team.drafts[draftID].status;
                    
                    if (Number(draftStatus.id) == 2) {
                        bot.reply(message, ':x: Error: cannot remove rares from a draft with status `' + getDraftStatusByID(2) + '`, use the `set status` command to change status of the default draft or the `set default` command to pick a different draft.');
                    } else {
                    
                        bot.startConversation(message, function(err, convo) {
                            if (!err) {
                                
                                var messageBody = getUserListConcise(team.drafts[draftID], allUserData);
                                convo.say(messageBody);
                                
                                convo = pickPlayerFromConversation(team, convo, allUserData, ':robot_face:Specify a player name from the above list for which you\'d like to remove all drafted rares. (Or \'q\' to quit)');
                            
                                convo.on('end', function(convo) {
                                    if (convo.status == 'completed') {

                                        var playerName = convo.extractResponse('playerName');
                                        var playerID = mapUserNametoUserID(playerName, allUserData, team.drafts[draftID].players);
                                        // assert: playerID is valid because above pickPlayerFromConversation ensures it is

                                        var rareList = [];
                        
                                        // start a new conversation to confirm the rares to remove
                                        bot.startConversation(message, function(err, convo) {
                                            if (!err) {
                                                convo.ask(':robot_face:Alright, ready to remove all drafted rares for ' + playerName + '... Can you confirm you want to do this? (yes/no)', [
                                                    {
                                                        pattern: 'yes',
                                                        callback: function(response, convo) {
                                                            // since no further messages are queued after this,
                                                            // the conversation will end naturally with status == 'completed'
                                                            convo.next();
                                                        }
                                                    },
                                                    {
                                                        pattern: 'no',
                                                        callback: function(response, convo) {
                                                            // stop the conversation. this will cause it to end with status == 'stopped'
                                                            convo.stop();
                                                        }
                                                    },
                                                    {
                                                        default: true,
                                                        callback: function(response, convo) {
                                                            convo.repeat();
                                                            convo.next();
                                                        }
                                                    }
                                                ]);
                                                convo.on('end', function(convo) {
                                                    if (convo.status == 'completed') {
                            
                                                        var raresToDelete = getRaresForPlayer(team.drafts[draftID], playerID, allUserData);
                                                        if (!team.drafts[draftID].rareList || team.drafts[draftID].rareList.length == 0 || raresToDelete.length == 0) {
                                                            bot.reply(message, 'Selected player doesn\'t have any drafted rares entered, nothing to do!');
                                                        } else {

                                                            deleteRaresForPlayer(team.drafts[draftID], playerID);

                                                            controller.storage.teams.save(team, function(err, id) {
                                                                bot.reply(message, "Got it, rares deleted!  Use `add rares` command to add more");
                                                            });

                                                        }
                                                    } else {
                                                        // this happens if the conversation ended prematurely for some reason
                                                        bot.reply(message, 'OK, nevermind!');
                                                    }
                                                });
                                            }
                                        });
                                    } else {
                                        // this happens if the conversation ended prematurely for some reason
                                        bot.reply(message, 'OK, nevermind!');
                                    }
                                });
                            }
                        });
                    }
                } else {
                    bot.reply(message, "No drafts stored, can't remove rares!");
                }
            }); 
        });
    });    

    controller.hears(['^add result on behalf of (.*)'], 'direct_message,direct_mention,mention', function(bot, message) {
        
        var playerNameArg = message.match[1];

        controller.storage.teams.get(message.team, function(err, team) {
            controller.storage.users.all(function(err, allUserData) {

                if (team && team.drafts && team.drafts.length > 0) {

                    var draftID = getDefaultDraftID(team);
                    
                    if (draftID == -1) {
                        bot.reply(message, "Something went wrong - couldn't find a default draft - consult tech support!");
                        return;
                    }
                    var draftStatus = team.drafts[draftID].status;
                    
                    if (Number(draftStatus.id) != 1) {
                        bot.reply(message, ':x: Error: can only add match result rares to a draft with status `' + getDraftStatusByID(1) + '`, use the `set status` command to change status of the default draft.');
                    } else {
                        // NB: require an arg here just so the code isn't too fugly
                        var player1ID = "";
                        if (playerNameArg) {
                            if(!playerFound(playerNameArg, team.drafts[draftID], allUserData))
                            {
                                bot.reply(message, ':x: Error: specified player name is not in default draft!');
                            } else {
                                player1ID = mapUserNametoUserID(playerNameArg, allUserData, team.drafts[draftID].players);
                                
                                // now grab player 2
                                bot.startConversation(message, function(err, convo2) {
                                    if (!err) {
                                        var player2ID = "";
                                        var messageBody = getUserListConcise(team.drafts[draftID], allUserData);
                                        convo2.say(messageBody);
                                        
                                        convo2 = pickPlayerFromConversation(team, convo2, allUserData, ':robot_face:Who did <@' + player1ID + '> play against? (Or \'q\' to quit)');                                
    
                                        convo2.on('end', function(convo) {
                                            if (convo.status == 'completed') {
    
                                                var player2Name = convo.extractResponse('playerName');
                                                player2ID = mapUserNametoUserID(player2Name, allUserData, team.drafts[draftID].players);
        
                                                if (player1ID == player2ID) {
                                                    bot.reply(message, ":x:Can't have a match result where a player plays themselves!")
                                                } else {
                                                    enterMatchResultFromConversation(team, convo2, message, controller, player1ID, player2ID);
                                                }
                                            } else {
                                                // this happens if the conversation ended prematurely for some reason
                                                bot.reply(message, 'OK, nevermind!');
                                            }
                                        });
                                    }
                                });
                            }
                        } else {
                            bot.reply(message, "You must specify a player name (e.g. 'add result on behalf of <foo>'");
                        }
                    }
                } else {
                    bot.reply(message, "No drafts stored, can't enter match results!");
                }
            });
        });
    });

    controller.hears(['^add result', '^enter result', '^add match result', '^enter match result'], 'direct_message,direct_mention,mention', function(bot, message) {

        controller.storage.teams.get(message.team, function(err, team) {
            controller.storage.users.all(function(err, allUserData) {

                if (!messageArray[message.user]) {
                    messageArray[message.user] = true;
                
                    if (team && team.drafts && team.drafts.length > 0) {
            
                        var draftID = getDefaultDraftID(team);
                        
                        if (draftID == -1) {
                            bot.reply(message, "Something went wrong - couldn't find a default draft - consult tech support!");
                            return;
                        }
                        var draftStatus = team.drafts[draftID].status;

                        if (Number(draftStatus.id) != 1) {
                            bot.reply(message, ':x: Error: can only add match results to a draft with status `' + getDraftStatusByID(1) + '`, use the `set status` command to change status of the default draft or the `set default` command to pick a different draft.');
                        } else {

                            getNickNameFromConvo(controller, message, function(userName) {
                                bot.reply(message, 'Ok, <@' + userName + '>, ready to enter a match result.');

                                bot.startConversation(message, function(err, convo) {
                                
                                    var messageBody = getMatchesLeftListConcise(team.drafts[draftID], userName, allUserData);
                                    convo.say(messageBody);
                                
                                    convo = pickPlayerFromConversation(team, convo, allUserData, ':robot_face:Specify a player name from the above list that you played (Or \'q\' to quit)');

                                    convo.on('end', function(convo) {
                                        if (convo.status == 'completed') {

                                            var playerName = convo.extractResponse('playerName');
                                            var playerID = mapUserNametoUserID(playerName, allUserData, team.drafts[draftID].players);

                                            if (message.user == playerID) {
                                                bot.reply(message, ":x:Can't have a match result where a player plays themselves!")
                                            } else {
                                                enterMatchResultFromConversation(team, convo, message, controller, message.user, playerID);
                                            }

                                        } else {
                                            // this happens if the conversation ended prematurely for some reason
                                            bot.reply(message, 'OK, nevermind!');
                                        }
                                    });
                                });
                            });
                        }
                    }

                    messageArray[message.user] = null;
                }
            });
        });
    });

    controller.hears(['^reset redraft'], 'direct_message,direct_mention,mention', function(bot, message) {
        controller.storage.teams.get(message.team, function(err, team) {
            if (team && team.drafts && team.drafts.length > 0) {
                
                var draftID = getDefaultDraftID(team);
                
                if (draftID == -1) {
                    bot.reply(message, "Something went wrong - couldn't find a default draft - consult tech support!");
                    return;
                }

                var draftStatus = team.drafts[draftID].status;
                if (Number(draftStatus.id) != 2) {
                    bot.reply(message, ':x: Error: can only add reset redrafts for a draft with status `' + getDraftStatusByID(2) + '`, use the `set status` command to change status of the default draft or the `set default` command to pick a different draft.');
                } else {
                    bot.startConversation(message, function(err, convo) {
                        convo.ask('Are you sure you want to reset all progress on the current redraft?', [
                            {
                                pattern: 'yes',
                                callback: function(response, convo) {
                                    // since no further messages are queued after this,
                                    // the conversation will end naturally with status == 'completed'
                                    convo.next();
                                }
                            },
                            {
                                pattern: 'no',
                                callback: function(response, convo) {
                                    // stop the conversation. this will cause it to end with status == 'stopped'
                                    convo.stop();
                                }
                            },
                            {
                                default: true,
                                callback: function(response, convo) {
                                    convo.repeat();
                                    convo.next();
                                }
                            }
                        ]);

                        convo.on('end', function(convo) {
                            if (convo.status == 'completed') {

                                controller.storage.teams.get(message.team, function(err, team) {
                                    if (!team) {
                                        team = {
                                            id: message.team,
                                        };
                                    }

                                    var draftID = getDefaultDraftID(team);
                                    resetRedraftList(team, draftID, controller);
                                    team.drafts[draftID].redraftPickNumber = 0;
                                    team.drafts[draftID].redraftPicks = [];
                                    
                                    controller.storage.teams.save(team, function(err, id) {
                                        bot.reply(message, 'Got it. Reset redraft progress.\n');
                                    });
                                });

                            } else {
                                // this happens if the conversation ended prematurely for some reason
                                bot.reply(message, 'OK, nevermind!');
                            }
                        });
                    });
                }
            } else {
                bot.reply(message, "No drafts stored, nothing to do!");
            }
        });
    });
    
    controller.hears(['^redraft on behalf of (.*)'], 'direct_message,direct_mention,mention', function(bot, message) {
        
        var playerName = message.match[1];

        controller.storage.teams.get(message.team, function(err, team) {
            controller.storage.users.all(function(err, allUserData) {
                if (team && team.drafts && team.drafts.length > 0) {

                    var draftID = getDefaultDraftID(team);
                    
                    if (draftID == -1) {
                        bot.reply(message, "Something went wrong - couldn't find a default draft - consult tech support!");
                        return;
                    }

                    var draftStatus = team.drafts[draftID].status;
                    
                    if (Number(draftStatus.id) != 2) {
                        bot.reply(message, ':x: Error: can only make redraft picks from a draft with status `' + getDraftStatusByID(2) + '`, use the `set status` command to change status of the default draft or the `set default` command to pick a different draft.');
                    } else if (getExpectedRareCount(team.drafts[draftID]) == team.drafts[draftID].redraftPickNumber) {
                        bot.reply(message, ':robot_face: Nothing to do, redraft is complete!');
                    } else {
                        var playerNextID = getCurrentRedraftPlayerID(team.drafts[draftID]);
                        var playerNext = calculatePlayerName(playerNextID, allUserData).playerName;
                        if (playerName) {
                            if (playerName.toLowerCase().trim() != playerNext.toLowerCase().trim()) {
                                bot.reply(message, ':x: Error: it\'s not ' + playerName + '\'s turn to redraft, it\'s <@' + playerNextID + '>\'s turn!');
                            } else {
                                var messageBody = getRedraftListMessageBody(team.drafts[draftID], allUserData, "");
                                //bot.reply(message, messageBody);
                                bot.startConversation(message, function(err, convo) {
                                    if (!err) {
                                        convo.say(messageBody);
                                        pickRedraftFromConversation(team, convo, 'Pick a rare by its associated ID in the `Rares still to be redrafted` list above, or \'q\' to quit (reminder that it is <@' + getCurrentRedraftPlayerID(team.drafts[draftID]) + '>\'s pick next):', message, controller);
                                    }
                                });
                            }
                        } else {
                            bot.startConversation(message, function(err, convo) {
                                if (!err) {
                                    var messageBody = getRedraftListMessageBody(team.drafts[draftID], allUserData, "");
                                    convo.say({
                                        text: messageBody,
                                        unfurl_links: false
                                    });

                                    convo.say("Presuming that you're selecting redraft on behalf of " + playerNext + " since it's their turn, type 'q' if this isn't what you want");
                                    pickRedraftFromConversation(team, convo, 'Pick a rare by its associated ID in the `Rares still to be redrafted` list above, or \'q\' to quit (reminder that it is <@' + getCurrentRedraftPlayerID(team.drafts[draftID]) + '>\'s pick next):', message, controller);
                                }
                            });
                        }
                    }
                } else {
                    bot.reply(message, "No drafts stored, can't redraft rares!");
                }
            });
        });
    });

    controller.hears(['^redraft'], 'direct_message,direct_mention,mention', function(bot, message) {

        controller.storage.teams.get(message.team, function(err, team) {
            controller.storage.users.all(function(err, allUserData) {

                if (!messageArray[message.user]) {
                    messageArray[message.user] = true;
                    if (team && team.drafts && team.drafts.length > 0) {

                        var draftID = getDefaultDraftID(team);
                        
                        if (draftID == -1) {
                            bot.reply(message, "Something went wrong - couldn't find a default draft - consult tech support!");
                            return;
                        }

                        var draftStatus = team.drafts[draftID].status;
                        
                        if (Number(draftStatus.id) != 2) {
                            bot.reply(message, ':x: Error: can only pick redraft rares from a draft with status `' + getDraftStatusByID(2) + '`, use the `set status` command to change status of the default draft or the `set default` command to pick a different draft.');
                        } else if (getExpectedRareCount(team.drafts[draftID]) == team.drafts[draftID].redraftPickNumber) {
                            bot.reply(message, ':robot_face: Nothing to do, redraft is complete!');
                        } else if (getCurrentRedraftPlayerID(team.drafts[draftID]) != message.user) {
                            var nextPickPlayerID = getCurrentRedraftPlayerID(team.drafts[draftID]);
                            bot.reply(message, ':x: Error: it is not your current pick <@' + message.user + '>, it is <@' + nextPickPlayerID + '>\'s pick!  If you need to redraft rares on behalf of others, use the `redraft on behalf of <foo>` command.');
                        } else {
                            bot.startConversation(message, function(err, convo) {
                                if (!err) {
                                    var messageBody = getRedraftListMessageBody(team.drafts[draftID], allUserData, "");
                                    convo.say(messageBody);
                                    convo = pickRedraftFromConversation(team, convo, 'Pick a rare by its associated ID in the `Rares still to be redrafted` list above, or \'q\' to quit (reminder that it is <@' + getCurrentRedraftPlayerID(team.drafts[draftID]) + '>\'s pick next):', message, controller);
                                }                        
                            });
                        }
                    } else {
                        bot.reply(message, "No drafts stored, can't redraft rares!");
                    }
                    messageArray[message.user] = null;
                }                
            });
        });
    });        

    controller.hears(['^enter ranking', '^set ranking', '^add ranking'], 'direct_message,direct_mention,mention', function(bot, message) {
        
        controller.storage.teams.get(message.team, function(err, team) {
            controller.storage.users.all(function(err, allUserData) {

                if (team && team.drafts && team.drafts.length > 0) {

                    var draftID = getDefaultDraftID(team);
                    
                    if (draftID == -1) {
                        bot.reply(message, "Something went wrong - couldn't find a default draft - consult tech support!");
                        return;
                    }

                    var draftStatus = team.drafts[draftID].status;
                    
                    if (Number(draftStatus.id) != 1) {
                        bot.reply(message, ':x: Error: can only set ranking for a draft with status `' + getDraftStatusByID(1) + '`, use the `set status` command to change status of the default draft or the `set default` command to pick a different draft.');
                    } else if(!team.drafts[draftID].players || team.drafts[draftID].players.length == 0) {
                        bot.reply(message, ':x: Error: can only set ranking for a draft with players.  Use the `add players` command to add them.');
                    } else {
                    
                        bot.startConversation(message, function(err, convo) {
                            if (!err) {
                                var messageBody = getUserListConcise(team.drafts[draftID], allUserData);
                                convo.say(messageBody);
                                convo = pickRankingFromConversation(team, convo, controller, ':robot_face:Specify a comma-separated list of ranks in the order the names appear above - use `1` for `first place` up to `' + team.drafts[draftID].players.length + '` for `last place`. (Or \'q\' to quit)');
                            
                                convo.on('end', function(convo) {
                                    if (convo.status == 'completed') {

                                        var ranks = convo.extractResponse('rankingList');
                                        var rankingList = ranks.split(',');

                                        // add ranks in order to the players we have in stored order
                                        // NOTE: this will break if we ever display the players in a different order than they're stored
                                                
                                        for (var j = 0; j < team.drafts[draftID].players.length; j++) {
                                            team.drafts[draftID].players[j].rank = rankingList[j];
                                        }
                                                
                                        controller.storage.teams.save(team, function(err, id) {
                                            bot.reply(message, 'Got it. Stored the specified ' + rankingList.length + ' ranks for the default draft.\n');
                                        });
                                    } else {
                                        // this happens if the conversation ended prematurely for some reason
                                        bot.reply(message, 'OK, nevermind!');
                                    }
                                });
                            }
                        });
                    }
                } else {
                    bot.reply(message, "No drafts stored, can't enter ranking!");
                }
            });
        });
    });
}

/*****************************************/
/*      List display functions           */
/*****************************************/

function getDraftListMessageBody(draftArray, allUserData, textToDisplay)
{
    var messageBody = {
        text: textToDisplay,
        unfurl_links: false,
        unfurl_media: true
    };
    var attachments = [];
    if (draftArray && draftArray.length > 0) {
        
        for (var i = 0; i < draftArray.length; i++) {
            var defaultDraft = false;
            var draftName = draftArray[i].name;
            var fallbackText = "Draft details for draft: " + draftName;
            var color = "";

            if (draftArray[i].default) {
                defaultDraft = true;
                color = "#36a64f";
            } else {
                color = getColorFromIndex(i);
            }

            var playerListText = "";

            if (draftArray[i].players && draftArray[i].players.length > 0) {
                for(var j = 0; j < draftArray[i].players.length; j++) {
                    var curPlayerID = draftArray[i].players[j].id;
                    var playerData = calculatePlayerName(curPlayerID, allUserData);
                    draftArray[i].players[j].name = playerData.playerName;

                    playerListText += draftArray[i].players[j].name;
                    if (j < draftArray[i].players.length - 1) {
                        playerListText += ", ";
                    }
                }

            } else {
                playerListText += "none found";
            }

            var draftStatus = draftArray[i].status.name;
            var numRares = getExpectedRareCount(draftArray[i]);
            var numEnteredRares = getEnteredRareCount(draftArray[i]);
            var numExtraRares = getExtraRareCount(draftArray[i]);

            attachments.push({
                fallback: fallbackText,
                color: color,
                title: "Draft #" + i,
                fields: [
                    {
                        title: "Draft Name",
                        value: draftName,
                        short: true
                    },
                    {
                        title: "Player List",
                        value: playerListText,
                        short: true
                    },
                    {
                        title: "Is Default Draft?",
                        value: String(defaultDraft),
                        short: true
                    },
                    {
                        title: "Draft status",
                        value: draftStatus,
                        short: true
                    },
                    {
                        title: "Entered rares",
                        value: String(numEnteredRares),
                        short: true
                    },
                    {
                        title: "Expected rares",
                        value: numRares + " (" + numExtraRares + " extra rares)",
                        short: true
                    }
                ]
            });
        }

        messageBody.attachments = attachments;

    } else {
        messageBody.text = "I don't have any saved drafts, use the `new draft` command to start one.";
    }

    return messageBody;
}

function getPlayerListMessageBody(draftObj, allUserData, textToDisplay)
{
    var messageBody = {
        text: textToDisplay,
        unfurl_links: false,
        unfurl_media: true
    };
    var attachments = [];

    if (draftObj && draftObj.players && draftObj.players.length > 0) {

        var draftNameText = "\n*Draft Name*: `" + draftObj.name + '`\n';
        var expectedRaresForDraftText = "*Expected rares*: `" + getExpectedRareCount(draftObj) + ' (Extra rares: ' + getExtraRareCount(draftObj) + ')`\n';
        var enteredRaresText = "*Entered rares*: `" + getEnteredRareCount(draftObj) + "`\n";
        var draftStatus = "*Draft status*: `" + getDraftStatusByID(draftObj.status.id) + "`\n";
        var numPlayers = draftObj.players.length
        var expectedMatchNum = (numPlayers * (numPlayers - 1)) / 2;  // e.g. 5+4+3+2+1 = 15 = 6*5/2 for 6 players
        var matchesPlayed = draftObj.matchResults.length;
        var matchesLeft = expectedMatchNum - matchesPlayed;
        var matchesLeftStatus = "*Matches Left*: `" + matchesLeft + ((matchesLeft == 0) ? "` - Draft is complete!  <@" + draftObj.winningUserID + "> is the winner! :trophy:" : "`");

        messageBody.text += draftNameText;
        messageBody.text += expectedRaresForDraftText;
        messageBody.text += enteredRaresText;
        messageBody.text += draftStatus;
        messageBody.text += matchesLeftStatus;

        for (var j = 0; j < draftObj.players.length; j++) {
            // fetch the user name from the user object data collection (nickname, etc)
            var curPlayerID = draftObj.players[j].id;
            var playerData = calculatePlayerName(curPlayerID, allUserData);
            var playerName = playerData.playerName;
            var fallbackText = "Draft player data for " + playerName;
            var color = getColorFromIndex(j);
            var playerRank = (draftObj.players[j].rank) ? draftObj.players[j].rank : "Not defined";

            var rareListForPlayer = getRaresForPlayer(draftObj, curPlayerID, allUserData);
            var rareListText = "";
            
            if (rareListForPlayer.length > 0) {
                for (var k = 0; k < rareListForPlayer.length; k++) {
                    rareListText += decorateCardName(rareListForPlayer[k]);
                    if (k < rareListForPlayer.length - 1) {
                        rareListText += ", ";
                    }
                }
            } else {
                rareListText += 'none';
            }

            var redraftListForPlayer = getRedraftsForPlayer(draftObj, curPlayerID, allUserData);
            var redraftListText = "";
            
            if (redraftListForPlayer.length > 0) {
                for (var m = 0; m < redraftListForPlayer.length; m++) {
                    redraftListText += decorateCardName(redraftListForPlayer[m]);
                    if (m < redraftListForPlayer.length - 1) {
                        redraftListText += ", ";
                    }
                }
            } else {
                redraftListText += 'none';
            }

            attachments.push({
                fallback: fallbackText,
                color: color,
                //title: "Player: " + playerName + " (Rank: " + playerRank + ")",
                fields: [
                    {
                        title: "Player:",
                        value: playerName,
                        short: true
                    },
                    {
                        title: "Final Rank:",
                        value: playerRank,
                        short: true
                    },
                    {
                        title: "Rares drafted (" + rareListForPlayer.length + ")",
                        value: rareListText,
                        short: true
                    },
                    {
                        title: "Rares redrafted (" + redraftListForPlayer.length + ")",
                        value: redraftListText,
                        short: true
                    }
                ]
            });
        }

        messageBody.attachments = attachments;
    } else {
        messageBody.text = "Default draft doesn't have players, use the `add players` command to add them."
    }

    return messageBody;
}

function getRareListMessageBody(draftObj, allUserData, textToDisplay)
{
    var messageBody = {
        text: textToDisplay,
        unfurl_links: false,
        unfurl_media: true
    };
    var attachments = [];

    if (draftObj && draftObj.players && draftObj.players.length > 0) {
        
        var expectedRaresForDraftText = "\n*Expected rares*: " + getExpectedRareCount(draftObj) + ' (Extra rares: ' + getExtraRareCount(draftObj) + ')\n';
        var enteredRaresText = "*Entered rares*: " + getEnteredRareCount(draftObj) + "\n";
        var draftStatus = "*Draft status*: " + getDraftStatusByID(draftObj.status.id);

        messageBody.text += expectedRaresForDraftText;
        messageBody.text += enteredRaresText;
        messageBody.text += draftStatus;

        // resort the redrafted rare array descending by buy price
        var results = draftObj.rareList.sort(function(a,b) {
            if(a.buyPrice && b.buyPrice) {
                var num1 = Number(a.buyPrice.replace('$', ''));
                var num2 = Number(b.buyPrice.replace('$', ''));
                return num2 - num1;
            } else {
                return 0;
            }                    
        });

        for (var j = 0; j < draftObj.rareList.length; j++) {
            var curRareObj = draftObj.rareList[j];

            var playerData = calculatePlayerName(curRareObj.draftedPlayerID, allUserData);
            var playerName = playerData.playerName;
            var redraftPlayerData = calculatePlayerName(curRareObj.redraftedPlayerID, allUserData);
            // error is possible as rares may not be redrafted yet, so show blank if that's the case
            var redrafterName = (redraftPlayerData.error) ? "" : redraftPlayerData.playerName;
            var rareName = unDecorateCardName(curRareObj.cardName);
            var color = getColorFromIndex(j);
            var fallbackText = "Draft rare data for rare " + rareName;
            var buyPrice = decorateBuyPrice(curRareObj.buyPrice, rareName, curRareObj.isFoil);
            var sellPrice = decorateSellPrice(curRareObj.sellPrice, rareName);
            if (curRareObj.isFoil) {
                rareName += " (foil)";
            }
            rareName = decorateCardName(rareName);
            
            attachments.push({
                fallback: fallbackText,
                color: color,
                //title: "Rare name: " + rareName + " (Buy price: " + buyPrice + ", Sell price: " + sellPrice + ")",
                fields: [
                    {
                        value: rareName + " (Buy price: " + buyPrice + ", Sell price: " + sellPrice + ")",
                        short: false
                    },
                    {
                        value: "*Drafted by:* " + playerName,
                        short: true
                    },
                    {
                        value: "*Redrafted by:* " + redrafterName,
                        short: true
                    }
                ],
                mrkdwn_in: ["fields"]                
            });
        }

        messageBody.attachments = attachments;
    } else {
        messageBody.text = "Default draft doesn't have players (and therefore doesn't have rares), use the `add players` command then the `add rares` command to add them.";
    }

    return messageBody;
}

function getRedraftListMessageBody(draftObj, allUserData, textToDisplay)
{
    var messageBody = {
        text: textToDisplay,
        unfurl_links: false,
        unfurl_media: true
    };
    var attachments = [];

    if (draftObj && draftObj.players && draftObj.players.length > 0) {
        
        var expectedRaresForDraftText = "\n*Expected rares*: " + getExpectedRareCount(draftObj) + ' (Extra rares: ' + getExtraRareCount(draftObj) + ')\n';
        var enteredRaresText = "*Entered rares*: " + getEnteredRareCount(draftObj) + "\n";
        var draftStatus = "*Draft status*: " + getDraftStatusByID(draftObj.status.id);

        messageBody.text += expectedRaresForDraftText;
        messageBody.text += enteredRaresText;
        messageBody.text += draftStatus;

        var redraftColor = getColorFromIndex(0);
        var redraftFallbackTest = "Redraft data for draft " + draftObj.name;
        var redraftBody = "";

        for (var k = 0; k < draftObj.redraftPicks.length; k++) {
            var curRareObj = draftObj.redraftPicks[k];

            var playerData = calculatePlayerName(curRareObj.draftedPlayerID, allUserData);
            var playerName = playerData.playerName;
            var redraftPlayerData = calculatePlayerName(curRareObj.redraftedPlayerID, allUserData);
            // error is possible as rares may not be redrafted yet, so show blank if that's the case
            var redrafterName = (redraftPlayerData.error) ? "" : redraftPlayerData.playerName;
            var rareName = unDecorateCardName(curRareObj.cardName);
            if (curRareObj.isFoil) {
                rareName += " (foil)";
            }
            rareName = "*" + rareName + "*";
            redraftBody += rareName + " (drafted by " + playerName + ", redrafted by " + redrafterName + ")\n";
        }

        if (redraftBody == "") {
            redraftBody = "None so far";
        }

        attachments.push({
            fallback: redraftFallbackTest,
            color: redraftColor,
            fields: [
                {
                    title: "Cards redrafted so far (" + draftObj.redraftPicks.length + "):",
                    value: redraftBody,
                    short: false
                }
            ],
            mrkdwn_in: ["fields"]
        });
        
        attachments.push({
            fallback: "Cards still to be redrafted",
            color: getColorFromIndex(1),
            fields: [
                {
                    title: "Cards still to be redrafted (" + draftObj.rareList.length + "):",
                    value: "",
                    short: false
                }
            ]
        });

        // resort the "to be redrafted" rare array descending by buy price
        var results = draftObj.rareList.sort(function(a,b) {
            if(a.buyPrice && b.buyPrice) {
                var num1 = Number(a.buyPrice.replace('$', ''));
                var num2 = Number(b.buyPrice.replace('$', ''));
                return num2 - num1;
            } else {
                return 0;
            }                    
        });

        for (var j = 0; j < draftObj.rareList.length; j++) {
            var curRareObj = draftObj.rareList[j];

            var playerData = calculatePlayerName(curRareObj.draftedPlayerID, allUserData);
            var playerName = playerData.playerName;
            var redraftPlayerData = calculatePlayerName(curRareObj.redraftedPlayerID, allUserData);
            // error is possible as rares may not be redrafted yet, so show blank if that's the case
            var redrafterName = (redraftPlayerData.error) ? "" : redraftPlayerData.playerName;
            var rareName = unDecorateCardName(curRareObj.cardName);
            var color = getColorFromIndex(j + 2);   // +2 because we have an additional two attachments at the beginning
            var fallbackText = "Draft rare data for rare " + unDecorateCardName(rareName);
            var buyPrice = decorateBuyPrice(curRareObj.buyPrice, rareName, curRareObj.isFoil);
            var sellPrice = decorateSellPrice(curRareObj.sellPrice, rareName);
            if (curRareObj.isFoil) {
                rareName += " (foil)";
            }
            rareName = decorateCardName(rareName);
            
            attachments.push({
                fallback: fallbackText,
                color: color,
                title: (j + 1) + ": " + rareName + " (Buy price: " + buyPrice + ", Sell price: " + sellPrice + ")",
                fields: [
                    {
                        value: "*Drafted by:* " + playerName,
                        short: true
                    },
                    {
                        value: "*Redrafted by:* " + redrafterName,
                        short: true
                    }
                ],
                mrkdwn_in: ["fields", "title"]
            });
        }

        messageBody.attachments = attachments;
    } else {
        messageBody.text = "Default draft doesn't have players (and therefore doesn't have rares), use the `add players` command then the `add rares` command to add them.";
    }

    return messageBody;
}

function getStandingsMessageBody(draftObj, allUserData, curUserID)
{
    var messageBody = {
        text: "",
        unfurl_links: false,
        unfurl_media: false
    };
    var attachments = [];

    if (draftObj && draftObj.players && draftObj.players.length > 0 && draftObj.matchResults && draftObj.matchResults.length > 0) {
        
        var numPlayers = draftObj.players.length
        var expectedMatchNum = (numPlayers * (numPlayers - 1)) / 2;  // e.g. 5+4+3+2+1 = 15 = 6*5/2 for 6 players
        var matchesPlayed = draftObj.matchResults.length;
        var matchesLeft = expectedMatchNum - draftObj.matchResults.length;

        messageBody.text += '\n*Expected matches total*: ' + expectedMatchNum + '\n';
        messageBody.text += '*Matches played*: ' + matchesPlayed + '\n';
        
        var matchesLeftBody = "";

        if (matchesLeft <= numPlayers) {
            var matchesLeftObj = getMatchesLeft(draftObj.players, draftObj.matchResults, curUserID);
            matchesLeftBody += '(' + matchesLeft + ')\n';

            if (matchesLeft == 0) {
                matchesLeftBody += 'Draft is over, <@' + draftObj.winningUserID + '> is the winner!  :trophy: :trophy: :trophy:\n';
            }
            
            for (var j = 0; j < matchesLeftObj.length; j++) {
                var curMatch = matchesLeftObj[j];
                var player1Data = calculatePlayerName(curMatch.player1ID, allUserData);
                var player1Name = player1Data.playerName;
                var player2Data = calculatePlayerName(curMatch.player2ID, allUserData);
                var player2Name = player2Data.playerName;
                matchesLeftBody += "    *" + player1Name + "* versus *" + player2Name + "*\n";
            }
        } else {
            matchesLeftBody = matchesLeft;
        } 
        
        messageBody.text += '*Matches left*: ' + matchesLeftBody + '\n';
        messageBody.text += '*Current Standings*: \n';

        var standingsObj = calculateStandings(draftObj.players, draftObj.matchResults);

        // resort the standings obj descending by match wins, then head to head record, then game win %
        var results = standingsObj.sort(function(a,b) {
            if (a.matchWins == b.matchWins) {
                // secondary tiebreaker: head to head record
                // did A and B play? function below returns 1 for "A beat B", -1 for "B beat A" and 0 for "A and B haven't played"
                var result = getHeadToHeadResult(a, b);
                if (result > 0) {
                    return -1;
                } else if (result < 0) {
                    return 1;
                } else {
                    // tertiary tiebreaker - game win %
                    var aGamesTotal = a.gameWins + a.gameLosses;
                    var bGamesTotal = b.gameWins + b.gameLosses;
                    var aGameWinPercentage = (aGamesTotal == 0) ? 0 : (a.gameWins / aGamesTotal);
                    var bGameWinPercentage = (bGamesTotal == 0) ? 0 : (b.gameWins / bGamesTotal);
                    
                    if (aGameWinPercentage == bGameWinPercentage) {
                        // fourth tiebreaker - total games
                        return bGamesTotal - aGamesTotal;
                    } else {
                        return bGameWinPercentage - aGameWinPercentage;
                    }
                }
            } else {
                // primary tiebreaker: match wins
                return b.matchWins - a.matchWins;
            }
        });

        for (var j = 0; j < standingsObj.length; j++) {
            var curStandingsObj = standingsObj[j];
            var fallbackText = "Standings for player " + standingsObj.playerID;
            var playerData = calculatePlayerName(curStandingsObj.playerID, allUserData);
            var playerName = playerData.playerName;
            var color = getColorFromIndex(j);
            var matchWins = curStandingsObj.matchWins;
            var matchLosses = curStandingsObj.matchLosses;
            var gameWins = curStandingsObj.gameWins;
            var gameLosses = curStandingsObj.gameLosses;
            var gameHistory = "";
            var gameTotal = gameWins + gameLosses;
            var gameWinPercentage = (gameTotal == 0) ? 0 : (gameWins / gameTotal);
            gameWinPercentage = Math.round(gameWinPercentage * 100);
            var recordText = matchWins + "-" + matchLosses + " (" + gameWins + "-" + gameLosses + " games, " + gameWinPercentage + "%)";

            for (var k = 0; k < curStandingsObj.playHistory.length; k++) {
                var currentGameHistory = curStandingsObj.playHistory[k];
                gameHistory += calculatePlayerName(currentGameHistory.versus, allUserData).playerName;
                gameHistory += " (" + currentGameHistory.result + ") ";
            }

            attachments.push({
                fallback: fallbackText,
                color: color,
                title: playerName,
                fields: [
                    {
                        title: "Rank:",
                        value: j + 1,
                        short: true
                    },
                    {
                        title: "Record:",
                        value: recordText,
                        short: true
                    },
                    {
                        title: "Game History:",
                        value: gameHistory,
                        short: false
                    }
                ],
                mrkdwn_in: ["fields"]
            });
        }

        messageBody.attachments = attachments;
    } else {
        messageBody.text = "No match results entered, use the `add result` command to add some";
    }

    return messageBody;
}

function getMatchesLeftListConcise(draftObj, curUserID, allUserData)
{
    var listReply = "";

    if (draftObj && draftObj.players && draftObj.players.length > 0) {

        var playerCount = 0;
        var matchesLeftObj = getMatchesLeft(draftObj.players, draftObj.matchResults, curUserID);
        listReply += "Here are the users you have left to play: \n";

        for (var j = 0; j < matchesLeftObj.length; j++) {
            var curMatch = matchesLeftObj[j];
            if (curMatch.player1ID == curUserID) {
                var player2Data = calculatePlayerName(curMatch.player2ID, allUserData);
                var player2Name = player2Data.playerName;
                listReply += '*' + player2Name + "*\n";
                playerCount++;
            }
            else if (curMatch.player1ID == curUserID) {
                var player1Data = calculatePlayerName(curMatch.player1ID, allUserData);
                var player1Name = player1Data.playerName;
                listReply += '*' + player1Name + "*\n";
                playerCount++;
            }
        }

        if (playerCount == 0)
        {
            listReply += "*none!* (press 'q')";
        }
    } else {
        listReply = "No users in the default draft, use the `add players` command to add some";
    }

    return listReply;
}

function getUserListConcise(draftObj, allUserData)
{
    var listReply = "";

    if (draftObj && draftObj.players && draftObj.players.length > 0) {

        listReply += "Here are the users in the default draft: \n";

        for (var j = 0; j < draftObj.players.length; j++) {
            var playerData = calculatePlayerName(draftObj.players[j].id, allUserData);
            var playerName = '*' + playerData.playerName + '*';
            listReply += playerName + "\n";
        }
    } else {
        listReply = "No users in the default draft, use the `add players` command to add some";
    }

    return listReply;
}

function getMatchesLeftMessageBody(draftObj, allUserData, curUserID)
{
    var messageBody = {
        text: "",
        unfurl_links: false,
        unfurl_media: false
    };
    var attachments = [];

    if (draftObj && draftObj.players && draftObj.players.length > 0 && draftObj.matchResults && draftObj.matchResults.length > 0) {
        
        var numPlayers = draftObj.players.length
        var expectedMatchNum = (numPlayers * (numPlayers - 1)) / 2;  // e.g. 5+4+3+2+1 = 15 = 6*5/2 for 6 players
        var matchesPlayed = draftObj.matchResults.length;
        var matchesLeft = expectedMatchNum - draftObj.matchResults.length;

        messageBody.text += '\n*Expected matches total*: ' + expectedMatchNum + '\n';
        messageBody.text += '*Matches played*: ' + matchesPlayed + '\n';
        messageBody.text += '*Matches left (' + matchesLeft + ')*:\n';

        var matchesLeftObj = getMatchesLeft(draftObj.players, draftObj.matchResults, curUserID);
        var matchesLeftBody = "";
        var fallbackText = "Matches left data # " + j;
        var color = getColorFromIndex(j);

        for (var j = 0; j < matchesLeftObj.length; j++) {
            var curMatch = matchesLeftObj[j];
            var player1Data = calculatePlayerName(curMatch.player1ID, allUserData);
            var player1Name = player1Data.playerName;
            var player2Data = calculatePlayerName(curMatch.player2ID, allUserData);
            var player2Name = player2Data.playerName;
            matchesLeftBody += "*" + player1Name + "* versus *" + player2Name + "*\n";
        }

        attachments.push({
            fallback: fallbackText,
            color: color,
            title: "",
            fields: [
                {
                    title: "",
                    value: matchesLeftBody,
                    short: false
                }
            ],
            mrkdwn_in: ["fields"]
        });

        messageBody.attachments = attachments;
    } else {
        messageBody.text = "No match results entered, use the `add result` command to add some";
    }

    return messageBody;
}

/*****************************************/
/*      Convo helpers                    */
/*****************************************/

function pickDraftStatusFromList(convo, defaultDraftName)
{
    convo.ask("0: `" + getDraftStatusByID(0) + "`\n" + 
        "1: `" + getDraftStatusByID(1) + "`\n" +
        "2: `" + getDraftStatusByID(2) + "`\n" +
        "Set a status for the default draft `" + defaultDraftName 
        + "` by choosing from the menu above, or 'q' to quit (If you want to set the status of a different draft, set a different default draft using the `set default` command)", 
        function(response, convo) {
            var statusNum = response.text;
            
            if (statusNum.toLowerCase() == 'q') {
                // stop the conversation. this will cause it to end with status == 'stopped'
                convo.stop();
            }
            else if(isNaN(Number(statusNum))) {
                convo.say('Please enter a number...');
                convo.repeat();
                convo.next();
            }
            else if(Number(statusNum) < 0 || Number(statusNum) > 2) {
                convo.say('Please enter a number between 0-2...');
                convo.repeat();
                convo.next();
            }
            else {
                // since no further messages are queued after this,
                // the conversation will end naturally with status == 'completed'
                convo.next();
            }
        }, {'key': 'statusID'}); // store the results in a field called draftID

    return convo;
}

function getNickNameFromConvo(controller, message, callback)
{
    controller.storage.users.get(message.user, function(err, user) {
        if (user && user.id) {
            callback(user.id);
        } else {
            bot.startConversation(message, function(err, convo) {
                if (!err) {
                    convo.say('I need a nickname for you!');
                    convo.ask('What should I call you? (note: this will map you to drafts using this same nickname for subsequent drafts)', function(response, convo) {
                        convo.ask('You want me to call you `' + response.text + '`?', [
                            {
                                pattern: 'yes',
                                callback: function(response, convo) {
                                    // since no further messages are queued after this,
                                    // the conversation will end naturally with status == 'completed'
                                    convo.next();
                                }
                            },
                            {
                                pattern: 'no',
                                callback: function(response, convo) {
                                    // stop the conversation. this will cause it to end with status == 'stopped'
                                    convo.stop();
                                }
                            },
                            {
                                default: true,
                                callback: function(response, convo) {
                                    convo.repeat();
                                    convo.next();
                                }
                            }
                        ]);

                        convo.next();

                    }, {'key': 'nickname'}); // store the results in a field called nickname

                    convo.on('end', function(convo) {
                        if (convo.status == 'completed') {
                            bot.reply(message, 'OK! I will update my dossier...');

                            controller.storage.users.get(message.user, function(err, user) {
                                if (!user) {
                                    user = {
                                        id: message.user,
                                    };
                                }
                                user.name = convo.extractResponse('nickname');
                                controller.storage.users.save(user, function(err, id) {
                                    callback(user.id);
                                });
                            });
                        } else {
                            // this happens if the conversation ended prematurely for some reason
                            bot.reply(message, 'OK, nevermind!');
                        }
                    });
                }
            });
        }
    });
}

function pickDraftNumberFromConversation(team, convo, askString)
{
    convo.ask(askString, function(response, convo) {
        var draftNum = response.text;
        
        if (draftNum.toLowerCase() == 'q') {
            // stop the conversation. this will cause it to end with status == 'stopped'
            convo.stop();
        }
        else if(isNaN(Number(draftNum))) {
            convo.say(':x: Please enter a number...');
            convo.repeat();
            convo.next();
        }
        else if(Number(draftNum) < 0 || Number(draftNum) >= team.drafts.length) {
            convo.say(':x: Please enter a number within the listed range of draft numbers...');
            convo.repeat();
            convo.next();
        }
        else {
            // since no further messages are queued after this,
            // the conversation will end naturally with status == 'completed'
            convo.next();
        }
    }, {'key': 'draftID'}); // store the results in a field called draftID

    return convo;
}

function pickPlayerFromConversation(team, convo, allUserData, askString)
{
    convo.ask(askString, function(response, convo) {
        var playerName = response.text;
        var defaultDraftID = getDefaultDraftID(team);
        
        if (playerName.toLowerCase() == 'q') {
            // stop the conversation. this will cause it to end with status == 'stopped'
            convo.stop();
        }
        else if(!team || !team.drafts || defaultDraftID == -1 || !(team.drafts[defaultDraftID].players)) {
            // stop the conversation. this will cause it to end with status == 'stopped'
            convo.say(':x: No valid drafts or no players in default draft, aborting!');
            convo.stop();
        }
        else if(!playerFound(playerName, team.drafts[defaultDraftID], allUserData)) {
            convo.say(':x: Please enter a player who is in the draft...');
            convo.repeat();
            convo.next();
        }
        else {
            // since no further messages are queued after this,
            // the conversation will end naturally with status == 'completed'
            convo.next();
        }
    }, {'key': 'playerName'}); // store the results in a field called playerName

    return convo;
}

function pickRaresFromConversation(team, convo, message, controller, playerID)
{
    var rareListToAdd = [];
    convo.ask(':robot_face:Enter a rare or *semicolon-separated* list of rares for player <@' + playerID + '> (or \'q\' to quit).  Prefix foils with a \'*\' or append \'(foil)\' to the end to indicate a foil', function(response, convo) {
        
        var rareResponse = response.text;
        
        if (rareResponse.toLowerCase() == 'q') {
            // stop the conversation. this will cause it to end with status == 'stopped'
            convo.stop();
        }
        else {
            rareListToAdd = rareResponse.split(';');

            // since no further messages are queued after this,
            // the conversation will end naturally with status == 'completed'
            convo.next();
        }
    }, {'key': 'rareListToAdd'}); // store the results in a field called rareList

    convo.on('end', function(convo) {
        if (convo.status == 'completed') {

            for (var j = 0; j < rareListToAdd.length; j++) {
                var rareName = String(rareListToAdd[j]).trim();
                var draftID = getDefaultDraftID(team);

                var foil = isRareFoil(rareName);
                rareName = unDecorateCardName(rareName, foil);

                if(!team.drafts[draftID].rareList) {
                    team.drafts[draftID].rareList = [
                        {
                            cardName: rareName,
                            draftedPlayerID: playerID,
                            redraftedPlayerID: "",
                            isFoil : foil
                        }
                    ];
                } else {
                    team.drafts[draftID].rareList.push(
                        {
                            cardName: rareName,
                            draftedPlayerID: playerID,
                            redraftedPlayerID: "",
                            isFoil : foil
                        });
                }

                loadCardPrices(team, controller, draftID, rareName, foil);
            }

            controller.storage.teams.save(team, function(err, id) {
                bot.reply(message, 'Got it. Added the specified ' + rareListToAdd.length + ' rare(s) as drafted by <@' + playerID + '>.\n');
            });
        } else {
            // this happens if the conversation ended prematurely for some reason
            bot.reply(message, 'OK, nevermind!');
        }
    });
}

function enterMatchResultFromConversation(team, convo, message, controller, player1ID, player2ID)
{
    var draftID = getDefaultDraftID(team);
    var resultExists = false;

    if (team && team.drafts && team.drafts[draftID]) {
        var draftObj = team.drafts[draftID];

        var matchResult = {
            player1ID: player1ID,
            player2ID: player2ID,
            player1GamesWon: 0,
            player2GamesWon: 0,
            matchWinner: ""
        };

        bot.startConversation(message, function(err, convo2) {
            
            if (matchResultFound(draftObj.matchResults, player1ID, player2ID)) {
                convo2.sayFirst(':warning:Warning: this match result already exists, entering a new result will overwrite the previous result (\'q\' to quit)');
                resultExists = true;
            }

            convo2.ask('What was the game score result? (or \'q\' to quit) Note: enter your game score first followed by your opponents, valid entries are in the set {2-0, 2-1, 1-2, 0-2}, enter forfeits as "2-0"', [
                {
                    pattern: '[qQ]',
                    callback: function(response, convo) {
                        convo.stop();
                    }
                },
                {
                    pattern: '2-0',
                    callback: function(response, convo) {
                        matchResult.player1GamesWon = 2;
                        matchResult.player2GamesWon = 0;
                        matchResult.matchWinner = matchResult.player1ID;
                        convo.next();
                    }
                },
                {
                    pattern: '2-1',
                    callback: function(response, convo) {
                        matchResult.player1GamesWon = 2;
                        matchResult.player2GamesWon = 1;
                        matchResult.matchWinner = matchResult.player1ID;
                        convo.next();
                    }
                },
                {
                    pattern: '0-2',
                    callback: function(response, convo) {
                        matchResult.player1GamesWon = 0;
                        matchResult.player2GamesWon = 2;            
                        matchResult.matchWinner = matchResult.player2ID;
                        convo.next();
                    }
                },
                {
                    pattern: '1-2',
                    callback: function(response, convo) {
                        matchResult.player1GamesWon = 1;
                        matchResult.player2GamesWon = 2;
                        matchResult.matchWinner = matchResult.player2ID;
                        convo.next();
                    }
                },
                {
                    default: true,
                    callback: function(response, convo) {
                        convo.say('Invalid game score, valid entries are in the set {2-0, 2-1, 1-2, 0-2}');
                        convo.repeat();
                        convo.next();
                    }
                }
            ]);

            // persist the match result, and store final rankings if the draft is over
            convo2.on('end', function(convo) {
                if (convo2.status == 'completed') {
                    // replace the existing result if needed
                    if (resultExists) {
                        deleteMatchResult(draftObj, player1ID, player2ID);
                    }

                    if (!team.drafts[draftID].matchResults) {
                        team.drafts[draftID].matchResults = [matchResult];
                    } else {
                        team.drafts[draftID].matchResults.push(matchResult);
                    }

                    var numPlayers = draftObj.players.length
                    var expectedMatchNum = (numPlayers * (numPlayers - 1)) / 2;  // e.g. 5+4+3+2+1 = 15 = 6*5/2 for 6 players
                    var matchesPlayed = draftObj.matchResults.length;
                    var matchesLeft = expectedMatchNum - matchesPlayed;

                    if (matchesLeft <= 0) {
                        // draft is over, apply rankings
                        //TODO: automatically set draft to status = redraft?
                        var standingsObj = calculateStandings(draftObj.players, draftObj.matchResults);

                        // resort the standings obj descending by match wins, then head to head record, then game win %
                        var results = standingsObj.sort(function(a,b) {
                            if (a.matchWins == b.matchWins) {
                                // secondary tiebreaker: head to head record
                                // did A and B play? function below returns 1 for "A beat B", -1 for "B beat A" and 0 for "A and B haven't played"
                                var result = getHeadToHeadResult(a, b);
                                if (result > 0) {
                                    return -1;
                                } else if (result < 0) {
                                    return 1;
                                } else {
                                    // tertiary tiebreaker - game win %
                                    var aGamesTotal = a.gameWins + a.gameLosses;
                                    var bGamesTotal = b.gameWins + b.gameLosses;
                                    var aGameWinPercentage = (aGamesTotal == 0) ? 0 : (a.gameWins / aGamesTotal);
                                    var bGameWinPercentage = (bGamesTotal == 0) ? 0 : (b.gameWins / bGamesTotal);
                                    
                                    if (aGameWinPercentage == bGameWinPercentage) {
                                        // fourth tiebreaker - total games
                                        return bGamesTotal - aGamesTotal;
                                    } else {
                                        return bGameWinPercentage - aGameWinPercentage;
                                    }
                                }
                            } else {
                                // primary tiebreaker: match wins
                                return b.matchWins - a.matchWins;
                            }
                        });

                        for (var j = 0; j < standingsObj.length; j++) {
                            var playerID = standingsObj[j].playerID;
                            for (var k = 0; k < draftObj.players.length; k++) {
                                if (draftObj.players[k].id == playerID) {
                                    draftObj.players[k].rank = j + 1;
                                    if (j == 0) {
                                        draftObj.winningUserID = playerID;
                                    }
                                    break;
                                }
                            }
                        }
                    }

                    controller.storage.teams.save(team, function(err, id) {
                        if (matchesLeft <= 0) {
                            bot.reply(message, 'Added the specified match result.  All matches are complete!  <@' + draftObj.winningUserID + '> is the winner! :trophy: :trophy: :trophy:');
                        } else {
                            bot.reply(message, 'Got it. Added the specified match result.  There are ' + matchesLeft + ' matches left in the draft.  Type `@draftBot6000 standings` command to see current standings.');
                        }
                    });
                } else {
                    // this happens if the conversation ended prematurely for some reason
                    bot.reply(message, 'OK, nevermind!');
                }
            });
        });
    }
}

function pickRankingFromConversation(team, convo, controller, askString)
{
    convo.ask(askString, function(response, convo) {
        var ranks = response.text;
        var rankList = ranks.split(',');

        var defaultDraftID = getDefaultDraftID(team);
        
        if (ranks.toLowerCase() == 'q') {
            // stop the conversation. this will cause it to end with status == 'stopped'
            convo.stop();
        }
        else if(!team || !team.drafts || defaultDraftID == -1 || !(team.drafts[defaultDraftID].players)) {
            // stop the conversation. this will cause it to end with status == 'stopped'
            convo.say(':x: No valid drafts or no players in default draft, aborting!');
            convo.stop();
        }
        else {
            var numPlayers = team.drafts[defaultDraftID].players.length;
            if (rankList.length != numPlayers) {
                convo.say(':x: Please enter a number of ranks matching the number of players in the drafts (should be `' + numPlayers + '`)...');
                controller.storage.users.all(function(err, allUserData) {
                    var messageBody = getUserListConcise(team.drafts[defaultDraftID], allUserData);
                    convo.say(messageBody);
                });
                convo.repeat();
            } else {

                for(var i = 0; i < rankList.length; i++) {
                    var validRanks = true;
                    if (isNaN(Number(rankList[i])) || Number(rankList[i]) < 1 || Number(rankList[i]) > numPlayers ) {
                        convo.say(':x: Each rank should be a number from 1 to ' + numPlayers + '...');
                        controller.storage.users.all(function(err, allUserData) {
                            var messageBody = getUserListConcise(team.drafts[defaultDraftID], allUserData);
                            convo.say(messageBody);
                        });
                        convo.repeat();
                        break;
                    } else {
                        // check that previous ranks don't contain duplicates (there has to be a better way to do this...)
                        for (var k = i; k > 0; k--) {
                            if (rankList[k - 1] == rankList[i]) {
                                // dup found, return false
                                validRanks = false;

                                convo.say(':x: Each rank should be unique...');
                                controller.storage.users.all(function(err, allUserData) {
                                    var messageBody = getUserListConcise(team.drafts[defaultDraftID], allUserData);
                                    convo.say(messageBody);
                                });
                                convo.repeat();
                                break;
                            }
                        }
                    }

                    if(!validRanks) {
                        break;
                    }

                }
            }
            
            // continue the conversation, either with validation continuation or success case depending on above checks
            convo.next();
        }
    }, {'key': 'rankingList'}); // store the results in a field called rankingList
    
    return convo;
}

function pickRedraftFromConversation(team, convo, askString, message, controller)
{
    convo.ask(askString, function(response, convo) {
        var rareIDPicked = response.text;
        var defaultDraftID = getDefaultDraftID(team);
        
        if (rareIDPicked.toLowerCase() == 'q') {
            // stop the conversation. this will cause it to end with status == 'stopped'
            convo.stop();
        } else if(!team || !team.drafts || defaultDraftID == -1 || !team.drafts[defaultDraftID].rareList || team.drafts[defaultDraftID].rareList.length == 0) {
            // stop the conversation. this will cause it to end with status == 'stopped'
            convo.say(':x: No valid drafts or no rares left to pick in default draft, aborting!');
            convo.stop();
        } else if (isNaN(Number(rareIDPicked)) || Number(rareIDPicked) < 1 || Number(rareIDPicked) > team.drafts[defaultDraftID].rareList.length) {
            convo.say(':x: Please enter a number in the range (1 to ' + team.drafts[defaultDraftID].rareList.length + ')...');
            convo.repeat();
        } else {
            // continue the conversation with the valid choice
            convo.next();
        }

        convo.next();

    }, {'key': 'rareID'}); // store the results in a field called rareID

    convo.on('end', function(convo) {
        if (convo.status == 'completed') {

            // user picks from a 1-indexed list, our array is 0-indexed
            var rareResponse = Number(convo.extractResponse('rareID'));
            var draftID = getDefaultDraftID(team);
            if (isNaN(Number(rareResponse)) || Number(rareResponse) < 1 || Number(rareResponse) > team.drafts[draftID].rareList.length) {
                console.log("Somehow got here without a valid draft ID, bailing on this convo...");
            } else {
                var rareIndex = rareResponse - 1;    
                
                var rareInfo = team.drafts[draftID].rareList[rareIndex];

                // add the rare to the redraftPicks collection
                team.drafts[draftID].redraftPicks.push(
                    {
                        cardName: rareInfo.cardName,
                        draftedPlayerID: rareInfo.draftedPlayerID,
                        redraftedPlayerID: getCurrentRedraftPlayerID(team.drafts[draftID]),
                        buyPrice: rareInfo.buyPrice,
                        sellPrice: rareInfo.sellPrice,
                        isFoil: rareInfo.isFoil
                    }
                );

                // remove the rare from the rareList collection
                team.drafts[draftID].rareList.splice(rareIndex, 1);
                
                // increment pick number
                team.drafts[draftID].redraftPickNumber++;

                // send out a new rare redraft message
                controller.storage.teams.save(team, function(err, id) {
                    if (getExpectedRareCount(team.drafts[draftID]) == team.drafts[draftID].redraftPickNumber) {
                        bot.reply(message, "Thanks, redraft is complete!\n");
                    } else {
                        bot.reply(message, "Thanks, time for the next pick by <@" + getCurrentRedraftPlayerID(team.drafts[draftID]) + ">!\n");                                                
                    }
                });
            }

        } else {
            // this happens if the conversation ended prematurely for some reason
            bot.reply(message, 'OK, nevermind!');
        }
    });    

    return convo;
}

/*****************************************/
/*      Misc utility functions           */
/*****************************************/

function getColorFromIndex(index)
{
    var colorText = "";
    switch(index % 6)
    {
        case 0:
            colorText = "#ff8000";
            break;
        case 1:
            colorText = "#dddd00";
            break;
        case 2:
            colorText = "#0080ff";
            break;
        case 3:
            colorText = "#ff0000";
            break;
        case 4:
            colorText = "#ff00ff";
            break;
        case 5:
            colorText = "#11aaff";
            break;
    }

    return colorText;
}

// logic is: 
//  -if there's a stored nickname for the user ID, use that
//  -otherwise if there's a name and matching ID (applies for simple users who don't have a Slack ID), use that
function calculatePlayerName(playerID, allUserData)
{
    var playerData = {
        playerName: "",
        playerIdentifier: "",
        error: false
    };

    // every player should have an ID (with a corner case for redrafters), assumed breaking change where legacy data just doesn't work
    if (!playerID) {
        playerData.error = true;
    } else {
        // fetch from allUserData
        var data = getNameFromUserData(playerID, allUserData);
        playerData.playerName = data.playerName;
        playerData.playerIdentifier = data.playerIdentifier;
    }
    return playerData;
}

function getNameFromUserData(playerID, allUserData)
{
    var playerData = {
        playerName: "invalid",
        playerIdentifier: ""
    };

    var found = false;
    
    if (playerID) {
        for (var i = 0; i < allUserData.length; i++) {
            if (allUserData[i].id == playerID) {
                playerData.playerName = allUserData[i].name;
                playerData.playerIdentifier = "<@" + playerID + ">";
                found = true;
                break;
            }
        }

        if (!found) {
            playerData.playerName = playerID;
        }
    }

    return playerData;
}

function isUserIDInDraft(userID, draftObj)
{
    var found = false;

    for (var j = 0; j < draftObj.players.length; j++) {
        if (userID == draftObj.players[j].id) {
            found = true;
            break;
        }
    }

    return found;
}

function playerListHasValidRanks(team)
{
    var listReply = "";
    var validRanks = true;

    if (team && team.drafts && team.drafts.length > 0) {
        var draftID = getDefaultDraftID(team);
        if (team.drafts[draftID] && team.drafts[draftID].players && team.drafts[draftID].players.length > 0) {

            var numPlayers = team.drafts[draftID].players.length
            for (var j = 0; j < numPlayers; j++) {
                if (team.drafts[draftID].players[j].rank) {
                    var rank = team.drafts[draftID].players[j].rank;
                    if (isNaN(Number(rank)) || Number(rank) < 1 || Number(rank) > numPlayers ) {
                        validRanks = false;
                        break;
                    } else {
                        // check that previous ranks don't contain duplicates (there has to be a better way to do this...)
                        for (var k = j; k > 0; k--) {
                            if (team.drafts[draftID].players[k - 1].rank == team.drafts[draftID].players[j].rank) {
                                // dup found, return false
                                validRanks = false;
                                break;
                            }
                        }
                    }
                } else {
                    validRanks = false;
                }
                if (!validRanks) {
                    break;
                }
            }
        } else {
            validRanks = false;
        }
    } else {
        validRanks = false;
    }    

    return validRanks;
}

function displayRaresForPlayer(team, userID)
{
    var listReply = "";
    var draftID = getDefaultDraftID(team);

    if (team && team.drafts && team.drafts.length > 0 && team.drafts[draftID]) {
        if (!isUserIDInDraft(userID, team.drafts[draftID])) {
            listReply = 'Specified player <@' + userID + '> is not in the  list of saved players for the default draft.';
        } else if (team.drafts[draftID].players && team.drafts[draftID].players.length > 0) {
            var playerRareCount = 0;
            var playerRedraftCount = 0;
            var playerRares = [];
            var playerRedrafts = [];

            // fetch the rares drafted and redrafted for the current player from both active lists (might be in the middle of a redraft)

            for (var j = 0; j < team.drafts[draftID].rareList.length; j++) {
                var curRareObj = team.drafts[draftID].rareList[j];
                var decoratedRareName = curRareObj.cardName + ((curRareObj.isFoil) ? " (foil)" : "");
                if (userID == curRareObj.draftedPlayerID) {                    
                    playerRares.push(decoratedRareName);
                    playerRareCount++;
                }
                if (userID == curRareObj.redraftedPlayerID) {
                    playerRedrafts.push(decoratedRareName);
                    playerRedraftCount++;
                }
            }

            for (var k = 0; k < team.drafts[draftID].redraftPicks.length; k++) {
                var curRareObj = team.drafts[draftID].redraftPicks[k];
                var decoratedRareName = curRareObj.cardName + ((curRareObj.isFoil) ? " (foil)" : "");
                if (userID == curRareObj.draftedPlayerID) {

                    playerRares.push(decoratedRareName);
                    playerRareCount++;
                }
                if (userID == curRareObj.redraftedPlayerID) {
                    playerRedrafts.push(decoratedRareName);
                    playerRedraftCount++;
                }
            }

            // display the rares drafted and redrafted
            listReply += "*Your drafted rares*: \n";
            for (var m = 0; m < playerRares.length; m++) {
                listReply += '`' + decorateCardName(playerRares[m]) + '`\n';
            }
            if (playerRareCount == 0) {
                listReply += '`none`';
            }

            listReply += "*Your redrafted rares*: \n";
            for (var n = 0; n < playerRedrafts.length; n++) {
                listReply += '`' + decorateCardName(playerRedrafts[n]) + '`\n';
            }
            if (playerRedraftCount == 0) {
                listReply += '`none`';
            }
        } else {
            listReply = "Default draft doesn't have players, use the `add players` command to add them.";
        }
    } else {
        listReply = "I don't have any saved drafts, use the `new draft` command to start one."
    }    

    return listReply;
}

function getRaresForPlayer(draftObj, playerID, allUserData)
{
    var rareList = [];
    if (draftObj && draftObj.rareList && draftObj.redraftPicks) {

        var curPlayer = calculatePlayerName(playerID, allUserData);

        // need to grab from both the rare drafted list and the redraft list (in case a redraft is in progress)
        for (var j = 0; j < draftObj.rareList.length; j++) {
            var curRare = draftObj.rareList[j].cardName;
            var curRareDrafter = calculatePlayerName(draftObj.rareList[j].draftedPlayerID, allUserData);
            if (curPlayer.playerName.toLowerCase().trim() == curRareDrafter.playerName.toLowerCase().trim()) {
                rareList.push(curRare);
            }
        }
        for (var k = 0; k < draftObj.redraftPicks.length; k++) {
            var curRare = draftObj.redraftPicks[k].cardName;
            var curRareRedrafter = calculatePlayerName(draftObj.redraftPicks[k].draftedPlayerID, allUserData);
            if (curPlayer.playerName.toLowerCase().trim() == curRareRedrafter.playerName.toLowerCase().trim()) {
                rareList.push(curRare);
            }
        }
    }

    return rareList;
}

function getRedraftsForPlayer(draftObj, playerID, allUserData)
{
    var rareList = [];
    if (draftObj && draftObj.rareList && draftObj.redraftPicks) {

        var curPlayer = calculatePlayerName(playerID, allUserData);

        for (var k = 0; k < draftObj.redraftPicks.length; k++) {
            var curRare = draftObj.redraftPicks[k].cardName;
            var curRareRedrafter = calculatePlayerName(draftObj.redraftPicks[k].redraftedPlayerID, allUserData);
            if (curPlayer.playerName.toLowerCase().trim() == curRareRedrafter.playerName.toLowerCase().trim()) {
                rareList.push(curRare);
            }
        }
    }

    return rareList;
}

function deleteRaresForPlayer(draftObj, playerID)
{
    var indicesToDelete = [];

    if (draftObj && draftObj.rareList && draftObj.status.id != 2) {

        var curIndex = 0;

        while (curIndex < draftObj.rareList.length) {
            var curPlayerID = draftObj.rareList[curIndex].draftedPlayerID;

            if(curPlayerID == playerID) {
                draftObj.rareList.splice(curIndex, 1);
            } else {
                curIndex++;
            }
        }
    }
}

function playerFound(playerName, draftObj, allUserData)
{
    if(!draftObj || !draftObj.players) {
        return false;
    } else {
        for(var i = 0 ; i < draftObj.players.length; i++) {
            var curPlayerID = draftObj.players[i].id;
            var playerData = calculatePlayerName(curPlayerID, allUserData);
            var curPlayerName = playerData.playerName;
            if (curPlayerName.toLowerCase().trim() == playerName.toLowerCase().trim()) {
                return true;
            }
        }
        // not found in the list of players for the default draft
        return false;
    }
}

function getDefaultDraftID(team)
{
    if(team && team.drafts) {
        for (var i = 0; i < team.drafts.length; i++) {
            if (team.drafts[i].default) {
                return i;
            }
        }
    }

    // shouldn't reach here, return an invalid value that will probably expose a bug :)
    return -1;
}

function getDraftStatusByID(statusID)
{
    switch(Number(statusID)) {
        case 0:
            return "not started"
        case 1:
            return "drafting finished (enter rares phase)"
        case 2:
            return  "draft matches finished (redraft rares phase)"
        default:
            return "invalid status";
    }
}

function addUniquePlayers(team, controller, draftID, playerList)
{
    var playersAdded = 0;

    if (team && team.drafts && team.drafts[draftID] && team.drafts[draftID].players) {
    
        for (var j = 0; j < playerList.length; j++) {
            var playerFound = false;
            for (var k = 0 ; k < team.drafts[draftID].players.length; k++) {
                if (team.drafts[draftID].players[k].id == playerList[j].id) {
                    playerFound = true;
                    break;
                }
            }

            if (!playerFound) {
                var playerObj = {
                    id: playerList[j].id
                };
                team.drafts[draftID].players.push(playerObj);
                playersAdded++;
            }
        }
    }

    return playersAdded;
}

function getExpectedRareCount(draftObj)
{
    var expectedRares = 0;
    var numBaselineRares = 0;
    var numExtraRares = 0;
    console.log("Calculating expected rare count for draft " + draftObj.name + " with " + draftObj.players.length + " players");

    if (draftObj && draftObj.players && draftObj.players.length > 0) {
        numBaselineRares = Number(draftObj.players.length) * 3;
        numExtraRares = Number(draftObj.numExtraRares);
        expectedRares = numBaselineRares + numExtraRares;
    }

    return expectedRares;
}

function getExtraRareCount(draftObj)
{
    var numExtraRares = 0;

    if (draftObj && draftObj.players && draftObj.players.length > 0) {
        numExtraRares = Number(draftObj.numExtraRares);
    }

    return numExtraRares;
}

function getEnteredRareCount(draftObj)
{
    var enteredRares = 0;

    if (draftObj && draftObj.rareList && draftObj.rareList.length > 0) {
        enteredRares = draftObj.rareList.length;
    }

    return enteredRares;
}

function decorateCardName(cardName)
{
    return '`' + cardName + '`';
}

function decorateBuyPrice(price, cardName, isFoil)
{
    //<www.google.com|foo>
    var decoratedPrice = "<";
    decoratedPrice += "https://www.cardkingdom.com/catalog/search?search=header&filter%5Bname%5D=";
    decoratedPrice += unDecorateCardName(cardName);
    if (isFoil) {
        decoratedPrice += "&filter%5Btab%5D=mtg_foil"
    }
    decoratedPrice += "|";
    decoratedPrice += price;
    decoratedPrice += ">";
    return decoratedPrice;
}

function decorateSellPrice(price, cardName)
{
    //<www.google.com|foo>
    var decoratedPrice = "<";
    decoratedPrice += "https://www.cardkingdom.com/purchasing/mtg_singles/?filter%5Bsort%5D=price_desc&filter%5Bsearch%5D=mtg_advanced&filter%5Bname%5D=";
    decoratedPrice += unDecorateCardName(cardName);
    decoratedPrice += "|";
    decoratedPrice += price;
    decoratedPrice += ">";
    return decoratedPrice;
}

function unDecorateCardName(cardName)
{
    var unDecoratedCardName = '';
    unDecoratedCardName = cardName.replace('[[', '');
    unDecoratedCardName = unDecoratedCardName.replace(']]', '');
    unDecoratedCardName = unDecoratedCardName.replace('$', '');
    unDecoratedCardName = unDecoratedCardName.replace('*', '');
    unDecoratedCardName = unDecoratedCardName.replace('`', '');
    unDecoratedCardName = unDecoratedCardName.replace('(foil)', '');
    unDecoratedCardName = unDecoratedCardName.trim();

    return unDecoratedCardName;
}

function isRareFoil(cardName)
{
    var isFoil = false;
    if (cardName.indexOf('*') !== -1 || cardName.indexOf('(foil)') !== -1)
    {
        isFoil = true;
    }

    return isFoil;
}

function getRareRedraftMessage(draftObj)
{
    var reply = 'Error with data, can\'t start redraft - consult tech support!';
    var nextPickPlayerID = getCurrentRedraftPlayerID(draftObj);

    if (nextPickPlayerID != 'Error') {
        reply = 'It is <@' + nextPickPlayerID + '>\'s pick next in the draft (pick #`' + (draftObj.redraftPickNumber + 1) + '` overall).\n';
        reply += 'Use the `redraft` command to make a pick (will be automatically associated with the above player)';
    }

    return reply;
}

function getCurrentRedraftPlayerID(draftObj)
{
    var nextPickPlayerID = 'Error';
    
    if (draftObj && draftObj.players && draftObj.players.length > 0 && draftObj.status.id == 2) {
        var rareRedraftNumber = draftObj.redraftPickNumber;
        var playerArray = draftObj.players;

        for (var j = 0; j < playerArray.length; j++) {
            if (playerArray[j].rank == (rareRedraftNumber % playerArray.length) + 1) {
                nextPickPlayerID = playerArray[j].id;
                break;
            }
        }
    }

    return nextPickPlayerID;
}


// what this should do: move all items from redraftPicks back to rareList, and grabs price again
function resetRedraftList(team, draftID, controller)
{
    if (team && team.drafts && team.drafts.length > 0 && team.drafts[draftID] && team.drafts[draftID].players && team.drafts[draftID].players.length > 0) {
 
        while (team.drafts[draftID].redraftPicks.length > 0) {
            var rareInfo = team.drafts[draftID].redraftPicks[0];

            // add the rare to the rareList collection
            team.drafts[draftID].rareList.push(
                {
                    cardName: rareInfo.cardName,
                    draftedPlayerName: rareInfo.draftedPlayerID,
                    redraftedPlayerName: "None so far",
                    buyPrice: rareInfo.buyPrice,
                    sellPrice: rareInfo.sellPrice
                }
            );

            // remove the rare from the redraftPicks collection
            team.drafts[draftID].redraftPicks.splice(0, 1);
        }

        for (var j = 0; j < team.drafts[draftID].rareList.length; j++) {
            var rareInfo = team.drafts[draftID].rareList[j];

            var isFoil = false;
            if (rareInfo.isFoil) {
                isFoil = true;
            }

            // take this opportunity to reload the buy and sell price
            loadCardPrices(team, controller, draftID, unDecorateCardName(rareInfo.cardName), isFoil);
        }
    }
}

function getCardSellPrice(cardName, isFoil, callback) 
{
    var request = require("request");
    var cheerio = require("cheerio");

    var SET_URL = "http://www.cardkingdom.com/purchasing/mtg_singles?filter%5Bsort%5D=&filter%5Bsearch%5D=mtg_advanced&filter%5Bname%5D=&filter%5Bcategory_id%5D={0}&filter%5Bfoil%5D=1&filter%5Bnonfoil%5D=1&filter%5Bprice_op%5D=&filter%5Bprice%5D=";
    var CARDKINGDOM_SELL_URL = "http://www.cardkingdom.com/purchasing/mtg_singles";
    var CARDKINGDOM_SINGLE_SELL = "https://www.cardkingdom.com/purchasing/mtg_singles/?filter%5Bsort%5D=price_desc&filter%5Bsearch%5D=mtg_advanced&filter%5Bname%5D=";

    var options = {
        url: CARDKINGDOM_SINGLE_SELL + cardName,
        headers: {
          'User-Agent': 'Mozilla / 5.0(Windows NT 10.0; Win64; x64) AppleWebKit / 537.36(KHTML, like Gecko) Chrome / 52.0.2743.116 Safari / 537.36 Edge / 15.15063'
        }
    };

    request(options, function (error, response, body) {
        if (!error) {
            var $ = cheerio.load(body);
            
            var cards = [];
            $('.itemContentWrapper').each(function(i, elem) {
                cards[i] = {};
                cards[i].name = $(this).find('.productDetailTitle').text().replace(/\n/g,'');
                cards[i].set = $(this).find('.productDetailSet').text().replace(/\n/g,'');
                cards[i].price = $(this).find('.usdSellPrice > .sellDollarAmount').text() + '.' + $(this).find('.usdSellPrice > .sellCentsAmount').text();
                cards[i].isFoil = $(this).find('.foil').length !== 0;
            });   
            
            callback(cards, isFoil);
        } else {
          console.log("We’ve encountered an error: " + error);
          callback({"Error": error});
        }
      });
}

function getCardBuyPrice(cardName, isFoil, callback) 
{
    var request = require("request");
    var cheerio = require("cheerio");

    var SET_URL = "http://www.cardkingdom.com/purchasing/mtg_singles?filter%5Bsort%5D=&filter%5Bsearch%5D=mtg_advanced&filter%5Bname%5D=&filter%5Bcategory_id%5D={0}&filter%5Bfoil%5D=1&filter%5Bnonfoil%5D=1&filter%5Bprice_op%5D=&filter%5Bprice%5D=";
    var CARDKINGDOM_SINGLE = "https://www.cardkingdom.com/catalog/view/?filter%5Bsort%5D=most_popular&filter%5Bsearch%5D=mtg_advanced&filter%5Bname%5D=";

    var options = {
        url: CARDKINGDOM_SINGLE + cardName + (isFoil ? "&filter%5Btab%5D=mtg_foil" : ""),
        headers: {
          'User-Agent': 'Mozilla / 5.0(Windows NT 10.0; Win64; x64) AppleWebKit / 537.36(KHTML, like Gecko) Chrome / 52.0.2743.116 Safari / 537.36 Edge / 15.15063'
        }
    };

    request(options, function (error, response, body) {
        if (!error) {
            var $ = cheerio.load(body);
            
            var cards = [];
            $('.itemContentWrapper').each(function(i, elem) {
                cards[i] = {};
                cards[i].name = $(this).find('.productDetailTitle').text().replace(/\n/g,'');
                cards[i].set = $(this).find('.productDetailSet').text().replace(/\n/g,'');
                cards[i].price = $(this).find('.stylePrice').text();
                cards[i].isFoil = $(this).find('.foil').length !== 0;
            });   
            
            callback(cards, isFoil);
        } else {
          console.log("We’ve encountered an error: " + error);
          callback({"Error": error});
        }
      });
}

function savePriceByName(team, controller, price, cardName, rareArray, isBuyPrice, isFoil)
{
    // param isBuyPrice: true for buy list, false for sell price
    if (team && team.drafts && team.drafts.length > 0) {
        var draftID = getDefaultDraftID(team);
        var found = false;

        if (rareArray) {
            for (var j = 0; j < rareArray.length; j++) {
                var curName = unDecorateCardName(rareArray[j].cardName);
                var foil = (rareArray[j].isFoil ? true : false);
                if (curName.toLowerCase().trim() == cardName.toLowerCase().trim() && foil == isFoil) {
                    if(isBuyPrice) {
                        rareArray[j].buyPrice = price;
                    } else {
                        rareArray[j].sellPrice = price;
                    }
                    found = true;
                    break;
                }
            }

            if (found) {
                controller.storage.teams.save(team, function(err, id) {
                    console.log("Saved rare " + cardName + (isFoil ? " (foil)" : "") + " with " + (isBuyPrice ? "buy" : "sell") + " price " + price);
                });
            }
        }
    }
}

function rareFound(team, cardName, isFoil)
{
    var found = false;
    var rareArray = [];

    if (team && team.drafts && team.drafts.length > 0) {
        var draftID = getDefaultDraftID(team);
        rareArray = team.drafts[draftID].rareList;
        
        if (rareArray) {
            for (var j = 0; j < rareArray.length; j++) {
                var curName = unDecorateCardName(rareArray[j].cardName);
                var foil = (rareArray[j].isFoil ? true : false);
                if (curName.toLowerCase().trim() == cardName.toLowerCase().trim() && foil == isFoil) {
                    found = true;
                    break;
                }
            }
        }
    }   
    return found;
}

function mapUserNametoUserID(userName, allUserData, playerList)
{
    var userID = "invalid";
    var found = false;
    
    if (userName) {
        for (var i = 0; i < allUserData.length; i++) {
            if (allUserData[i].name.toLowerCase().trim() == userName.toLowerCase().trim()) {
                userID = allUserData[i].id;
                found = true;
                break;
            }
        }

        if (!found) {
            // this is a non-slack (aka "simple" user), find the exact match stored in the players array to avoid bugs down the road
            for (var j = 0; j < playerList.length; j++) {
                if (playerList[j].id.toLowerCase().trim() == userName.toLowerCase().trim()) {
                    userID = playerList[j].id;
                    break;
                }
            }
        }
    }

    return userID;
}

function isValidSet(setName)
{
    var isValid = false;
    var setNameToCheck = setName.toLowerCase().trim();

    var allowedSets = [
        "3rd Edition",
        "4th Edition",
        "5th Edition",
        "6th Edition",
        "7th Edition",
        "8th Edition",
        "9th Edition",
        "10th Edition",
        "2010 Core Set",
        "2011 Core Set",
        "2012 Core Set",
        "2013 Core Set",
        "2014 Core Set",
        "2015 Core Set",
        "Aether Revolt",
        "Alara Reborn",
        "Alliances",
        "Alpha",
        "Amonkhet",
        "Anthologies",
        "Antiquities",
        "Apocalypse",
        "Arabian Nights",
        "Archenemy",
        "Archenemy - Nicol Bo",
        "Avacyn Restored",
        "Battle for Zendikar",
        "Battle Royale",
        "Beatdown",
        "Beta",
        "Betrayers of Kamigawa",
        "Born of the Gods",
        "Champions of Kamigawa",
        "Chronicles",
        "Coldsnap",
        "Commander",
        "Commander 2013",
        "Commander 2014",
        "Commander 2015",
        "Commander 2016",
        "Commander 2017",
        "Conflux",
        "Conspiracy",
        "Dark Ascension",
        "Darksteel",
        "Dissension",
        "Dragon's Maze",
        "Dragons of Tarkir",
        "Eldritch Moon",
        "Eternal Masters",
        "Eventide",
        "Exodus",
        "Explorers of Ixalan",
        "Fallen Empires",
        "Fate Reforged",
        "Fifth Dawn",
        "Future Sight",
        "Gatecrash",
        "Guildpact",
        "Homelands",
        "Hour of Devastation",
        "Ice Age",
        "Iconic Masters",
        "Innistrad",
        "Invasion",
        "Ixalan",
        "Journey into Nyx",
        "Judgment",
        "Kaladesh",
        "Khans of Tarkir",
        "Legends",
        "Legions",
        "Lorwyn",
        "Magic Origins",
        "Mercadian Masques",
        "Mirage",
        "Mirrodin",
        "Mirrodin Besieged",
        "Modern Masters",
        "Modern Masters 2015",
        "Modern Masters 2017",
        "Morningtide",
        "Nemesis",
        "New Phyrexia",
        "Oath of the Gatewatch",
        "Odyssey",
        "Onslaught",
        "Planar Chaos",
        "Planeshift",
        "Portal",
        "Portal 3K",
        "Portal II",
        "Prophecy",
        "Ravnica",
        "Return to Ravnica",
        "Rise of the Eldrazi",
        "Rivals of Ixalan",
        "Saviors of Kamigawa",
        "Scars of Mirrodin",
        "Scourge",
        "Shadowmoor",
        "Shadows Over Innistrad",
        "Shards of Alara",
        "Stronghold",
        "Tempest",
        "The Dark",
        "Theros",
        "Time Spiral",
        "Timeshifted",
        "Torment",
        "Unglued",
        "Unhinged",
        "Unlimited",
        "Unstable",
        "Urza's Destiny",
        "Urza's Legacy",
        "Urza's Saga",
        "Vanguard",
        "Visions",
        "Weatherlight",
        "Worldwake",
        "Zendikar"
    ];

    for (var j = 0; j < allowedSets.length; j++) {
        var curSet = allowedSets[j].toLowerCase().trim();
        if (curSet == setNameToCheck) {
            isValid = true;
            break;
        }
    }

    return isValid;
}

function loadCardPrices(team, controller, draftID, rareName, isFoil)
{
    // load the buy price async 
    getCardBuyPrice(rareName, isFoil, function(cards, isFoil) {
        if (cards && cards.length > 0) {
            for (var k = 0; k < cards.length; k++) {
                var price = cards[k].price.split('\n')[0].trim();
                var cardName = cards[k].name;
                // sometimes its not an exact match (e.g. "Mox Pearl (not tournament legal)")
                if (rareFound(team, cardName, isFoil) && cards[k].isFoil == isFoil) {
                    savePriceByName(team, controller, price, cardName, team.drafts[draftID].rareList, true, isFoil);
                    break;
                }
            }
        }
    });

    // load the sell price async
    getCardSellPrice(rareName, isFoil, function(cards, isFoil) {
        if (cards && cards.length > 0) {
            for (var k = 0; k < cards.length; k++) {
                var price = "$" + cards[k].price;
                var cardName = cards[k].name;
                // sometimes its not an exact match (e.g. "Mox Pearl (not tournament legal)")
                if (rareFound(team, cardName, isFoil) && cards[k].isFoil == isFoil) {
                    savePriceByName(team, controller, price, cardName, team.drafts[draftID].rareList, false, isFoil);
                    break;
                }
            }
        }
    });
}

function storeDefaultUsers(controller, callback)
{
    var defaultUsers = [
        {
            originalName: "Charles",
            name: "Charles",
            id: "U8GFFQ9Q9"
        },
        {
            originalName: "Mack",
            name: "Mack",
            id: "U8GEW2GFM"
        },
        {
            originalName: "Mike",
            name: "Mike",
            id: "U9AV4N9FY"
        },
        {
            originalName: "Kael",
            name: "Kael",
            id: "U8HP5UFQA"
        },
        {
            originalName: "Matt",
            name: "Matt",
            id: "U8GFGNQ0K"
        },
        {
            originalName: "Adrian",
            name: "Adrian",
            id: "U8H5E7HLG"
        },
        {
            originalName: "Jeremy",
            name: "Jeremy",
            id: "U8GLE7FJ8"
        },
        {
            originalName: "JeremyDev",
            name: "JeremyDev",
            id: "U8HUL39ML"
        }
    ];

    for (var j = 0; j < defaultUsers.length; j++) {
        callback(defaultUsers[j]);
    }
}

function createPlayerList(playerArray, allUserData)
{
    var playerList = [];

    for (var i = 0; i < playerArray.length; i++) {
        var curId = mapUserNametoUserID(playerArray[i], allUserData, playerArray);
        if (curId.toLowerCase() == "invalid") {
            curId = playerArray[i].trim();
        }
        playerList.push({
            id: curId
        });
    }

    return playerList;
}

function createDefaultPlayerList(channel)
{
    var playerList = [];
    var defaultUsers = [
        {
            originalName: "Charles",
            name: "Charles",
            id: "U8GFFQ9Q9"
        },
        {
            originalName: "Mack",
            name: "Mack",
            id: "U8GEW2GFM"
        },
        {
            originalName: "Mike",
            name: "Mike",
            id: "U9AV4N9FY"
        },
        {
            originalName: "Kael",
            name: "Kael",
            id: "U8HP5UFQA"
        },
        {
            originalName: "Matt",
            name: "Matt",
            id: "U8GFGNQ0K"
        },
        {
            originalName: "Adrian",
            name: "Adrian",
            id: "U8H5E7HLG"
        }
    ];

    if (channel == "D8MP3V30W" || channel == "C8J5559V5") {
        defaultUsers.push(
            {
                originalName: "JeremyDev",
                name: "JeremyDev",
                id: "U8HUL39ML"
            }
        );
    } else {
        defaultUsers.push(
            {
                originalName: "Jeremy",
                name: "Jeremy",
                id: "U8GLE7FJ8"
            }
        );
    }

    for (var i = 0; i < defaultUsers.length; i++) {
        var curId = defaultUsers[i].id;
        playerList.push({
            id: curId
        });
    }

    return playerList;
}

function deletePlayers(team, controller, message, allUserData, toRemovePlayerList)
{
    var curIndex = 0;
    var draftID = getDefaultDraftID(team);
    var draftObj = team.drafts[draftID];
    var deletedPlayers = 0;
    
    if (draftObj.status.id == 2) {
        bot.reply(message, ":x: Error, cannot delete players from a draft with status " + draftObj.status.name + ", bailing out...");
        return;
    }

    while (curIndex < draftObj.players.length) {
        var curPlayerID = draftObj.players[curIndex].id;
        var found = false;

        for (var k = 0; k < toRemovePlayerList.length; k++) {
            var userID = mapUserNametoUserID(toRemovePlayerList[k], allUserData, team.drafts[draftID].players);
            // IDs can be case-sensitive on matching in the case of simple users, so lets check lower cases
            if (curPlayerID.toLowerCase().trim() == userID.toLowerCase().trim()) {
                // a specified player to delete matches an existing player, so remove it
                draftObj.players.splice(curIndex, 1);
                deleteRaresForPlayer(draftObj, curPlayerID);
                found = true;
                deletedPlayers++;
                break;
            } 
        }
        if(!found) {
            curIndex++;
        }
    }
    
    controller.storage.teams.save(team, function(err, id) {
        bot.reply(message, "Got it. Removed " + deletedPlayers + " of the specified player(s) (any delta is due to specified users not found).\n");
    });
}

function matchResultFound(matchResults, player1ID, player2ID)
{
    var found = false;
    if(matchResults) {
        for (var i = 0; i < matchResults.length; i++) {
            var matchResult = matchResults[i];
            if ((matchResult.player1ID == player1ID && matchResult.player2ID == player2ID) ||
                (matchResult.player1ID == player2ID && matchResult.player2ID == player1ID)) {
                found = true;
                break;
            }
        }
    }

    return found;
}

function deleteMatchResult(draftObj, player1ID, player2ID)
{
    if(draftObj && draftObj.matchResults) {
        for (var i = 0; i < draftObj.matchResults.length; i++) {
            var matchResult = draftObj.matchResults[i];
            if (matchResult.player1ID == player1ID && matchResult.player2ID == player2ID) {
                draftObj.matchResults.splice(i, 1);
                break;
            }
        }
    }
}

//TODO: delete appropriate match results (and rares / redrafts) when deleting players
function calculateStandings(playerList, matchResultsObj)
{
    var playerDict = {};
    var standingsObj = [];

    // Step 1: first build empty structs for each player (so we report every player in standings even if they haven't played a match yet)
    for (var i = 0; i < playerList.length; i++) {
        playerDict[playerList[i].id] = {
            matchWins: 0,
            matchLosses: 0,
            gameWins: 0,
            gameLosses: 0,
            playHistory: []
        };
    }

    // Step 2: build up player dictionary with match results (quicker lookups while we process than an array)
    for (var j = 0; j < matchResultsObj.length; j++) {
        var matchResult = matchResultsObj[j];

        if (matchResult.matchWinner == matchResult.player1ID) {
            playerDict[matchResult.player1ID].matchWins++;
            playerDict[matchResult.player2ID].matchLosses++;
            playerDict[matchResult.player1ID].playHistory.push({
                result: 'W',
                versus: matchResult.player2ID
            });
            playerDict[matchResult.player2ID].playHistory.push({
                result: 'L',
                versus: matchResult.player1ID
            });
        } else if (matchResult.matchWinner == matchResult.player2ID) {
            playerDict[matchResult.player2ID].matchWins++;
            playerDict[matchResult.player1ID].matchLosses++;
            playerDict[matchResult.player1ID].playHistory.push({
                result: 'L',
                versus: matchResult.player2ID
            });
            playerDict[matchResult.player2ID].playHistory.push({
                result: 'W',
                versus: matchResult.player1ID
            });
        } else {
            return "Error! match result collection is corrupt (match winner is neither of player 1 or player 2 for a match result)";
        }

        playerDict[matchResult.player1ID].gameWins += matchResult.player1GamesWon;
        playerDict[matchResult.player1ID].gameLosses += matchResult.player2GamesWon;
        playerDict[matchResult.player2ID].gameWins += matchResult.player2GamesWon;
        playerDict[matchResult.player2ID].gameLosses += matchResult.player1GamesWon;
    }

    // Step 3: store dictionary results in an array (so it can be sorted)
    for (var key in playerDict) {
        var playerObj = playerDict[key];
        standingsObj.push({
            playerID: key,
            matchWins: playerObj.matchWins,
            matchLosses: playerObj.matchLosses,
            gameWins: playerObj.gameWins,
            gameLosses: playerObj.gameLosses,
            playHistory: playerObj.playHistory
        });
    }

    return standingsObj;
}

// function below returns 1 for "A beat B", -1 for "B beat A" and 0 for "A and B haven't played"
function getHeadToHeadResult(player1StandingObj, player2StandingObj)
{
    var player1ID = player1StandingObj.playerID;
    var player2ID = player2StandingObj.playerID;
    var result = 0;

    for (var j = 0; j < player1StandingObj.playHistory.length; j++) {
        var currentPlayHistory = player1StandingObj.playHistory[j];
        if (currentPlayHistory.versus == player2ID) {
            if (currentPlayHistory.result == 'W') {
                result = 1;
            } else {
                result = -1;
            }
            break;
        }
    }

    return result;
}

function getMatchesLeft(playerList, matchResults, curUserID)
{
    var matchesLeftList = [];
    var playerSortedArray = [];

    for (var k = 0; k < playerList.length; k++) {
        if (playerList[k].id == curUserID) {
            playerSortedArray.unshift(playerList[k]);
        } else {
            playerSortedArray.push(playerList[k]);
        }
    }

    for (var i = 0; i < playerSortedArray.length; i++) {
        for (var j = i; j < playerSortedArray.length; j++) {
            if(!matchResultFound(matchResults, playerSortedArray[i].id, playerSortedArray[j].id)) {
                if (playerSortedArray[i].id != playerSortedArray[j].id) {
                    matchesLeftList.push({
                        player1ID: playerSortedArray[i].id, 
                        player2ID: playerSortedArray[j].id
                    });
                }
            }
        }
    }

    return matchesLeftList;
}