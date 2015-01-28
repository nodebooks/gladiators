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

var crypto = require('crypto');
var configs = require('../json/configs'); 			// Game configuration file
var counter = 0;
var allownewedits = true;			// True by default, allow new revisions of documents -> this will increase the DB size every time a doc is updated
/* GAS server core */
/* All the internal data should be handled as Javascript objects */
/* NOTE! Use core.toJSON(myObject) and core.toObject(myJSON) if you need to change the format */

var core = {

	init: function() {
		console.log("core: init()");

		// Initialize database
		core.dbcore.init();

		// Cache gladiators
		this.dbcore.read(configs.gladiatordb + "/_all_docs?include_docs=true", function(err, body) {
			// Double check that the gladiatordb contains gladiators
			if(body.total_rows == 0)
				core.dbcore.generateGladiators();
			else
				core.dbcore.initGladiators(body);
		});

		// Cache users/players
		this.dbcore.read(configs.userdb + "/_all_docs?include_docs=true", function(err, body) {
			if(body.total_rows == 0)
				console.log("core.init: userdb is empty");
			else
				core.dbcore.initUsers(body);
		});

        // Cache battles
		this.dbcore.read(configs.battledb + "/_all_docs?include_docs=true", function(err, body) {
			if(body.total_rows == 0)
				console.log("core.init: battledb is empty");
			else
				core.dbcore.initBattles(body);
		});

		// Cache items
		this.dbcore.read(configs.itemdb + "/_all_docs?include_docs=true", function(err, body) {
			if(body.total_rows == 0) {
				console.log("core.init: itemdb is empty");
				core.dbcore.generateItems(body);
			}
			else {
				core.dbcore.initItems(body);
			}
		});

		// Write cached data periodically to the database, so let's create an interval timer
		setInterval(core.dbcore.writeCache, configs.cachewriteperiod);

		// Prints some statistics
		setInterval(core.dbcore.printStatistics, configs.statswriteperiod);


	},

	dbresponse: function(response) {
			console.log(response);
	},

	createUser: function(username, password) {
		console.log("core.createUser: ", username, password);

		if(null == username || null == password) {
			console.log("ERROR: core.createUser: ", username, password);
			return null;
		}


		var newuser = core.user.init();
		var len = password.length;
		if((null == core.usercache.read(username)) && (len == 40)) {
			var salt = crypto.createHash('sha1');
			salt.update(crypto.randomBytes(128));

			// Create new user
			newuser._id = username;
			newuser.name = username;
			newuser.login.salt = salt.digest('hex');
			newuser.login.created = Date.now();
			newuser.login.password = password;

			console.log("createUser", newuser._id);
			// Store user/player to database

			this.dbcore.insert(configs.userdb, newuser._id, newuser, function(err, body) {
				if(err) {
					console.log("ERROR: dbcore.createUser: ", err.reason, body);
				}
				else {
					// Add user _rev to cached data
					console.log("INFO: dbcore.insert: added user", body);
					var userdata = core.getUser(body.id);
					userdata._rev = body.rev;
					core.usercache.write(body.id, userdata);
					}
			});

			// Write current user data to the usercache for gladiator hiring.
			core.usercache.write(username, newuser);
			// Pick the gladiators for the new user
			var freegladis = core.pickRandomFreeGladiators(configs.freegladiators);
			newuser.gladiators = [];
			//console.log("freegladis", freegladis);
			for(i=0; i<configs.freegladiators; i++) {
				//console.log("query gladi:", freegladis[i]);
				core.hireGladiator(newuser._id, freegladis[i]);
			}
		}
		else {
			return null;
		}

		//console.log(newuser);
		return JSON.parse(JSON.stringify(newuser));	// Caller: check that user data is not null
	},

	updateUser: function(userdata) {
		console.log("core.updateUser", userdata._id)
		var user = core.getUser(userdata._id);
		if(user) {
			// Copy revision
			//username._rev = user._rev;
			core.usercache.write(userdata._id, userdata);
		}
	},

	// Hire gladiator to a team (also "pushes" gladiator to the teams gladiatorlist)
	hireGladiator: function(username, gladiator_name) {
 		console.log("core.hireGladiator:", username, gladiator_name);

		var gladiator = core.gladiatorcache.read(gladiator_name);
		if(gladiator == null) {
			console.log("core.hireGladiator: gladiator", gladiator_name, "not found.");
			return null;
		}

		var user = core.usercache.read(username);
		if(user == null) {
			console.log("core.hireGladiator: user", username, "not found.");
			return null;
		}

		// Check that gladiator is free to serve his/her new master
		if(gladiator.status!="free") {
			console.log("core.hireGladiator: gladiator already on duty");
			return null;
		}

		// IF ALL PRECONDITIONS OK
		//console.log("hiring gladiator", gladiator, user);
		gladiator.manager = user.name;
		gladiator.status = "onduty";

		// Add gladiator to users team
		user.gladiators.push(gladiator);

		// Update cache
		core.usercache.write(user._id, user);
		core.gladiatorcache.write(gladiator._id, gladiator);

		return JSON.parse(JSON.stringify(gladiator));
	},

	getGladiator: function(name) {
 		console.log("core.getGladiator:", name);

		var gladiator = core.gladiatorcache.read(name);
		if(gladiator == null) {
			console.log("ERROR: core.getGladiator: gladiator", name, "not found.");
			return null;
		}
		return JSON.parse(JSON.stringify(gladiator));
	},

	editGladiator: function(name, attributelist) {
 		//console.log("core.editGladiator:", name);

		var gladiator = core.gladiatorcache.read(name);
		if(gladiator == null) {
			console.log("ERROR: core.editGladiator: gladiator", name, "not found.");
			return null;
		}

		// Edit gladiator attributes
		for(var item in attributelist) {
			switch(item) {
				case "status":
					gladiator.status = attributelist[item];
					break;
				case "manager":
					gladiator.manager = attributelist[item];
					break;
				case "age":
					gladiator.age = attributelist[item];
					break;
				case "health":
					gladiator.health = attributelist[item];
					break;
				case "nimbleness":
					gladiator.nimbleness = attributelist[item];
					break;
				case "strength":
					gladiator.strength = attributelist[item];
					break;
				case "mana":
					gladiator.mana = attributelist[item];
					break;
				case "salary":
					gladiator.salary = attributelist[item];
					break;
				case "fights":
					gladiator.fights = attributelist[item];
					break;
				case "knockouts":
					gladiator.knockouts = attributelist[item];
					break;
				case "injured":
					gladiator.injured = attributelist[item];
					break;
				case "effects":
					gladiator.effects.push(attributelist[item]);
					break;
				case "icon":
					gladiator.icon = attributelist[item];
					break;
				default:
					console.log("ERROR: core.editGladiator: invalid attribute:", item)
			}
		}

		// Also update the team
		if(gladiator.status != "free") {
			var user = core.usercache.read(gladiator.manager);
			if(user != null) {
				//user.gladiators indexes: 0, 1, 2, ...
				for(var index in user.gladiators) {
					if(user.gladiators[index].name == gladiator.name) {
						user.gladiators[index] = gladiator;
						break;
					}
				}
				//console.log(user._id, user);
				core.usercache.write(user._id, user);
				core.gladiatorcache.write(gladiator._id, gladiator);
			}
			else {
				console.log("core.editGladiator: user", gladiator.manager, "not found");
				return null;
			}

		}

		return JSON.parse(JSON.stringify(core.gladiatorcache.read(name)));
	},

	setAiPlayer: function(username) {
		console.log("core.setAiPlayer:", username)
		var user = core.usercache.read(username);

		// Update ai field and password
		user.ai = true;
		user.login.password = configs.aipassword;

		// Write data to usercache
		core.usercache.write(user._id, user);

		return JSON.parse(JSON.stringify(user));
	},

	rollDice: function(dice) {
		var roll = require('roll');
		return roll.roll(dice).result;
	},

	// Provide some functions to ease the pain
	toJSON: function(object) {	// Javascript object to JSON string
		return JSON.stringify(object);
	},

	toObject: function(json) {	// JSON string to Javascript object
		// Now this is a bit more complicated structure...
		var data = JSON.parse(JSON.stringify(json));
		var mydata = JSON.parse(data, function (key, value) {
			var type;
			if (value && typeof value === 'object') {
				type = value.type;
				if (typeof type === 'string' && typeof window[type] === 'function') {
					return new (window[type])(value);
				}
			}
			return value;
		});
		return mydata;
	},

	getUser: function(username) {
		console.log("core.getUser: " + username );
        var user = core.usercache.read(username);
		//console.log(user);
		if(user) {
			return JSON.parse(JSON.stringify(user));
		}
		else {
			return null;
		}

	},

	getItem: function(item) {
		console.log("core.getItem:", item);

		return JSON.parse(JSON.stringify(core.itemcache.read(item)));

	},

    createBattle: function(battleid, battledata) {
        var battle = core.battlecache.read(battleid);
        if (  battle == null ) {
            battle = core.battle.init();
            battle._id = battleid;
            // check fields according to given data - O(n^2).
            // n is sufficiently small, so it should not matter.
            for( var item in battledata) {
                for( var val in core.battle.message ) {
                    if ( item == val ) {
                        battle[item] = battledata[item];
                    } else {
                        console.log("ERROR: core.createBattle: invalid attribute:", item);
                    }
                }
            }
            // add to cache immediately
            core.battlecache.write(battle._id, battle);

            this.dbcore.insert(configs.battledb, battle._id, battle, function(err,body){
                if ( err ) {
                    console.log("ERROR: dbcore.createBattle: ", err.reason.body);
                }
                else
                {
                    console.log("INFO: dbcore.insert: added battle", body);
                    // update cache
                    var bd = core.getBattle(body.id);
                    bd._rev = body.rev;
                    core.battlecache.write(body.id, bd);
                }
            });
        } else {
            console.log("ERROR: Battle id already exists!");
            return null;
        }
        return JSON.parse(JSON.stringify(battle));
    },

    getBattle: function(battleid) {
        console.log("core.getBattle:", battleid);

        var battle = core.battlecache.read(battleid);
        if ( battle ) return JSON.parse(JSON.stringify(battle));
        else          return battle;
    },

    editBattle: function(name, attributelist) {
 		//console.log("core.editBattle:", name);

		var battle = core.battlecache.read(name);
		if(battle == null) {
			console.log("ERROR: core.editBattle: battle", name, "not found.");
			return null;
		}

		// Edit gladiator attributes
		for(var item in attributelist) {
			switch(item) {
				case "challenger":
					battle.challenger = attributelist[item];
					break;
				case "defender":
					battle.defender = attributelist[item];
					break;
				case "history":
					battle.history = attributelist[item];
					break;
				case "initial_state":
					battle.initial_state = attributelist[item];
					break;
				case "_id":
					battle._id = attributelist[item];
					break;
				case "_rev":
					battle._rev = attributelist[item];
				    break;
                case "map":
                    battle.map = attributelist[item];
                    break;
                case "spawnpoints":
                    battle.spawnpoints = attributelist[item];
                    break;
                case "spatialgraph":
                    battle.spatialgraph  = attributelist[item];
                    break;
				default:
					console.log("ERROR: core.editBattle: invalid attribute:", item)
			}
		}
        core.battlecache.write(battle._id, battle);
		return JSON.parse(JSON.stringify(core.battlecache.read(name)));
	},

	getTeamSize: function(username) {
		console.log("core.getTeamSize:", username);

		var user = core.usercache.read(username);
		//console.log(user.gladiators.length);

		if(null != user)
			return user.gladiators.length;
		else
			return null;

	},

	pickRandomFreeGladiators: function(amount) {
		console.log("core.pickRandomFreeGladiators: picking", amount, "gladiators");

		var i=0;
		var keys = [];
		var reservedGladiators = [];
		var gladis = [];
		var freegladis = 0;

		// This may take a while if amount of free gladiators is small - TODO: make another hash for reservedGladiators.
		while(Object.keys(reservedGladiators).length < amount) {	// Count the amount of hash keys  (not reservedGladiators.length!!!)
				var temp_key;
				for(temp_key in core.gladiatorcache.internalhash) {
				if(core.gladiatorcache.internalhash.hasOwnProperty(temp_key)) {
					if(core.gladiatorcache.internalhash[temp_key].status == "free")
						keys.push(temp_key);
				}
			}

			i += 1;
			var gladi = core.gladiatorcache.internalhash[keys[Math.floor(Math.random() * keys.length)]];

			if(gladi) {
				if(gladi.status == "free") {
					var name = gladi.name;
					reservedGladiators[name] = name;
				}
			}
		}

		for(key in reservedGladiators) {
			gladis.push(reservedGladiators[key]);
		}

		return JSON.parse(JSON.stringify(gladis));
	},

	// DB CORE
	dbcore: {
		nano: null,
        idcounter: 0,
        // own UUID counter for
        getUUID: function() {

            var uuid = crypto.createHash('sha1').update(crypto.randomBytes(128)+(new Date().toISOString())).digest('hex');
            uuid = uuid + ''+ this.idcounter++;
            return uuid;
        },

		init: function () {
			console.log("dbcore: init()")
			this.nano = require('nano')('http://localhost:5984');

			// init databases
			var dbnames = [configs.gladiatordb, configs.userdb, configs.battledb, configs.itemdb];
			for(item in dbnames) {
				if(dbnames[item])
					this.initGameDb(dbnames[item]);
				else
					console.log("ERROR: dbcore.init: failed to create " + dbnames[item]);
			}

		},

		initGameDb: function(dbname) {
			this.nano.db.create(dbname, function(err, body) {
				if (!err) {
					console.log('INFO: dbcore.initGameDb: database ' + '/' + dbname + ' created!');
					if(dbname == configs.gladiatordb) {
						core.dbcore.generateGladiators();
					}
				}
				else {
					//console.log("ERROR: dbcore.initGameDb: ", err.reason, "(" + dbname + ")");
				}
			});
		},

		generateGladiators: function () {
			//console.log("dbcore.generateGladiators: generating gladiators");
			var fs = require('fs');
			var races = require('../json/races'); // read races.json
			var gladiators = [];
			var racecount = 0;

			initialGladiatorsList = fs.readFileSync('./rulesets/gladiatornames.txt').toString().split("\n");

			//console.log("Available races:");
			for(key in races.race) {
				//console.log(races.race[key].name);
				racecount += 1;
			}

			for(i in initialGladiatorsList) {
				if(i < parseInt(configs.gladiatorsindatabase)) {
					var race = core.rollDice("1d"+racecount+"-1");
					var gladi = core.gladiator.init();

					gladi._id = initialGladiatorsList[i],
					gladi.name = initialGladiatorsList[i],
					gladi.status = "free",
					gladi.race = races.race[race].name,
					gladi.manager = null,
					gladi.age = "0",
					gladi.health = core.rollDice(races.race[race].health),
					gladi.nimbleness = core.rollDice(races.race[race].nimbleness),
					gladi.strength = core.rollDice(races.race[race].strength),
					gladi.mana = core.rollDice(races.race[race].mana),
					gladi.salary = core.rollDice(configs.basesalary),
					gladi.fights = "0",
					gladi.knockouts = "0",
					gladi.injured = "0",
					gladi.effects = [];
					gladi.defhand = null,
					gladi.offhand = null,
                    gladi.armour.type = "armour";
                    gladi.armour.subtype = "none";
					gladi.armour.full = null,
					gladi.armour.head = null,
					gladi.armour.torso = null,
					gladi.armour.arms = null,
					gladi.armour.hands = null,
					gladi.armour.legs = null,
					gladi.armour.feet = null,
					gladi.icon = races.race[race].icon

					gladiators[i] = gladi;
				}

			}

			this.bulkinsert(configs.gladiatordb, gladiators, true, function(err, body) {
				if(err) {
					console.log("ERROR: dbcore.generateGladiators: ", err.reason, body);
				}
				else {
					// Read the new data and init gladiatorcache
					core.dbcore.read(configs.gladiatordb + "/_all_docs?include_docs=true", function(err, body) {
								// Double check that the gladiatordb contains gladiators
								if(body.total_rows == 0) {
									console.log("ERROR: core.dbcore.generateGladiators: gladiators could not be created");
									// HALT SERVER?
								}
								else {
									core.dbcore.initGladiators(body);
								}
							});
				}
			});
			//console.log(core.gladiatorcache);
		},

		generateItems: function () {
			//console.log("dbcore.generateItems: generating items");
			var fs = require('fs');
			var items = require('../json/items.json');
			var racecount = 0;
			var itemlist = [];

			for(var i in items.items) {
				itemlist[i] = items.items[i];
				//console.log(item, items.items[i])
			}

			this.bulkinsert(configs.itemdb, itemlist, true, function(err, body) {
				if(err) {
					console.log("ERROR: dbcore.generateItems: ", err.reason, body);
				}
				else {
					// Read the new data and init itemcache
					core.dbcore.read(configs.itemdb + "/_all_docs?include_docs=true", function(err, body) {
						// Double check that the gladiatordb contains gladiators
						if(body.total_rows == 0) {
							console.log("ERROR: core.dbcore.generateItems: items could not be created");
							// HALT SERVER?
						}
						else {
							core.dbcore.initItems(body);
						}
					});
				}
			});
		},

		initGladiators: function(http_response) {

			// Iterate through the data we need
			core.gladiatorcache.flush();
			var gladiators = {};
			for(var key in http_response.rows) {
				//console.log(http_response.rows[key].doc);
				var name = http_response.rows[key].doc.name;
				gladiators[name] = http_response.rows[key].doc;
			}
			core.gladiatorcache.prefill(gladiators);
		},

		initUsers: function(http_response) {
			//console.log(http_response);
			// Iterate through the data we need
			core.usercache.flush();
			var users = {};
			for(var key in http_response.rows) {
				var name = http_response.rows[key].doc.name
				users[name] = http_response.rows[key].doc;
			}
			core.usercache.prefill(users);
		},

        initBattles: function(http_response) {
            //console.log(http_response);
            // Iterate through the data we need
			core.battlecache.flush();
			var battles = {};
			for(var key in http_response.rows) {
				var name = http_response.rows[key].doc._id
				battles[name] = http_response.rows[key].doc;
			}
            //console.log("battles are:"+JSON.stringify(battles));
			core.battlecache.prefill(battles);
        },

		initItems: function(http_response) {
			//console.log(http_response);
			// Iterate through the data we need
			core.itemcache.flush();
			var items = {};
			for(var key in http_response.rows) {
				var name = http_response.rows[key].doc.name
				items[name] = http_response.rows[key].doc;
			}
			core.itemcache.prefill(items);
		},

		checkDbExistence: function(dbname, callback) {
			this.nano.db.get(dbname, function(err, body) {
				if (!err) {
					callback(true);
				}
				else {
					callback(false);
				}
			});
		},

		read: function(dbname, callback) {

			if(dbname[0] != '/') {
			  dbname = '/' + dbname;
			}

			this.nano.db.get(dbname, function(err, body) {
				if (!err) {
					callback(err, body);
				}
				else {
					console.log("ERROR: dbcore.read:", dbname, err.reason);
				}
			});
		},

		bulkread: function(dbname, callback) {
			/*
			this.nano.db.get(dbname+ '/_all_docs?include_docs=true', function(err, body) {
			  if (!err)
				//console.log(dbname);
				callback(body);
			});
			*/
			console.log("WARNING: dbcore.bulkread: not implemented");
		},

		insert: function(db, doc, data, callback) {

			this.nano.request({ db: db,
								doc: doc,
								method: 'put',
								body: data
			   }, callback);
		},

		bulkinsert: function(dbname, data, newedit, callback) {

			if(newedit != true)
				newedit = false;

			var bulkdata = {"new_edits":true, docs: data};
			//var bulkdata = {docs: data};
			//console.log("bulkinsert:", counter++, bulkdata);
			this.nano.request({ db: dbname,
								doc: '_bulk_docs',
								method: 'post',
								//Correct format:
								//body: {"docs":[{"_id":"Itedod","name":"Itedod","race":"skeleton","team":"null","age":"0","health":11,"nimbleness":14,"strength":14,"mana":14,"salary":13,"fights":"0","knockouts":"0","injured":"0","icon":"\"skeleton.png\""},{"_id":"Igoasop","name":"Igoasop","race":"skeleton","team":"null","age":"0","health":9,"nimbleness":12,"strength":10,"mana":12,"salary":14,"fights":"0","knockouts":"0","injured":"0","icon":"\"skeleton.png\""}]}
								body: bulkdata
			   }, callback);
		},

		// Write cached data to the database periodically (every 10 seconds?)
		writeCache: function() {
			//console.log("Writing cached data to db!")
			//console.log(JSON.stringify(core.usercache.dirtykeys));
			core.gladiatorcache.save();
			core.itemcache.save();
			core.usercache.save();
            core.battlecache.save();

		},

		printStatistics: function() {
			var freegladis = 0;
			var totalgladis = 0;
			for(var key in core.gladiatorcache.internalhash) {
				totalgladis++;
				if(core.gladiatorcache.internalhash[key].status == "free") {
					freegladis++;
				}
			}

			console.log("Statistics:");
			console.log("\tTotal gladiators:", totalgladis, "\tFree gladiators:", freegladis, "(" + parseFloat((100*(freegladis/totalgladis))).toFixed(2) + "%)");
			console.log("\tCaches (r/w): gladiator ("+core.gladiatorcache.reads + "/" + core.gladiatorcache.writes+ "), user (" + core.usercache.reads + "/" + core.usercache.writes+"), item ("+core.itemcache.reads + "/" + core.itemcache.writes+", battle ("+core.battlecache.reads + "/" + core.battlecache.writes+")");
		}
	}, // dbcore

// MESSAGE STRUCTURES
	message: {

		// Should we provide an api function, or just the message structures? Or should we use the messages.json instead?
		// Api would be nice for statistics, e.g. amount of messages created/sent and the total bytes sent/received
		/*
		create: function(message) {

			switch(message) {
				case 'CREATE_USER_REQ':
				case 'CREATE_USER_RESP':
					this.message();
				default:
					console.log("ERROR: message.create: invalid message request", message)
					break;
			}

			return newmsg;
		}, */

		CREATE_USER_REQ: {
			message: {
				"type": 1, // Add this field automatically?
				"name": "CREATE_USER_REQ",
				"username": "username",
				"password": "hashedpwd"
			},
			init: function(username, password) {
				this.message.username = username;
				this.message.password = password;
				return JSON.parse(JSON.stringify(this.message));
			}
		},


		CREATE_USER_RESP: {
				message: {
					"type": 1, // Add this field automatically?
					"name": "CREATE_USER_RESP",
					"username": "username",
					"response": "OK/NOK",
					"reason": "additional reason, e.g. user exists"
				},
				init: function(username, response, reason) {
					this.message.username = username;
					this.message.response = response;
					this.message.reason = reason;

					return JSON.parse(JSON.stringify(this.message));
				}

		},

		LOGIN_REQ: {
				message: {
					"type": 1, // Add this field automatically?
					"name": "LOGIN_REQ",
					"username": "username",
					"password": "empty string or salted password",
				},
				init: function(username, password) {
					this.message.username = username;
					this.message.password = password;
					return JSON.parse(JSON.stringify(this.message));
				}
		},

		LOGIN_RESP: {
				message: {
					"type": 1, // Add this field automatically?
					"name": "LOGIN_RESP",
					"username": "username",
					"response": "OK/NOK",
					"reason": "additional reason, e.g. invalid username/password",
					"salt": "user specific salt"
				},
   			init: function(username, response, reason) {
					this.message.username = username;
					this.message.response = response;
					this.message.reason = reason;
					return JSON.parse(JSON.stringify(this.message));
				}
		},

		GET_AVAILABLE_GLADIATORS_REQ: {
				"type": 1, // Add this field automatically?
				"name": "GET_AVAILABLE_GLADIATORS_REQ",
		},

		GET_AVAILABLE_GLADIATORS_RESP: {
				message: {
					"type": 1, // Add this field automatically?
					"name": "GET_AVAILABLE_GLADIATORS_RESP",
					"gladiatorlist": [],
				},
				init: function() {
					this.message.gladiatorlist = [];
					var tmplist = core.pickRandomFreeGladiators(configs.hirelistlength);
					// Delete revisions from the listings ?
					for(i in tmplist) {
						this.message.gladiatorlist[i] = core.gladiatorcache.read(tmplist[i]);
					}
					return JSON.parse(JSON.stringify(this.message));
				}
		},

		HIRE_GLADIATOR_REQ: {
				message: {
					"type": 1, // Add this field automatically?
					"name": "HIRE_GLADIATOR_REQ",
					"username": "username",
					"gladiator": "gladiator's name"
				},
				init: function(username, gladiator) {
					this.message.username = username;
					this.message.gladiator = gladiator;
					return JSON.parse(JSON.stringify(this.message));
				}
		},

		HIRE_GLADIATOR_RESP: {
				message: {
					"type": 1, // Add this field automatically?
					"name": "HIRE_GLADIATOR_RESP",
					"gladiator": "gladiator's name",
					"response": "OK/NOK",
					"reason": "Not available anymore."
				},
				init: function(gladiator, response, reason) {
					this.message.gladiator = gladiator,
					this.message.response = response,
					this.message.reason = reason
					return JSON.parse(JSON.stringify(this.message));
				},
				ok: function(gladiator) {
					this.message.gladiator = gladiator,
					this.message.response = "OK",
					this.message.reason = "Gladiator hired."
					return JSON.parse(JSON.stringify(this.message));
				},
				nok: function(gladiator) {
					this.message.gladiator = gladiator,
					this.message.response = "NOK",
					this.message.reason = "Gladiator could not be hired."
					return JSON.parse(JSON.stringify(this.message));
				}
		},

		FIRE_GLADIATOR_REQ: {
				message: {
					"type": 1, // Add this field automatically?
					"name": "FIRE_GLADIATOR_REQ",
					"username": "username",
					"sessionid": "to verify the user action?",
					"gladiator": "gladiator's name"
				},
				init: function(username, gladiator) {
					this.message.username = username;
					this.message.gladiator = gladiator;
					return JSON.parse(JSON.stringify(this.message));
				}
		},

		FIRE_GLADIATOR_RESP: {
				message: {
					"type": 1, // Add this field automatically?
					"name": "FIRE_GLADIATOR_RESP",
					"gladiator": "gladiator's name",
					"response": "OK",
					"reason": "I don't wanna leave you!",
				},
				init: function(gladiator, response, reason) {
					this.message.gladiator = gladiator,
					this.message.response = response,
					this.message.reason = reason
					return JSON.parse(JSON.stringify(this.message));
				}
		},


		BUY_ITEM_REQ: {
				message: {
					"type": 1, // Add this field automatically?
					"name": "BUY_ITEM_REQ",
					"username": null,	// "username",
					"gladiator": null, 	//"gladiators_name",
					"item": null 		//"item id"
				},
				init: function() {
					return JSON.parse(JSON.stringify(this.message));
				}
		},

		BUY_ITEM_RESP: {
				message: {
					"type": 1, // Add this field automatically?
					"name": "BUY_ITEM_RESP",
					"username": null, 	//"username",
					"gladiator": null, 	//"gladiators_name",
					"item": null,
					"response": null,
					"reason": null
				},
				init: function() {
					return JSON.parse(JSON.stringify(this.message));
				}
		},

		TEAM_RESP: {
				message: {
					"type": 1,
					"name": "TEAM_RESP",
					"team": []
				},
				init: function(user) {
					// Make a "deep copy" using JSON-functions.
					this.message.team = JSON.parse(JSON.stringify(core.getUser(user)));
					delete this.message.team.login;
					return JSON.parse(JSON.stringify(this.message));
				}

		},

		MATCH_SYNC: {
			message: {
				"type": 1,
				"name": "MATCH_SYNC",
				"team1": {"name": "My team", "gladiator":   [{"name": "Mauri", "pos": [{"x": "1", "y": "1"}]},
															 {"name": "Kaensae", "pos": [{"x": "1", "y": "1"}]}]}, // Include all the gladiator data
				"team2": {"name": "Your team", "gladiator": [{"name": "Mauri", "pos": [{"x": "1", "y": "1"}]},
															 {"name": "Kaensae", "pos": [{"x": "1", "y": "1"}]}]}, // Include all the gladiator data
			}
		},

		ITEM_SYNC: {
			message: {
				"type": 1,
				"name": "ITEM_SYNC",
				"itemlist": []
			},
			getItems: function(){
				var index = 0;
				//console.log(core.itemcache.internalhash);
				for(var item in core.itemcache.internalhash) {
					this.message.itemlist[index++] = core.itemcache.internalhash[item];
				}
				return JSON.parse(JSON.stringify(this.message));
			}
		},

        ATTACK_RESP: {
            message: {
                "type": "ATTACK_RESP",
                "name": "ATTACK_RESP",
                "response": "OK/NOK",
                "attackerid": "Mauri",
                "targetid": "Kaensae",
                "ingame": "null",
                "damage": "damagetaken",
                "attackerpos": {"x": 1,
                                "y": 1},
                "targetpos": {"x": 2,
                              "y": 1},
                "newtargetpos": {"x": 1,
                                 "y": 1}
            },
            init: function(attacker, target, damage, success ) {
                this.message.response   = (success ? "OK" : "NOK");
                this.message.attackerid = attacker;
                this.message.targetid   = target,
                this.message.damage     = damage;

                return JSON.parse(JSON.stringify(this.message));
            }
        }
	}, // Messages

	gladiator: {
			data: {
			"status": null,	//free/onduty
			"_id": null,
			"name": null,
			"manager": null,
			"race": null,
			"age": null,
			"health": null,
			"nimbleness": null,
			"strength": null,
			"mana": null,
			"salary": null,
			"fights": null,
			"knockouts": null,
			"injured": null,
			// armour.body = placeholder for full armour set (leather, chain, plate). The individual slots may remain empty
			    "armour": {"body": "item_id", "head": "item_id", "torso": "item_id", "arms": "item_id", "hands": "item_id", "legs": "item_id", "feet": "item_id"},
			"offhand": "item_id",
			"defhand": "item_id",
			"effects":[],
			"icon": null
			},
			init: function() {
				return JSON.parse(JSON.stringify(this.data));
			}
	}, //gladiator

	user:  {
		message:{
		"_id": null,
		"name": null,
		"team": null,
		"ingame": null,
		"ai": false,
		"battleteam":[],
		"gladiators":
			[],
		"created": null,
		"login": {"salt": null,
				  "password": null,
				  "history": [{"ip": null, "timestamp": null, "duration": null, "failed": null}]
				 }
		},
		init: function() {
			return JSON.parse(JSON.stringify(this.message));
		}
	},


	item: {	// See items.json for item listing
		"_id": null,			// Unique item identifier (created on init (per server))
		"name": null,			// Name of the item
		"type": null,			// {weapon, spell, armour, ring, necklace}
		"subtype": null,		// sword, club, spear, etc. for later use (more specific damage modeling)
		"slot": null,			// {head, torso, neck, arm, hand, lhand, rhand, waist, leg, foot}
		"price": null,

		// tohit, tocrit, toblock scale 0-100 (%)
		"tohit": null,
		"toblock": null,
		"tocrit": null,
		"armourvalue": null,
		// modifiers (minus sign for decrease, plus  (or no sign) for increase)
		"health": null,			// for healing spells and items providing bonus health
		"damage": null,			// for wapons and attack spells
		"nimbleness": null,
		"strength": null,
		"mana": null,
		"age":	null,

		"icon": null,
		"description": null
	},

    battle: {
        message: {
            "_id": null,
            "history":[],
		    "initial_state":{
			    "basetick":0,
			    "challenger": null,
			    "defender": null
		    },
		    "challenger":null,
		    "defender":null
        },
        init: function(){
            return JSON.parse(JSON.stringify(this.message));
        }
    }, // battle

	// CACHES
	gladiatorcache: {
		internalhash: {},	// Cached data
		dirtykeys: {},		// Key to changed data
		reads: 0,
		writes: 0,

		prefill: function(gladiators) {
			var i = 0;

			for(var key in gladiators) {
				this.internalhash[key] = gladiators[key];
				i++;
			}

			console.log("INFO: gladiatorcache prefilled with", i, "gladiators.");
		},
		flush: function() { console.log("gladiatorcache emptied!"); this.internalhash = {}; this.dirtykeys = {}; this.reads = 0; this.writes = 0;},
		write: function(key, data) { this.writes++; this.internalhash[key] = data;	this.dirtykeys[key] = true; },
		read: function(key) { this.reads++; return this.internalhash[key]; },
		getCacheLength: function() { return Object.keys(this.internalhash).length },
		getDirtyLength: function() { return Object.keys(this.dirtykeys).length },
		save: function() {
			var retdata = [];
			var i = 0;
			for(var key in this.dirtykeys) {
				retdata[i] = this.internalhash[key];
				i++;
			}

			// Update only if there are dirty entries
			if(this.getDirtyLength() > 0) {
				//console.log("gladiatorcache: dirty entries", retdata);
				core.dbcore.bulkinsert(configs.gladiatordb, retdata, false, function(err, body) {
					if(err) {
						console.log("ERROR: core.gladiatorcache.save ", err.reason);
					}
					else {
						//console.log("gladiatorcache: bulkinserted", err, body);
						for(var i in body) {
							core.gladiatorcache.internalhash[body[i].id]._rev = body[i].rev;
						}
						// Clear the dirty entries
						for(var key in core.gladiatorcache.dirtykeys) {
							delete core.gladiatorcache.dirtykeys[key];
						}
					}
				});
			}
		}
	},

	itemcache: {
		internalhash: {},	// Cached data
		dirtykeys: {},		// Key to changed data
		reads: 0,
		writes: 0,

		prefill: function(items) {
			var i = 0;
			for(var key in items) {
				this.internalhash[key] = items[key];
				i++;
			}
			console.log("INFO: itemcache prefilled with", i, "items.");
		},
		flush: function() { console.log("itemcache emptied!"); this.internalhash = {}; this.dirtykeys = {}; this.reads = 0; this.writes = 0;},
		write: function(key, data) { this.writes++; this.internalhash[key] = data;	this.dirtykeys[key] = true; },
		read: function(key) { this.reads++; return this.internalhash[key]; },
		getCacheLength: function() { return Object.keys(this.internalhash).length },
		getDirtyLength: function() { return Object.keys(this.dirtykeys).length },
		save: function() {
			var retdata = [];
			var i = 0;
			for(var key in this.dirtykeys) {
				retdata[i] = this.internalhash[key];
				i++;
			}

			// Update only if there are dirty entries
			if(this.getDirtyLength() > 0) {
				//console.log("itemcache: dirty entries", retdata);
				core.dbcore.bulkinsert(configs.itemdb, retdata, false, function(err, body) {
					if(err) {
						console.log("ERROR: core.itemcache.save ", err.reason);
					}
					else {
						for(var i in body) {
							core.itemcache.internalhash[body[i].id]._rev = body[i].rev;
						}
						// Clear the dirty entries
						for(var key in core.itemcache.dirtykeys) {
							delete core.itemcache.dirtykeys[key];
						}
					}
				});
			}
		}
	},

	usercache: {
		internalhash: {},	// Cached data
		dirtykeys: {},		// Key to changed data
		reads: 0,
		writes: 0,

		prefill: function(users) {
			var i = 0;
			for(var key in users) {
				this.internalhash[key] = users[key];
				i++;
			}
			console.log("INFO: usercache prefilled with", i, "users.");
		},
		flush: function() { console.log("usercache emptied!"); this.internalhash = {}; this.dirtykeys = {}; this.reads = 0; this.writes = 0;},
		write: function(key, data) { this.writes++; console.log("write usercache", key); this.internalhash[key] = data; this.dirtykeys[key] = true; },
		read: function(key) { this.reads++; return this.internalhash[key]; },
		getCacheLength: function() { return Object.keys(this.internalhash).length },
		getDirtyLength: function() { return Object.keys(this.dirtykeys).length },
		save: function() {
			var retdata = [];
			var i = 0;
			for(var key in this.dirtykeys) {
				retdata[i] = this.internalhash[key];
				i++;
			}
			//console.log("writing:", retdata);
			// Update only if there are dirty entries
			if(this.getDirtyLength() > 0) {
				//console.log("usercache: dirty entries", retdata);
				core.dbcore.bulkinsert(configs.userdb, retdata, false, function(err, body) {
					var tmp = core.usercache.internalhash[body.id];
					if(err) {
						console.log("ERROR: core.usercache.save ", err);
					}
					else {
						//console.log("usercache: bulkinserted", err, body);
						// Clear the dirty entries
						//console.log(core.usercache.internalhash);
						for(var i in body) {
							core.usercache.internalhash[body[i].id]._rev = body[i].rev;
						}
						for(var key in core.usercache.dirtykeys) {
							delete core.usercache.dirtykeys[key];
						}
					}
				});
			}
		}
	},

    battlecache: {
		internalhash: {},	// Cached data
		dirtykeys: {},		// Key to changed data
		reads: 0,
		writes: 0,

		prefill: function(battles) {
			var i = 0;
			for(var key in battles) {
				this.internalhash[key] = battles[key];
				i++;
			}
			console.log("INFO: battlecache prefilled with", i, "battles.");
		},
		flush: function() { console.log("battlecache emptied!"); this.internalhash = {}; this.dirtykeys = {}; this.reads = 0; this.writes = 0;},
		write: function(key, data) { this.writes++; console.log("write battlecache", key); this.internalhash[key] = data; this.dirtykeys[key] = true; },
		read: function(key) { this.reads++; return this.internalhash[key]; },
		getCacheLength: function() { return Object.keys(this.internalhash).length },
		getDirtyLength: function() { return Object.keys(this.dirtykeys).length },
		save: function() {
			var retdata = [];
			var i = 0;
			for(var key in this.dirtykeys) {
				retdata[i] = this.internalhash[key];
				i++;
			}
			//console.log("writing:", retdata);
			// Update only if there are dirty entries
			if(this.getDirtyLength() > 0) {
				//console.log("usercache: dirty entries", retdata);
				core.dbcore.bulkinsert(configs.battledb, retdata, false, function(err, body) {
					var tmp = core.battlecache.internalhash[body.id];
					if(err) {
						console.log("ERROR: core.battlecache.save ", err);
					}
					else {

						// Clear the dirty entries
						for(var i in body) {
							core.battlecache.internalhash[body[i].id]._rev = body[i].rev;
						}
						for(var key in core.battlecache.dirtykeys) {
							delete core.battlecache.dirtykeys[key];
						}
					}
				});
			}
		}
	}

}

module.exports = core;