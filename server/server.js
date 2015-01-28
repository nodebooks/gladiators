/**
  * Copyright (c) 2012 GAS team.
  *
  * Permission is hereby granted, free of charge, to any person obtaining a copy
  * of this software and associated documentation files (the "Software"), to deal
  * in the Software without restriction, including without limitation the rights
  * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  * copies of the Software, and to permit persons to whom the Software is
  * furnished to do so, subject to the following conditions:
  *
  * The above copyright notice and this permission notice shall be included in
  * all copies or substantial portions of the Software.
  *
  * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
  * THE SOFTWARE.
  */
var Maple = require('./maple/Maple');
var clientToUsername = [];
var PF = require('pathfinding');
var configs = require('../json/configs'); 			// Game configuration file

var api = require('./api');

var LOGIC_RATE = 10; // Logic rate in milliseconds
var TICK_RATE = 3; // Tick rate in milliseconds
var QUARTER_A_SECOND = 250 / TICK_RATE;
var HALF_A_SECOND = 500 / TICK_RATE;
var ONE_SECOND = 1000 / TICK_RATE;
var TWO_SECONDS = 2000 / TICK_RATE;
var FIVE_SECONDS = 1000 / TICK_RATE;
var SEVEN_SECONDS = 7000 / TICK_RATE;
var TEN_SECONDS = 10000 / TICK_RATE;
var THIRTY_SECONDS = 30000 / TICK_RATE;

var ROUND_LENGTH = TWO_SECONDS; 					// Round length, round means the "free action" period after the management period
var INITIAL_MANAGEMENT_PERIOD = THIRTY_SECONDS; 	// Initial management period after the gladiator placement
var MANAGEMENT_PERIOD = FIVE_SECONDS; 				// Management period after the initial round
var AI_UPDATE_PERIOD = TWO_SECONDS;
// Test -----------------------------------------------------------------------
var GASServer = Maple.Class(function(clientClass) {
    Maple.Server(this, clientClass);

}, Maple.Server, {

	pointOfReference: 0, 	// ticks
	paused: false,   		// state
	duration: 0, 			// for how long
	ai: {
        pointOfReference: 0,
        proc: null, // AI process, must be set before calling send()
        id: "computer",
        /* Fancy wrapper for compatibility with Maple client message sending */
        send: function( name, mydata ){

            //console.log('AI SEND: ' + name+ ',' + JSON.stringify(mydata));
            var msg = "";

            // workaround for messaging differences
            if ( typeof mydata[0] == "string" )
                msg = JSON.parse(mydata[0]);
            else
                msg = JSON.parse(JSON.stringify(mydata[0]));


            msg["name"] = name;
            //console.log('From AI: '+JSON.stringify(msg));
            this.proc.send(msg);
        }
    },					// Game ai

	battleSessions: {}, // which battless are active.
	challenges: [], // which challenges are currently active
	started: function() {
	console.log('Server initializing...');
	this.init();
		console.log('Server startup complete.');
		/*
		  how to use createGridFromFile:
		  -----------------------------
		  var grid = this.createGridFromFile('arena');

		  how to use A* to get path from point a to point b:
		  -------------------------------------------------
		  var finder = new PF.AStarFinder();
		  var path = finder.findPath( 8,13,  8,14,  grid.clone() );
		  console.log('Path:'+JSON.stringify(path));
		  path = finder.findPath( 8,13,   9,13,   grid.clone() );
		  console.log('Path:'+JSON.stringify(path));
		*/

    },

    /* returns Maple client by username.
     * when parameter for withAIplayers is passed, checks also
     * AI players.
     */
    getClientByUsername: function(username, withAIplayers) {
        for( var c=0; c < this.getClients().length; c++)
        {
            if ( clientToUsername[this.getClients().getAt(c).id] === username ){
                return this.getClients().getAt(c);
            }
        }

        if ( withAIplayers ) {
            for( user in configs.npcs )
            {
                if ( configs.npcs[user] == username )
                {
                    return this.ai;
                }
            }
        }

        return null;
    },

    update: function(t, tick) {
        //console.log(this.getClients().length, 'client(s) connected', t, tick, this.getRandom());


	    //this.ai.send('AI_MESSAGE_EXAMPLE', [{action: "cast a nice spell", params: {name: "Magic missile", type: "attack", damage: "2d4" } }]);



        if ( this.paused == true )
        {
            if ( tick - this.pointOfReference >= MANAGEMENT_PERIOD )
            {

                this.paused = false;
                this.pointOfReference = tick;
                var msg = {
                    "name":"BATTLE_CONTROL_SYNC",
                    "paused":this.paused,
                    "duration":ROUND_LENGTH,
                    "start":this.pointOfReference
                };
                var data = [];
                data.push(msg);
                // sends to ALL clients at the moment, but needs to send for
                // only battlesrs and potential viewers.
                for(var c = 0; c< this.getClients().length; c++)
                {
                    this.getClients().getAt(c).send(data[0].name, data);
                }

                // TODO check battle session activity; has battle ended (other side died?)
                for( var bs in this.battleSessions)
                {  
                    if ( this.battleSessions[bs].challenger == null) {
                        delete this.battleSessions[bs];
                        continue;
                    }
                    
                    if ( this.battleSessions[bs]["stateNotified"] !== undefined ) 
                        continue;
                    
                    var battleid = this.battleSessions[bs].challenger.ingame;
                    var battle = api.getBattle(battleid);
                    var challenger = this.battleSessions[bs].challenger;
                    var defender   = this.battleSessions[bs].defender;
                    
                    // check challenger battle team
                    var challengerGladiatorsAlive = false;
                    for( var bt in challenger.battleteam )
                    {
                        var gladiatorName = challenger.battleteam[bt];
                        var gladiator = this.getGladiatorByName(battle, gladiatorName);
                        // a single gladiator suffices 
                        if ( gladiator.health > 0 ) {
                            challengerGladiatorsAlive = true;
                            break;
                        }

                    }

                    var defenderGladiatorsAlive = false;
                    for( var bt in defender.battleteam )
                    {
                        var gladiatorName = defender.battleteam[bt];
                        var gladiator = this.getGladiatorByName(battle, gladiatorName);
                        // a single gladiator suffices 
                        if ( gladiator.health > 0 ) {
                            defenderGladiatorsAlive = true;
                            break;
                        }
                    }
                    
                    var battleOverMessage = {
                        type: 'BATTLE_OVER',
                        name: 'BATTLE_OVER',
                        battleid: battle._id,
                        defender: defender.name,
                        challenger: challenger.name,
                        victor: ""
                    }


                    // Check was there a victor or not.
                    if ( defenderGladiatorsAlive == true )
                    {
                        if ( challengerGladiatorsAlive == false ) {
                            console.log('Battle over, Defender has won!');
                            battleOverMessage.victor = defender.name;
                            this.notifyBattleSession(battleid, battleOverMessage);
                            this.battleSessions[bs]["stateNotified"] = true;
                        } 

                    } 
                    else if ( challengerGladiatorsAlive == true ) 
                    {

                        if ( defenderGladiatorsAlive == false ) {
                            console.log('Battle over, Challenger has won!');
                            battleOverMessage.victor = challenger.name;
                            this.notifyBattleSession(battleid, battleOverMessage);
                            this.battleSessions[bs]["stateNotified"] = true;
                        }

                    } 
                    else 
                    {
                        console.log('Both parties dead, no victor!');
                        battleOverMessage.victor = "";
                        this.notifyBattleSession(battleid, battleOverMessage);
                        this.battleSessions[bs]["stateNotified"] = true;
                   }

                }
            }
        }
        else
        {
            if ( tick - this.pointOfReference >= ROUND_LENGTH )
            {
                this.paused = true;
                this.pointOfReference = tick;
                var msg = [{
                    "name":"BATTLE_CONTROL_SYNC",
                    "paused":this.paused,
                    "duration":MANAGEMENT_PERIOD,
                    "start":this.pointOfReference
                }];
                // sends to ALL clients at the moment, but needs to send for
                // only battlesrs and potential viewers.
                for(var c = 0; c< this.getClients().length; c++)
                {
                    this.getClients().getAt(c).send(msg[0].name, msg);
                }
            }

            if( tick - this.ai.pointOfReference  >= AI_UPDATE_PERIOD )
            {
                this.ai.send('UPDATE', ['{"tick":' + tick + '}']);
                this.ai.pointOfReference = tick;
            }
        }


     
    },

    stopped: function() {
        console.log('Server stopped');
		this.broadcast(0, ['-- server halted --']);
    },

    connected: function(client) {
        console.log('Connected:', client.id);
    },

    message: function(client, type, tick, data) {

		//console.log("message:", type, "data", data);
		// TODO: Ugly JSON data will crash our server - fix it
		this.handleClientRequest(client, type, tick, data);

    },

    requested: function(req, res) {
        console.log('HTTP Request');
		//console.log(req);
		//console.log(res);
    },

    disconnected: function(client) {

		var playerNames = { players:[] }
		playerNames.players.push( clientToUsername[client.id]);

        // take care of AI upon some weird player disconnect
        var user = api.getUser(clientToUsername[client.id]);

        if ( user != null && user.ingame != null ) {

            var battlesession = this.battleSessions[user.ingame];
            if ( battlesession ) {

                if ( battlesession.defender != undefined &&
                     battlesession.defender != null &&
                     user.name == battlesession.defender.name ) {
                    battlesession.defender = null;
                    console.log('Removing battlesession defender', user.name);
                }
                else if ( battlesession.challenger != undefined &&
                          battlesession.challenger != null &&
                          user.name == battlesession.challenger.name ) {
                    console.log('Removing battlesession challenger', user.name);
                    battlesession.challenger = null;
                    if ( battlesession.defender.ai === true) {

                        var aiClient = this.getClientByUsername(battlesession.defender.name,true);
                        aiClient.send('STAND_DOWN', ['{"username":"'+battlesession.defender.name+'", "ingame":"'+user.ingame+'"}']);
                        battlesession.defender = null;
                    }
                }

            }
        }

		for( var c=0; c < this.getClients().length; c++)
		{
		console.log("Updating:", this.getClients().getAt(c).id);
		this.getClients().getAt(c).send("PLAYER_DISCONNECTED_PUSH", [playerNames]);
		}
		delete clientToUsername[client.id];
			console.log('Disconnected:', client.id);
    },

    init: function() {

	    // Handle CTRL-C in server
	    var tty = require("tty");

	    process.openStdin().on("keypress", function(chunk, key) {
	        if(key && key.name === "c" && key.ctrl) {
	            console.log("CTRL-C shut down the server");
	            srv.broadcast(1, ['Server shutdown detected']);
	            process.exit();
	        }
	    });

		// Init game AI
		if(this.ai != null) {
			var aiProcess = require('child_process');
            var that = this;
			this.ai.proc = aiProcess.fork('./server/ai');

			// Handle messages coming from the CHILD process
			this.ai.proc.on('message', function(message) {
			    //console.log('PARENT received message from ai CHILD process', message);
                message = JSON.parse(message);
			    switch(message.name) {
                default:
                    console.log("Handling message from CHILD process:", message.type);
                    that.handleClientRequest(that.ai, message.type, that.getTime(), JSON.stringify(message.data));

			  }

			});
            // Delay AI init so usercache is ready
            setTimeout(function(){
                that.ai.send('AI_INIT', ['{}']);
            }, 2500 );

			// Send a message to the CHILD process
			/*this.ai.send('AI_MESSAGE_EXAMPLE', [{action: "cast a nice spell", params: {name: "Magic missile", type: "attack", damage: "2d4" } }]);*/
		}

		// Initialize api
		api.init();

    },
    querydb: function(querypath, client, type, data) {
		var options = {host: '127.0.0.1', port: 5984, path: '/'};
		var http = require('http');
		var respdata = "";
		// check that the querypath is valid or it will hang our socket
		if(querypath[0] !== "/") {
		   querypath = '/' + querypath;
		}
		options.path = querypath;
		var response = "";
		console.log("GET:", querypath);
		var req = http.get(options, function(res) {
		  res.setEncoding('utf8');
		  res.on('data', function (chunk) {
			//console.log(chunk);
			response += chunk;	// Collect the bits and pieces of the POST response
		  });
		  res.on('end', function () {
			// Finally handle the whole response message
			  console.log(response);
		  	srv.handleDbResponse(querypath, client, type, data, response);
			response = "";
		  });
		});

		req.on('error', function(e) {
		  console.log('GET: Cannot access database: ' + e.message);
		});

		// write data to request body
		//req.write('data\n');
		//req.write('data\n');
		req.end();
    },

    updatedb: function(querypath, client, type, data, content) {
		var request = require('request')

		//console.log("PUT to: " + querypath + "\n client.id: " + client.id + "\n content: " + content + "\n data: " + data);

		if(undefined === content) {
		  content = '{"foo":"bar"}';
		}

		if(querypath[0] != '/') {
		  console.log("WARNING: updatedb: received invalid querypath", querypath);
		  querypath = '/' + querypath;
		}

		//console.log("CONTENT:", content);
		//console.log("QUERYPATH:", querypath);


		request({
		  method: 'PUT',
		  uri: 'http://localhost:5984' + querypath,
		  'content-type': 'application/json',
		  'content-length': content.length,
		  'body': content

		}, function (error, response, body) {
		//console.log("BODY:", body);
			if(response) {
				if(response.statusCode == 201){
					//console.log("PUT ok for: " + querypath + "\n client.id: " + client.id + "\n content: " + content);
						srv.handleDbResponse(querypath, client, type, data, response);
					}
					else {
						console.log("PUT failed for: " + querypath + "\n client.id: " + client.id + "\n content: " + content + " with status code:" + response.statusCode);
					}
				}
				else {
					console.log("ERROR: updatedb response undefined for: " + querypath + "\n client.id: " + client.id + "\n content: " + content);
				}
			})
    },

    handleDbResponse: function(querypath, client, type, data, response) {
		console.log("handleDbResponse: ", type, "querypath", querypath + " : " + data+ " : " + response);

		switch(type)
		{
			case 'BATTLE_START_CREATE_BATTLE_REQ':
			case 'BATTLE_START_LOAD_CHALLENGER_REQ':
			case 'BATTLE_START_LOAD_DEFENDER_REQ':
			case 'BATTLE_START_LOAD_BATTLE_REQ':
			case 'BATTLE_START_STORE_PLAYERS_REQ':
			case 'BATTLE_START_STORE_PLAYERS_RES':
			case 'BATTLE_START_UPDATE_CHALLENGER':
			case 'BATTLE_START_UPDATE_DEFENDER':
				 this.handleCreateNewBattle(null, null, type, data, response);
			break;

			case 'CHALLENGE_REQ_DEFENDER_CHECK':
				console.log(response);
				 if ( JSON.parse(response) != null && JSON.parse(response).ingame == null )
				 {
					 console.log('About to check  challenger...');
					 this.querydb('/users/'+JSON.parse(data).username, client, 'CHALLENGE_REQ_ONLINE_CHECK', data);
				 }
				 else
				 {
					 console.log('Seeking challenger, negative response...');
					 for(var c=0; c<this.getClients().length;c++)
					 {
						 if (clientToUsername[this.getClients().getAt(c).id] == JSON.parse(data).username)
						 {
							 console.log('Sending response to challenger');
							 this.getClients().getAt(c).send('CHALLENGE_RES', ['{"response":"NOK", "reason":"defender already in battles. "}']);
							 break;
						 }
					 }
				 }
			break;

        case 'CHALLENGE_REQ_ONLINE_CHECK':

            if ( JSON.parse(response) == null || JSON.parse(response).ingame != null )
            {
                var cli = this.getClientByUsername( JSON.parse(data).username)
                if ( cli != null ) {
                    cli.send('CHALLENGE_RES', ['{"response":"NOK", "reason":"challenger already in battle. "}']);
                    break;
                }
            }

            // check whether user is online.
            var defender = JSON.parse(data).defender;
            // check both live and AI players
            var defenderClient = this.getClientByUsername(defender,true);

            if ( defenderClient == null )
            {
                // user marked as defender is offline, cannot accept.
                client.send('CHALLENGE_RES',
                            ['{"response":"NOK", "reason":"Defender not available."}'])

            }
            else
            {
                // user is online, ask for acceptance.
                this.challenges.push( {
                    "state":"WAITING_ACCEPTANCE",
                    "tick":this.getTick(),
                    "defenderclient":defenderClient,
                    "defender":defender,
                    "challenger":clientToUsername[client.id]
                });
                // send challenge request for defender
                defenderClient.send('CHALLENGE_REQ',
                                    ['{"challenger":"'+ clientToUsername[client.id] + '", "defender":"'+defender+'"}']);
                // notify challenger for delivery
                client.send('CHALLENGE_RES',
                            ['{"response":"DELIVERED", "challenger":"'+clientToUsername[client.id]+'","defender":"'+defender+'" }']);
            }
		        break;

		    case 'DONT_CARE':
		break;

		default:
			console.log("handleDbresponse : default branch reached, type: ", type);
			break;
		}

    },

    handlePitQuery: function(querypath, response, client, type, data) {
		console.log('handling PitQuery' + response);
		client.send(type, [response]);
    },

    handleCreateNewBattle: function(querypath, client, type, data, response)
    {
        switch(type)
        {
            case 'BATTLE_START_REQ':

                var newBattle    = api.createBattle();

               // create also pathfinding map for the arena
                api.createGridMatrixFromMap('arena.json', newBattle, true, true);
                //console.log('* newBattle map is', newBattle.map );
                //console.log('* newBattle.spawnpoints is', newBattle.spawnpoints);

                var challenger = api.getUser(data.challenger)
                var defender   = api.getUser(data.defender);


				// create crude "copies"
                newBattle.defender = JSON.parse(JSON.stringify(defender));
        		newBattle.challenger = JSON.parse(JSON.stringify(challenger));

				newBattle.initial_state.challenger = newBattle.challenger;
				newBattle.initial_state.defender = newBattle.defender;

				// cleanup unnecessary details
			    delete newBattle.challenger._rev;
				newBattle.challenger["name"] = newBattle.challenger._id;
				delete newBattle.challenger._id;
				delete newBattle.defender._rev;
				newBattle.defender["name"] = newBattle.defender._id;
				delete newBattle.defender._id;

			    //var newBattleStr = JSON.stringify(newBattle);
			    //console.log(newBattleStr);

				// set both players into game
				defender.ingame = newBattle._id;
				challenger.ingame = newBattle._id;

                api.editBattle(newBattle._id, newBattle);
                console.log('Updating users NOW' + challenger._id + ","+defender._id);


   			    api.updateUser(challenger);
                api.updateUser(defender);

                var cli = this.getClientByUsername(challenger._id);
                var msg = JSON.stringify({ response: "READY_FOR_WAR",  battle: newBattle });
                if ( cli ) {

                    cli.send('CHALLENGE_RES', [msg]);
                    cli.send('BATTLE_STATUS_RES', [ JSON.stringify({username:challenger._id, ingame:challenger.ingame}) ]);
                }

                cli = this.getClientByUsername(defender._id, true);
                if ( cli ) cli.send('CHALLENGE_RES', [msg]);


			break;
		}
    },

	handleClientRequest: function (client, type, tick, data) {

		console.log("handleClientRequest '" + type + "' data: " + data);

        switch(type)
        {
			case 'CREATE_USER_REQ':
				// First alternative for response messages
				var username = JSON.parse(data).username;
				var newuser = api.createUser(username, JSON.parse(data).password);

				if(newuser)
					client.send(api.message.CREATE_USER_RESP.message.name, [ api.toJSON(api.message.CREATE_USER_RESP.init(username, "OK", "User created.")) ]);
				else
					client.send(api.message.CREATE_USER_RESP.message.name, [ api.toJSON(api.message.CREATE_USER_RESP.init(username, "NOK", "Something went wrong.")) ]);

				// Tag AI controlled player
				if(JSON.parse(data).ai)
					api.setAiPlayer(username);

			break;

			case 'LOGIN_REQ':
				//TODO: make more secure login and detect/blacklist malicious login attempts (block ip, username, etc.)
				var username = JSON.parse(data).username;
   			    var userdata = api.getUser(username);
				var logged = false;

				for(user in clientToUsername) {
					if(clientToUsername[user] == JSON.parse(data).username) {
						logged = true;
						client.send(api.message.LOGIN_RESP.message.name, [ api.toJSON(api.message.LOGIN_RESP.init(username, "NOK", "User has already logged in game.")) ]);
						break;
					}
				}

				if(userdata && logged == false) {

                    var passwdOk = (userdata.login.password == JSON.parse(data).password); // regular users
                    var isAI = (userdata.ai == true && client == this.ai); // computer AI

					if( passwdOk || isAI )  {
						client.send(api.message.LOGIN_RESP.message.name, [ api.toJSON(api.message.LOGIN_RESP.init(username, "OK", "Login succeeded.")) ]);
						clientToUsername[client.id] = JSON.parse(data).username;
						//console.log(clientToUsername);

						// Send also initial data to the server (team, rankings, etc.)
						client.send(api.message.ITEM_SYNC.message.name, [ api.message.ITEM_SYNC.getItems() ]);

						var playerNames = { players:[] }
						playerNames.players.push(JSON.parse(data).username);

						for( var c=0; c < this.getClients().length; c++)
						{
							console.log("Updating:", this.getClients().getAt(c).id);
							this.getClients().getAt(c).send("PLAYER_CONNECTED_PUSH", [playerNames]);
						}
					}
					else {

						client.send(api.message.LOGIN_RESP.message.name, [ api.toJSON(api.message.LOGIN_RESP.init(username, "NOK", "Login failed.")) ]);
					}
				}
				else {
                    console.log('Userdata was missing');
					client.send(api.message.LOGIN_RESP.message.name, [ api.toJSON(api.message.LOGIN_RESP.init(username, "NOK", "Login failed.")) ]);
				}
			break;

			case 'HIRE_GLADIATOR_REQ':
				// Second alternative for response messages
				if(null != api.hireGladiator(JSON.parse(data).username, JSON.parse(data).gladiator)) {
					client.send(api.message.HIRE_GLADIATOR_RESP.message.name, [api.message.HIRE_GLADIATOR_RESP.ok(JSON.parse(data).gladiator)]);
				}
				else {
					client.send(api.message.HIRE_GLADIATOR_RESP.message.name, [api.message.HIRE_GLADIATOR_RESP.nok(JSON.parse(data).gladiator)]);
				}
			break;

			case 'TEAM_REQ':
				// Third alternative
				client.send(api.message.TEAM_RESP.message.name, [api.message.TEAM_RESP.init(JSON.parse(data).username)]);
			break;

			case 'BUY_ITEM_REQ':
				var resp = api.message.BUY_ITEM_RESP.init();
				resp.username = JSON.parse(data).username;
				resp.gladiator = JSON.parse(data).gladiator;
				resp.item = JSON.parse(data).item;
				var success = api.buyItem(JSON.parse(data).username, JSON.parse(data).gladiator, JSON.parse(data).item);

				if(success) {
					resp.response = "OK";
				}
				else {
					resp.response = "NOK";
					resp.reason = "Something went wrong.";
					resp.item = JSON.parse(data).item;
				}
				client.send(resp.name, [resp]);
			break;

			case 'GET_AVAILABLE_GLADIATORS_REQ':
				// Return random gladiators to every request or the same set for everyone?
				client.send(api.message.GET_AVAILABLE_GLADIATORS_RESP.message.name, [api.message.GET_AVAILABLE_GLADIATORS_RESP.init()]);
			break;

			case 'CLIENT_CHAT_REQ':
				// Check if message was ment to some specific player:
				var msg = JSON.parse(data).message;
				var username = "";
				var toUser = "";

				console.log(msg, msg.substring(0,1));
				if(msg.substring(0,1) == "@" && msg.length > 2) {
					username = msg.split(":");
					toUser = username[0];
					toUser = toUser.substring(1, toUser.length);
					console.log("username:", toUser);
				}

				for( var c=0; c < this.getClients().length; c++ )
				{
					//console.log("Updating:", this.getClients().getAt(c).id);
					if(toUser){
						// Send to a specific user only
						//console.log(this.getClients().getAt(c).id);
						if(clientToUsername[this.getClients().getAt(c).id] == toUser) {
							console.log("Private msg to", toUser, ":", JSON.parse(data).message);
							this.getClients().getAt(c).send("CHAT_SYNC", [data]);
							break;
						}

					}
					else {
						// A global message, send to all users
						this.getClients().getAt(c).send("CHAT_SYNC", [data]);
					}
				}
			break;

			case 'GET_ONLINE_PLAYERS_REQ':

				var playerNames = { players:[] }
				for( var c=0; c < this.getClients().length;c++)
				{
					playerNames.players.push(clientToUsername[this.getClients().getAt(c).id]);
				}
                // add computer players to list
                for( i in configs.npcs )
                {
                    playerNames.players.push(configs.npcs[i]);
                }

				console.log('sending now'+ JSON.stringify([playerNames]));
				client.send('GET_ONLINE_PLAYERS_RESP', [playerNames]);
			break;


			case 'CHALLENGE_REQ':
				console.log('Challenge started, asking defender\'s opinion');
				this.querydb('/users/'+JSON.parse(data).defender, client, 'CHALLENGE_REQ_DEFENDER_CHECK', data);
			break;

			case 'CHALLENGE_RES':

				var res = JSON.parse(data).response;
				console.log('CHALLENGE_RES HERE' + JSON.stringify(data));

				for(challenge in this.challenges)
				{

					var ch  = this.challenges[challenge];
					console.log('Processing:' + (ch.state) + "/"+ch.defender);
					if ( ch.state === "WAITING_ACCEPTANCE" &&
						 ch.defender === JSON.parse(data).username )
					{
						console.log('Found challenge!');
						if ( res == "OK" ) this.challenges[challenge].state = "ACCEPTED";
						else               this.challenges[challenge].state = "NOT_ACCEPTED";

                        // search client from live players (AI does not throw a challenge)
                        var challengerClient = this.getClientByUsername(this.challenges[challenge].challenger);

                        // TODO: add safety check for challenger client that does not exist?
                        if ( challengerClient == null ) {
                            console.log("CHALLENGER IS MISSING: SOMETHING IS VERY BADLY WRONG HERE!!!!");
                        }

						// if challenge was accepted, initiate battles
						if ( this.challenges[challenge].state == "ACCEPTED")
						{
							challengerClient.send('CHALLENGE_RES', ['{ "response":"'+res+'", "defender":"'+ch.defender+'"}']);
							// initiate battles start
							this.handleCreateNewBattle(null, null, 'BATTLE_START_REQ', {
								"challenger":ch.challenger,
								"defender":ch.defender
							});
							// remove challenge, no longer needed
						} else {
							challengerClient.send('CHALLENGE_RES', ['{ "response":"'+res+'", "defender":"'+ch.defender+'", "reason":"defender turned down the challenge"}']);
						}

						delete this.challenges[challenge];

					}
				}

			break;

            case 'EXIT_ARENA_REQ':
               var user = api.getUser(JSON.parse(data).username);
               var battlesession = this.battleSessions[user.ingame];
               if ( battlesession ) {

                   if ( user.name == battlesession.defender.name ) {
                       battlesession.defender = null;
                       console.log('Removing battlesession defneder', user.name);
                   }
                   else if ( user.name == battlesession.challenger.name ) {
                       console.log('Removing battlesession challenger', user.name);
                       battlesession.challenger = null;
                       if ( battlesession.defender.ai === true) {

                           var aiClient = this.getClientByUsername(battlesession.defender.name,true);
                           aiClient.send('STAND_DOWN', ['{"username":"'+battlesession.defender.name+'", "ingame":"'+user.ingame+'"}']);
                           battlesession.defender = null;
                       }
                   }

               } else {
                   console.log('EXIT_ARENA_REQ', 'Could not find battlesession', user.ingame);
               }

            break;

            case 'ENTER_ARENA_REQ':
               var user = api.getUser(JSON.parse(data).username);
               var battle = api.getBattle( user.ingame );

               if ( battle != null ) {
                   if ( !this.battleSessions[user.ingame] ) {
                       this.battleSessions[user.ingame] = {}
                   }

                   if ( battle.defender.name == user.name ) {
                       this.battleSessions[user.ingame]["defender"] = user;
                       // update battle team in ... battle
                       battle.defender.battleteam = user.battleteam;
                       console.log('Defender battle team is ' +JSON.stringify(battle.defender.battleteam));
                       api.editBattle(battle._id, battle);
                       client.send('ENTER_ARENA_RES', ['{"response":"OK", "defender":"'+user.name+'","battleid":"'+user.ingame+'"}']);
                   }

                   if ( battle.challenger.name == user.name ) {
                       console.log('Challenger entering');
                       this.battleSessions[user.ingame]["challenger"] = user;
                       // update battle team in ... battle
                       battle.challenger.battleteam = user.battleteam;
                       api.editBattle(battle._id, battle);
                       client.send('ENTER_ARENA_RES', ['{"response":"OK", "challenger":"'+user.name+'","battleid":"'+user.ingame+'"}']);
                       console.log('Challenger battle team is ' +JSON.stringify(battle.challenger.battleteam));
                       // awaken ai, if needed.
                       var def = api.getUser(battle.defender.name);
                       if ( def && def.ai === true ) {
                           console.log('Here, awaking ai');
                           var aiClient = this.getClientByUsername(battle.defender.name,true);
                           aiClient.send('WAKE_UP', ['{"username":"'+battle.defender.name+'", "ingame":"'+battle._id+'"}']);
                       }

                   }

                   // if both parties have joined the arena
                   if ( this.battleSessions[user.ingame].defender  &&
                        this.battleSessions[user.ingame].challenger ){
                       console.log('Battle start will be sent');
                       console.log('defender is :' + JSON.stringify(this.battleSessions[user.ingame].defender));
                       console.log('challenger is :' + JSON.stringify(this.battleSessions[user.ingame].challenger));


                       // setup spawn points for defender battle team
                       for ( var g in battle.defender.gladiators ) {
                           for( var bg in battle.defender.battleteam ){
                               if ( battle.defender.gladiators[g].name == battle.defender.battleteam[bg] ){
                                   console.log('Processing', battle.defender.battleteam[bg]);
                                   if ( battle.defender.gladiators[g].battledata === undefined )
                                       battle.defender.gladiators[g]["battledata"] = {}

                                   if ( battle.defender.gladiators[g].battledata.pos === undefined ) {
                                       battle.defender.gladiators[g].battledata["pos"] = battle.spawnpoints[0];
                                       battle.spawnpoints.splice(0,1);
                                   }
                               }
                           }
                       }
                       // setup spawn points for challenger battle team
                       for ( var g in battle.challenger.gladiators ) {
                           for( var bg in battle.challenger.battleteam ){
                               if ( battle.challenger.gladiators[g].name == battle.challenger.battleteam[bg] ){
                                   console.log('Processing', battle.challenger.battleteam[bg]);
                                   if ( battle.challenger.gladiators[g].battledata === undefined )
                                       battle.challenger.gladiators[g]["battledata"] = {}

                                   if ( battle.challenger.gladiators[g].battledata.pos === undefined ) {
                                       battle.challenger.gladiators[g].battledata["pos"] = battle.spawnpoints[0];
                                       battle.spawnpoints.splice(0,1);
                                   }
                               }
                           }
                       }
                       var battle = api.editBattle(battle._id, battle);

                       // enable challenger
                       var chal = this.getClientByUsername(battle.challenger.name);
                       if ( chal ) {
                           chal.send('BATTLE_START', [JSON.stringify(battle)]);
                           console.log('Challenger activated');
                       }

                       // enable defender
                       var def = this.getClientByUsername(battle.defender.name,true);
                       if ( def ) {
                           def.send('BATTLE_START', [JSON.stringify(battle)]);
                           console.log('Defender activated');
                       }

                   } else {
                       console.log('Still waiting for parties to join battle...');
                       console.log('Def is:'+this.battleSessions[user.ingame].defender);
                       console.log('Chal is:'+this.battleSessions[user.ingame].challenger);
                   }

               }

            break;
        case 'BATTLE_STATUS_REQ':
            var user = api.getUser(JSON.parse(data).username);
            console.log('user '+user.name +' is in : ' + user.ingame );
            client.send('BATTLE_STATUS_RES', [ JSON.stringify({username:user.name, ingame:user.ingame}) ]);
            break;
        case 'BATTLETEAM_SELECT_REQ':
            var user = api.getUser(JSON.parse(data).username);
            user.battleteam = JSON.parse(data).gladiators;
            api.updateUser(user);
            client.send('BATTLETEAM_SELECT_RES', [ JSON.stringify({
                username: user.username,
                response: "OK",
                gladiators: user.battleteam
            })]);

            break;
        case 'MOVE_REQ':
            var d = JSON.parse(data);
            var _path = api.move( d.battleid, d.username, d.gladiator, d.from, d.to);
            var resp = ( _path.length == 0 ) ? "NOK" : "OK";

            var message = {
                type: "MOVE_RES",
                name: "MOVE_RES",
                battleid: d.battleid,
                username: d.username,
                gladiator: d.gladiator,
                response: resp, 
                path: _path
            }

            // requesting entity will be notified of this change
            client.send( message.name, [JSON.stringify(message)] );
            
            break;
        case 'MOVE_UPDATE':
            var d = JSON.parse(data);
            var battle = api.getBattle(d.battleid);
            
            if ( battle ){
                var g = this.getGladiatorByName(battle, d.gladiator);
                var oldpos = g.battledata.pos;
                var newpos = api.setBattlePosition(d.battleid, d.username, d.gladiator, d.newpos);

                if ( newpos ) {

                    var message = {
                        type: 'MOVE_UPDATE',
                        name: 'MOVE_UPDATE',
                        battleid: d.battleid,
                        username: d.username,
                        gladiator: d.gladiator,
                        oldpos: oldpos,
                        newpos: newpos
                    }

                    this.notifyBattleSession(d.battleid, message );
                }
            }
            break;
        case 'ATTACK_REQ':
            var d = JSON.parse(data);

            // TODO check that attacks occur within proper time limits.
            // ie. no 2000 attacks per second.

            var msg = api.attack( d.attackerid, d.targetid, d.battleid);
            if ( msg != null)
            {
                this.notifyBattleSession(d.battleid, msg );
            }

            break;
        case 'DEBUG_REMOVE_FROM_BATTLE':
            var d = JSON.parse(data);
            var user = api.getUser(d.player);
            user.ingame = null;
            api.updateUser(user);
            // notify so GUI reflects change
            var client = this.getClientByUsername( d.player, true);
            client.send('BATTLE_STATUS_RES', [ JSON.stringify({username:d.player, ingame:null}) ]);
            break;
   		case 'DONT_CARE':
			break;

			default:
				console.log("message : default branch reached, type: ", type);
		}
	},

    notifyBattleSession: function( battleid, message ){
        var battlesession = this.battleSessions[battleid];
        if ( battlesession.challenger ) {
            var challenger = this.getClientByUsername(battlesession.challenger.name);
            if ( challenger ) challenger.send(message.type, [JSON.stringify(message)]);
            // debug stuff
            if ( challenger ) console.log('Challenger sent:', JSON.stringify(message));
        }
        if ( battlesession.defender ) {
            var defender = this.getClientByUsername(battlesession.defender.name, true);
            if ( defender ) defender.send(message.type, [JSON.stringify(message)]);
            // debug stuff
            if ( defender ) console.log('Defender sent:', JSON.stringify(message));
        }
    },
    
    getGladiatorByName: function(battle, gladiatorname)
    {
        for(var g in battle.defender.gladiators)
        {
            if ( battle.defender.gladiators[g].name == gladiatorname ) 
                return battle.defender.gladiators[g];
        }

        for(var g in battle.challenger.gladiators)
        {
            if ( battle.challenger.gladiators[g].name == gladiatorname ) 
                return battle.challenger.gladiators[g];
        }

        return null;
    },

})

	// Create server
	var srv = new GASServer();

	srv.start({
		port: 8080,
		logicRate: LOGIC_RATE,
		tickRate: TICK_RATE
	});