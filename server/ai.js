var configs = require('../json/configs.json');
var aiPassword = configs.aipassword;

/* handles messages from PARENT */
process.on('message', function(message) {

    switch(message.name) {
        case 'AI_INIT':
            ai.init();
            break;

        case 'CHALLENGE_REQ':
            ai.replyChallenge(message,true); // always accept challenge, add random delay before accepting? Should people know they af
            
            break;
        case 'CHALLENGE_RES':
            ai.handleChallengeResponse( message );
        break;
        case 'CREATE_USER_RESP':
            process.send(JSON.stringify({type:"LOGIN_REQ", name:"LOGIN_REQ",data:{username: message.username, "password": aiPassword }}));
            break;

        case 'WAKE_UP':
           ai.enterArena(message.username, message.ingame);
        break;
        case 'MOVE_UPDATE':
           ai.handleMoveUpdate(message);
        break;
        case 'MOVE_RES':
           ai.handleMoveResponse(message);
        break;
        case 'UPDATE':
           ai.update(message.tick);
        break;
        case 'BATTLE_START':
           ai.handleBattleStart(message);
        break;
        case 'STAND_DOWN':
           ai.handleBattleExit(message);
        break;
        case 'ATTACK_RESP':
           ai.handleAttackResp(message);
        break;
        case 'BATTLE_OVER':
           ai.handleBattleOver(message);
        break;
        default:
          ai.handleMessage(message);
    }

});




var ai = {

    teams: {}, /* player teams */
    
    
    init: function(){

        for( var i in configs.npcs ){
            console.log("Registering computer team: "+ configs.npcs[i]);
            process.send(JSON.stringify({type:"CREATE_USER_REQ", name:"CREATE_USER_REQ",data:{ username:configs.npcs[i], "password": aiPassword, "ai": true }}));
        }
    },
    
    handleChallengeResponse: function(msg){
        // select battle team - this needs to be handled before live player 
        // enters arena, otherwise (s)he won't see AI enemy players.
        if ( msg.response == "READY_FOR_WAR" ){
	        this.selectBattleTeam(msg.battle.defender.name, [ msg.battle.defender.gladiators[0].name] );
        }
    },
    
    setGladiatorPosition: function(aiteam, gladiator, newpos)
    {
        // get previous position
        var oldpos = gladiator.battledata.pos;
        // update pathfinding matrix
        aiteam.battle.map[oldpos[1]][oldpos[0]] = 0;
        aiteam.battle.map[newpos[1]][newpos[0]] = 1;
        // update spatial graph
        aiteam.battle.spatialgraph[oldpos[1]][oldpos[0]] = 0;
        aiteam.battle.spatialgraph[newpos[1]][newpos[0]] = gladiator.name;
        // store position 
        gladiator.battledata.pos = newpos;
        
    },
    
    handleMoveResponse: function(msg){
        console.log('AI handling move response', msg.path);

        var g = this.getGladiatorByName( this.teams[msg.username], msg.gladiator );
        g.battledata["path"] = msg.path;

        
    },

    handleMoveUpdate: function(msg)
    {
        console.log('AI is handling move update...');
        for( var ai in this.teams ){

            if ( this.teams[ai].battle === undefined ) continue;

            if ( this.teams[ai].ingame == msg.battleid )
            {
                if ( msg.username == this.teams[ai].battle.challenger.name ) {
                    
                    var gladiators = this.teams[ai].battle.challenger.gladiators;
                    for( var g in gladiators)
                    {
                        if ( gladiators[g].name == msg.gladiator )
                        {
                            console.log('Gladiator',  gladiators[g].name, "now in", msg.newpos );

                            /*var pos = gladiators[g].battledata.pos;
                            this.teams[ai].battle.map[pos[1]][pos[0]] = 0;
                            pos = gladiators[g].battledata.pos = msg.pos;
                            this.teams[ai].battle.map[pos[1]][pos[0]] = gladiators[g].name;*/
                            
                            this.setGladiatorPosition(this.teams[ai], gladiators[g], msg.newpos);
                        }
                    }
                } else if ( msg.username == this.teams[ai].battle.defender.name ) {
                    
                    var gladiators = this.teams[ai].battle.defender.gladiators;
                    for( var g in gladiators)
                    {
                        if ( gladiators[g].name == msg.gladiator )
                        {
                            console.log('Gladiator',  gladiators[g].name, "now in", msg.newpos );
                            /*var pos = gladiators[g].battledata.pos;
                            this.teams[ai].battle.map[pos[1]][pos[0]] = 0;
                            pos = gladiators[g].battledata.pos = msg.pos;
                            this.teams[ai].battle.map[pos[1]][pos[0]] = gladiators[g].name;*/
                            this.setGladiatorPosition(this.teams[ai], gladiators[g], msg.newpos);
                        }
                    }
                }
            }
        }
    },

    handleBattleStart: function(battle)
    {
        console.log('AI received BATTLE_START:' /*+ data[0]*/);
        
        // convert battle map into spatial positioning map
        for(var g in battle.challenger.gladiators)
        {
            for( var bg in battle.challenger.battleteam ){
                var gladiator = battle.challenger.gladiators[g];
                if ( gladiator.name == battle.challenger.battleteam[bg] )
                {
                    var row = gladiator.battledata.pos[1];
                    var column = gladiator.battledata.pos[0];
                    battle.spatialgraph[row][column] = gladiator.name;
                }
            }
        }

        this.teams[battle.defender.name]["battleteam"] = [];
        
        for(var g in battle.defender.gladiators)
        {
            for( var bg in battle.defender.battleteam ){
                var gladiator = battle.defender.gladiators[g];
                if ( gladiator.name == battle.defender.battleteam[bg] )
                {
                    var row = gladiator.battledata.pos[1];
                    var column = gladiator.battledata.pos[0];
                    battle.spatialgraph[row][column] = gladiator.name;
                    gladiator.battledata["ai"] = new MoronController( this.teams[battle.defender.name],
                                                                      gladiator);
                    this.teams[battle.defender.name]["battleteam"].push( gladiator );
                }
            }
        }
        // store battle into ai team property
        this.teams[battle.defender.name]["battle"] = battle;


    },
    
    handleBattleExit: function( msg ){
        delete this.teams[msg.username]["battle"];
        console.log('AI battle exit: ', msg.username, "now idle.");
    },
    
    handleBattleOver: function(msg){
        // AI is always defender
        delete this.teams[msg.defender]["battle"];
        console.log('AI battle exit: ', msg.defender, "now idle");
    },
    
    handleAttackResp: function(msg) {

        console.log('AI ATTACK_RESP custom handler');
        
        for( var ai in this.teams ){
            if ( this.teams[ai].ingame == msg.ingame )
            {
                if ( this.teams[ai] === undefined ) continue;

                var g = this.getGladiatorByName(this.teams[ai], msg.targetid);
		        if ( g ) {
                    g.health -= msg.damage;
                    // determine if dead and change state.
                    if ( g.health <= 0)
                    {
                        // send NO_ENEMY to attacker for retrieving another target.
                        var attacker = this.getGladiatorByName(this.teams[ai], msg.attackerid);
                        if ( attacker ) {
                            console.log('Sending message', 'NO_ENEMY');
                            if ( attacker.battledata.ai !== undefined )
                                attacker.battledata.ai.onMessage('NO_ENEMY');
                        }
                    }
		        }
            }
        }
        
    },
    
    // AI enemy will always be a challenger.
    isEnemy: function( battleid, gladiatorname )
    {
        for( var ai in this.teams ){
            if ( this.teams[ai].ingame == battleid )
            {
                for( var g in this.teams[ai].battle.challenger.gladiators)
                {
                    if ( this.teams[ai].battle.challenger.gladiators[g].name == gladiatorname)
                        return true;
                }
            }
        }
        return false;
    },

    getGladiatorByName: function(ai, gladiatorname)
    {
        // battle might be deleted due BATTLE_OVER already.
        if ( ai.battle !== undefined)
        {
            for(var g in ai.battle.defender.gladiators)
            {
                if ( ai.battle.defender.gladiators[g].name == gladiatorname ) 
                    return ai.battle.defender.gladiators[g];
            }
            
            for(var g in ai.battle.challenger.gladiators)
            {
                if ( ai.battle.challenger.gladiators[g].name == gladiatorname ) 
                    return ai.battle.challenger.gladiators[g];
            }
        }
        return null;
    },
   

    update: function(tick){

        for( var ai in this.teams ){

            if ( this.teams[ai].battle === undefined ) continue;
            
            var battleteam = this.teams[ai].battleteam;
            if ( battleteam ) {
                for ( var g in battleteam)
                {
                    battleteam[g].battledata.ai.update(tick);
                }
            }
        }
    },

    /* Registers a game for AI to be handled.  */
    registerPlayerToGame: function(aiPlayer, battleid) {
        this.teams[aiPlayer] = { 
            ingame: battleid, 
            name: aiPlayer
        };

    },

    selectBattleTeam: function(uname, names){

        // pretty straightforward and crude battle team selection logic. Only single ai.
        var msg = {
            username: uname,
            password: "pass",
            gladiators: []
        }
        for ( var i = 0;i<4;i++){
            if ( names[i] !== undefined )
                msg.gladiators.push(names[i]);
        }
        console.log('AI selecting battle team:', JSON.stringify(names));
        process.send( JSON.stringify({type:"BATTLETEAM_SELECT_REQ", name:"BATTLETEAM_SELECT_REQ",data: msg}));
    },
    
    enterArena: function(uname, battleid) {
        console.log('AI entering arena as ' + uname);
        // enter arena, only single ai.
        process.send(JSON.stringify({type:'ENTER_ARENA_REQ', name:'ENTER_ARENA_REQ', data: {username: uname, ingame: battleid}}));
        this.registerPlayerToGame(uname, battleid);
    },

    replyChallenge: function(msg,reply)
    {
        //console.log("Ai Replying to challenge: "+msg+","+reply);
        for( i in configs.npcs ) {
            if(msg.defender == configs.npcs[i]) {
                process.send(JSON.stringify({
                    type:"CHALLENGE_RES",
                    name:"CHALLENGE_RES",
                    data:{
                    username:configs.npcs[i],
                    challenger:msg.challenger,
                    response:(reply == true ? "OK" : "NOK")
                    }
                }));

            }
        }
    },

    handleMessage: function(message) {
        console.log('ai is handling message ' + JSON.stringify(message.name));
        

        // Do some message handling here
        /* ... */

        // Send message back to PARENT process
        //process.send(JSON.stringify({type:"SOME_RESPONSE", name: "SOME_RESPONSE", data: "Thank you for your " + message.name}));

    },
    



}

function AiState(aiController) {
    this.controller = aiController;
    this.update =  function() {}
    this.onMessage = function(msg) {}
}


function MoronController(aiteam, gladiator) {

    this.target = null;
    this.state = null;
    this.team = aiteam;
    this.gladiator = gladiator;
    this.attackTimer = 0;
    
    
    

    var controller = this;

    // helpers for calling current state update / onMessage
    this.update = function(tick){

        if ( controller.gladiator.health <= 0 ) 
            this.onMessage('GRIM_REAPER');
        
        controller.state.update(tick);
    }
    
    this.onMessage = function(msg){
        controller.state.onMessage(msg);
    }

    this.IDLE            = new AiState(this);
    this.SEEK_ENEMY      = new AiState(this);
    this.ATTACK          = new AiState(this);
    this.MOVE_INTO_RANGE = new AiState(this);
    this.DEAD            = new AiState(this);

    this.IDLE.update = function(){
        console.log('AI - I am idle.');
    };
    
    this.SEEK_ENEMY.update = function() {
        
        var gladiators = controller.team.battle.challenger.gladiators;
        var closest = null;
        var distance;
        console.log(controller.gladiator.name, 'seeking enemies...');

        for( var g in gladiators)
        {
            var other = gladiators[g];
            // skip myself
            if ( gladiator.name  == other.name ) continue;
            // skip dead ones
            if ( other.health <= 0 ) continue;
            // some sanity check 
            if ( other.battledata === undefined ) continue;            

            var xdiff = other.battledata.pos[0] - gladiator.battledata.pos[0];
            var ydiff = other.battledata.pos[1] - gladiator.battledata.pos[1];
            var otherDistance = Math.sqrt(Math.pow(xdiff)+Math.pow(ydiff));

            if ( closest == null ) {
                closest = other;
                distance = otherDistance;
                continue;
            } 
            
            if ( otherDistance < distance  ) {
                closest = other;
                distance = otherDistance;
            }
        }
        
        controller.target = closest;
        controller.onMessage( (controller.target == null) ? 'ENEMY_NOT_FOUND' : 'ENEMY_FOUND');

    };

    this.SEEK_ENEMY.onMessage = function(msg){
        console.log(msg);
        switch(msg){
        case 'ENEMY_NOT_FOUND':
            controller.state = controller.IDLE;

            break;
        case 'ENEMY_FOUND':
            controller.state = controller.MOVE_INTO_RANGE;
            break;
        case 'GRIM_REAPER':
            controller.state = controller.DEAD;
            break;
        }
    };
    
    this.MOVE_INTO_RANGE.update = function(){
        var xdiff = Math.floor(Math.abs(controller.target.battledata.pos[0] - controller.gladiator.battledata.pos[0])); 
        var ydiff = Math.floor(Math.abs(controller.target.battledata.pos[1] - controller.gladiator.battledata.pos[1])); 
        
        var inMeleeRange = ((xdiff == 1) && (ydiff == 0)) ||
                           ((xdiff == 0) && (ydiff == 1));
        if ( inMeleeRange ){
            controller.state.onMessage('IN_ATTACK_RANGE');
            
        } else {
            
            //gas.send('MOVE_REQ', [ JSON.stringify( {username: player, battleid: g_ingame, gladiator: g_currentGladiator.gladiator.name, from: {x: g_currentGladiator.tile_x, y:g_currentGladiator.tile_y}, to: {x: xpos, y: ypos} })]);
            if ( controller.gladiator.battledata.path == undefined ||
                 controller.gladiator.battledata.path.length <= 1)
            { 
                delete controller.gladiator.battledata.path;
                process.send(JSON.stringify({
                    type:"MOVE_REQ",
                    name:"MOVE_REQ",
                    data:{
                        username: controller.team.name,
                        battleid: controller.team.ingame,
                        gladiator: controller.gladiator.name,
                        from: { x: controller.gladiator.battledata.pos[0],
                                y: controller.gladiator.battledata.pos[1] },
                        to: { x: controller.target.battledata.pos[0],
                              y: controller.target.battledata.pos[1] }
                    }
                }));

            } else {
                
                // construct message
                var msg = {
                    name: "MOVE_UPDATE",
                    type: "MOVE_UPDATE",
                    username: controller.team.name,
                    battleid: controller.team.ingame,
                    gladiator: controller.gladiator.name,
                    oldpos: controller.gladiator.battledata.path[0],
                    newpos: controller.gladiator.battledata.path[1]
                }
                // send update
                process.send(JSON.stringify({name: "MOVE_UPDATE", type: "MOVE_UPDATE", data: msg}));
                // remove first coordinate
                controller.gladiator.battledata.path.splice(0,1);
                if ( controller.gladiator.battledata.path.length <= 1 ){
                    delete controller.gladiator.battledata.path;
                }
            }
        }
    }

    this.MOVE_INTO_RANGE.onMessage = function(msg){
        switch(msg){
        case 'IN_ATTACK_RANGE':
            controller.state = controller.ATTACK;
            break;
        case 'GRIM_REAPER':
            controller.state = controller.DEAD;
            break;
        }
    }
    
    this.ATTACK.update = function(tick) {
        // skip attack if no target has been set.
        if ( controller.target == null ) {
            console.log('No enemy nearset, starting to seek...');
            controller.ATTACK.onMessage('NO_ENEMY');
            return;
        }
        var xdiff = Math.floor(Math.abs(controller.target.battledata.pos[0] - controller.gladiator.battledata.pos[0])); 
        var ydiff = Math.floor(Math.abs(controller.target.battledata.pos[1] - controller.gladiator.battledata.pos[1])); 
        
        var inMeleeRange = ((xdiff == 1) && (ydiff == 0)) ||
                           ((xdiff == 0) && (ydiff == 1));
        console.log('xdiff:', xdiff, 'ydiff:',ydiff);
        if ( inMeleeRange == false ){
            console.log('Target not close enough', controller.target.name);
            controller.ATTACK.onMessage('NO_ENEMY');
            return;
        }
        
        if ( controller.target.health <= 0 ) {
            console.log('Target dead, NEXT!');
            controller.onMessage('NO_ENEMY');
            return;
        }

        if ( ai.isEnemy(controller.team.ingame, controller.target.name) )   
        {
            // restrict attack timer a bit
            if ( controller.attackTimer < tick )
            {
                console.log('AI found an enemy nearby!', controller.target.name);
                var attackMsg = {
                    type: "ATTACK_REQ",
                    name: "ATTACK_REQ",
                    username: controller.team.name,
                    attackerid: controller.gladiator.name,
                    targetid: controller.target.name,
                    battleid: controller.team.ingame
                }

                
                process.send( JSON.stringify({name: "ATTACK_REQ", type: "ATTACK_REQ", data: attackMsg}) );

                // TODO create proper timer
                controller.attackTimer = tick + (20000/3)/controller.gladiator.nimbleness;
            } else {
                console.log('atimer ', controller.attackTimer, ' tick ', tick);
            }

        }
        else {
            console.log('Target is not an enemy', controller.target);
            controller.state.onMessage('NO_ENEMY');
        }
        
    };
    
    this.ATTACK.onMessage = function(msg){
        switch(msg)
        {
        case 'NO_ENEMY':
            controller.state = controller.SEEK_ENEMY;
            break;
        case 'GRIM_REAPER':
            controller.state = controller.DEAD;
            break;
        default:
            break;
        }

    };
    
    // default state is idle
    this.state = this.SEEK_ENEMY;

} // MoronAI
