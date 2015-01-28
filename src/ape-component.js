// transparent frame for collision with complex objects
Crafty.sprite(32, '../pics/transparent.png', {
    transparent: [0,0,2,2],
    transparent_tile: [0,0,1,1]
});

Crafty.sprite(800, '../assets/victory.png', {
    victory: [0,0]
});

Crafty.sprite(800, '../assets/defeat.png', {
    defeat: [0,0]
});


// Animation name, followed by sprites for required components.
Crafty.c('Ape', {
    _name: undefined,
    // Members for different animations 
    walk: null,
    thrust: null,
    slash: null,
    bow: null,
    hurt: null,
    spellcast: null,
    
    init: function()
    {
	    console.log('initializing members');
        // Right, this part is pretty *itchy:
        // Let's say I simply create this.walk structure for member directly,
        // and then initialize members within that this.walk upon component insert.
        // This makes sprites work pretty much ok, but this.walk object is shared for all 
        // entities that have Ape component, which makes playing animations pretty difficult
        // per-entity basis. That's why we need to do it this way. 
        this.walk = {
            body: undefined,
            quiver: null,
            head: null,
            torso: null,
            belt: null,
            hands: null,
            legs: null,
            feet: null,
            shield: null,
            arms:null
        }
        this.thrust= {
            body: null,
            quiver: null,
            head: null,
            torso: null,
            belt: null,
            hands: null,
            legs: null,
            feet: null,
            shield: null,
            weapon: null,
            arms:null
        }
        this.slash = {
            body: null,
            quiver: null,
            head: null,
            torso: null,
            belt: null,
            hands: null,
            legs: null,
            feet: null,
            shield: null,
            weapon: null,
            arms:null
        }
        this.bow = {
            body: null,
            quiver: null,
            head: null,
            torso: null,
            belt: null,
            hands: null,
            legs: null,
            feet: null,
            shield: null,
            weapon: null,
            arms:null
        }
        this.hurt = {
            body: null,
            quiver: null,
            head: null,
            torso: null,
            belt: null,
            hands: null,
            legs: null,
            feet: null,
            arms:null
        }
        this.spellcast = {
            body: null,
            quiver: null,
            head: null,
            torso: null,
            belt: null,
            hands: null,
            legs: null,
            feet: null,
            arms:null
        }
    },
    setupAnimation: function( animName )
    {
        var graphicsOffset = -16;
        var a = g_Animations[animName];
        if ( !a ) {
            console.error("No such animation '"+animName+"' preloaded!");
            return this;
        }
        var entity = this;
		$.each( a.walk, function(key,val){
            if ( a.walk[key] )
            {
			    var spriteDef = {};
			    var propname = a.name + '_' + key + '_walk_cycle';
			    spriteDef[propname] = [0,2];

			    // load sprite
			    Crafty.sprite(64, '../pics/walkcycle/'+val.image, spriteDef);
			    var tmp = entity.walk;

			    // remove previous one if it exists.
			    if ( entity.walk[key] ) { 
                    entity.walk[key].destroy();
			    } 
			    // this must contain an entity.
			    entity.walk[key] =  Crafty.e('2D, DOM, SpriteAnimation, Mouse, '+propname)
                    .animate("walk_up",1,0,8)
                    .animate("walk_left",1,1,8)
                    .animate("walk_down",1,2,8)
                    .animate("walk_right",1,3,8)
                    .animate("stand_up",0,0,1)
                    .animate("stand_left",0,1,1)
                    .animate("stand_down",0,2,1)
                    .animate("stand_right",0,3,1)
                    .attr({x:entity.x+graphicsOffset, y:entity.y, z:val.z});
			    entity.walk[key].visible = true;
			    entity.attach(entity.walk[key]);
            } else {
			    if ( entity.walk[key] ) { 
                    entity.walk[key].destroy();
			    }
            }
		});
		$.each( a.thrust, function(key,val){
            if ( a.thrust[key] )
			{
			    var spriteDef = {};
			    var propname = a.name + '_' + key + '_thrust_cycle';
			    spriteDef[propname] = [0,2];

			    // load sprite
			    Crafty.sprite(64, '../pics/thrust/'+val.image, spriteDef);
			    
			    // remove previous one if it exists.
			    if ( entity.thrust[key] ) { 
                    entity.thrust[key].destroy();
			    }
			    // this must contain an entity.
			    entity.thrust[key] =  Crafty.e('2D, DOM, SpriteAnimation, Mouse, '+propname);
			    // by default, invisible
			    entity.thrust[key].visible = false;

			    entity.thrust[key]
				    .animate("thrust_up",1,0,7)
				    .animate("thrust_left",1,1,7)
				    .animate("thrust_down",1,2,7)
				    .animate("thrust_right",1,3,7)
				    .attr({x:entity.x+graphicsOffset, y:entity.y, z:val.z});
			    entity.attach(entity.thrust[key]);
			} else {
			    if ( entity.thrust[key] ) { 
				    entity.thrust[key].destroy();
			    }
			}
			
		});
		$.each( a.slash, function(key,val){
            if ( a.slash[key] )
            {
			    var spriteDef = {};
			    var propname = a.name + '_' + key + '_slash_cycle';
			    spriteDef[propname] = [0,2];

			    // load sprite
			    Crafty.sprite(64, '../pics/slash/'+val.image, spriteDef);
			    
			    // remove previous one if it exists.
			    if ( entity.slash[key] ) { 
                    entity.slash[key].destroy();
			    }
			    // this must contain an entity.
			    entity.slash[key] =  Crafty.e('2D, DOM, SpriteAnimation, Mouse, '+propname);
			    // by default, invisible
			    entity.slash[key].visible = false;
			    entity.slash[key]
                    .animate("slash_up",1,0,5)
                    .animate("slash_left",1,1,5)
                    .animate("slash_down",1,2,5)
                    .animate("slash_right",1,3,5)
                    .attr({x:entity.x+graphicsOffset, y:entity.y, z:val.z});
			    entity.attach(entity.slash[key]);
            } else {
			    if ( entity.slash[key] ) { 
                    entity.slash[key].destroy();
			    }
            }
		    
		});
		$.each( a.bow, function(key,val){
            if ( a.bow[key] )
            {
			    var spriteDef = {};
			    var propname = a.name + '_' + key + '_bow_cycle';
			    spriteDef[propname] = [0,2];

			    // load sprite
			    Crafty.sprite(64, '../pics/bow/'+val.image, spriteDef);
			    
			    // remove previous one if it exists.
			    if ( entity.bow[key] ) { 
                    entity.bow[key].destroy();
			    }
			    // this must contain an entity.
			    entity.bow[key] =  Crafty.e('2D, DOM, SpriteAnimation, Mouse, '+propname);
			    // by default, invisible
			    entity.bow[key].visible = false;
			    entity.bow[key]
                    .animate("bow_up",1,0,12)
                    .animate("bow_left",1,1,12)
                    .animate("bow_down",1,2,12)
                    .animate("bow_right",1,3,12)
                    .attr({x:entity.x+graphicsOffset, y:entity.y, z:val.z});
			    entity.attach(entity.bow[key]);
            } else {
			    if ( entity.bow[key] ) { 
                    entity.bow[key].destroy();
			    }
            }
		    
		});
		$.each( a.hurt, function(key,val){
            if ( a.hurt[key] )
            {
			    var spriteDef = {};
			    var propname = a.name + '_' + key + '_hurt_cycle';
			    spriteDef[propname] = [0,2];

			    // load sprite
			    Crafty.sprite(64, '../pics/hurt/'+val.image, spriteDef);
			    
			    // remove previous one if it exists.
			    if ( entity.hurt[key] ) { 
                    entity.hurt[key].destroy();
			    }
			    // this must contain an entity.
			    entity.hurt[key] =  Crafty.e('2D, DOM, SpriteAnimation, Mouse, '+propname);
			    // by default, invisible
			    entity.hurt[key].visible = false;
			    entity.hurt[key]
                    .animate("hurt",1,0,5)
                    .attr({x:entity.x+graphicsOffset, y:entity.y, z:val.z});
			    entity.attach(entity.hurt[key]);
            } else {
			    if ( entity.hurt[key] ) { 
                    entity.hurt[key].destroy();
			    }
            }
		    
		});
		$.each( a.spellcast, function(key,val){
            if ( a.spellcast[key] )
            {
			    var spriteDef = {};
			    var propname = a.name + '_' + key + '_spellcast_cycle';
			    spriteDef[propname] = [0,2];

			    // load sprite
			    Crafty.sprite(64, '../pics/spellcast/'+val.image, spriteDef);
			    
			    // remove previous one if it exists.
			    if ( entity.spellcast[key] ) { 
                    entity.spellcast[key].destroy();
			    }

			    // this must contain an entity.
			    entity.spellcast[key] =  Crafty.e('2D, DOM, SpriteAnimation, Mouse, '+propname)
                    .animate("spellcast_up",1,0,6)
                    .animate("spellcast_left",1,1,6)
                    .animate("spellcast_down",1,2,6)
                    .animate("spellcast_right",1,3,6)
                    .attr({x:entity.x+graphicsOffset, y:entity.y, z:val.z});
			    // by default, invisible
			    entity.spellcast[key].visible = false;
			    entity.attach(entity.spellcast[key]);
            } else {
			    if ( entity.spellcast[key] ) { 
                    entity.spellcast[key].destroy();
			    }
            }
		});
        //console.log('We are down in setupAnimation');
        return this;
    }, // end ajax callback func
    enableAnimation: function(anim){
        $.each( anim, function(key,val){
            if ( anim[key] ) anim[key].visible = true;
        });
        return this;
    },
    disableAnimation: function(anim){
       
        $.each( anim, function(key,val){
            if ( anim[key] ) anim[key].visible = false;
        });
        return this;
    },
    hideAll: function(){
        this.disableAnimation(this.walk);
        this.disableAnimation(this.thrust);
        this.disableAnimation(this.slash);
        this.disableAnimation(this.bow);
        this.disableAnimation(this.hurt);
        this.disableAnimation(this.spellcast);
       /* $.each( myself.walk, function(key,val){
            if ( myself.walk[key] ) myself.walk[key].visible = false;
        });
        $.each( myself.thrust, function(key,val){
            if ( myself.thrust[key] ) myself.thrust[key].visible = false;
        });
        $.each( myself.slash, function(key,val){
            if ( myself.slash[key] ) myself.slash[key].visible = false;
        });
        $.each( myself.bow, function(key,val){
            if ( myself.bow[key] ) myself.bow[key].visible = false;
        });
        $.each( myself.hurt, function(key,val){
            if( myself.hurt[key] ) myself.hurt[key].visible = false;
        });
        $.each( myself.spellcast, function(key,val){
            if ( myself.spellcast[key] ) myself.spellcast[key].visible = false;
        });*/
        return this;
    },
    thrustAttack: function(direction) {

        this.hideAll();
        this.enableAnimation(this.thrust);
        if ( direction == 'left') 
        {
            if ( !this.thrust.body.isPlaying("thrust_left"))
            {
                for(var i in this.thrust)
                {
                    if ( this.thrust[i] ) {
                        this.thrust[i].animate("thrust_left", 20, 0);
                    }
                }
            }
        } 
        if ( direction == 'right' )
        {
            for(var i in this.thrust)
            {
                if ( this.thrust[i] ) {

                    this.thrust[i].animate("thrust_right", 20, 0);
                }
            }
        }
        if ( direction == 'up' )
        {
            for(var i in this.thrust)
            {
                if ( this.thrust[i] ) {
                    this.thrust[i].animate("thrust_up", 20, 1);
                }
            }
        }
        if ( direction == 'down' )
        {
            for(var i in this.thrust)
            {
                if ( this.thrust[i] ) {
                    this.thrust[i].animate("thrust_down", 20, 1);
                }
            }
        }
        Crafty.audio.play('miss');
        return this;
    }, 
    slashAttack: function(direction) {

        this.hideAll();
        this.enableAnimation(this.slash);
        if ( direction == 'left') 
        {
            for(var i in this.slash)
            {
                if ( this.slash[i] ) {
                    this.slash[i].stop().animate("slash_left", 20, 1);
                }
            }
        } 
        if ( direction == 'right' )
        {
            for(var i in this.slash)
            {
                if ( this.slash[i] ) {
                    this.slash[i].stop().animate("slash_right", 20, 1);
                }
            }
        }
        if ( direction == 'up' )
        {
            for(var i in this.slash)
            {
                if ( this.slash[i] ) {
                    this.slash[i].stop().animate("slash_up", 20, 1);
                }
            }
        }
        if ( direction == 'down' )
        {
            for(var i in this.slash)
            {
                if ( this.slash[i] ) {
                    this.slash[i].stop().animate("slash_down", 20, 1);
                }
            }
        }
        return this;
    },
    startWalking: function (direction, speed) {

        this.hideAll();
        this.enableAnimation(this.walk);
        if (direction.x < 0) {
            if (!this.walk.body.isPlaying("walk_left")){
                for(var i in this.walk)
                {
                    if ( this.walk[i] ) this.walk[i].stop().animate("walk_left", speed, -1);
                }
            }

        }
        if (direction.x > 0) {
            if (!this.walk.body.isPlaying("walk_right")){
                for(var i in this.walk)
                {
                    if ( this.walk[i]) this.walk[i].stop().animate("walk_right", speed, -1);
                }
            }

        }
        if (direction.y < 0) {
            if (!this.walk.body.isPlaying("walk_up")){
                for(var i in this.walk)
                {
                    if ( this.walk[i]) this.walk[i].stop().animate("walk_up", speed, -1);
                }
            }

        }
        if (direction.y > 0) {
            if (!this.walk.body.isPlaying("walk_down")){
                for(var i in this.walk)
                {
                    if ( this.walk[i]) this.walk[i].stop().animate("walk_down", speed, -1);
                }
            }

        }
        if(!direction.x && !direction.y) {
            for(var i in this.walk)
            {
                if ( this.walk[i]) this.walk[i].stop();
            }
        }
	    Crafty.audio.play("step", 1, 0.15);

    },
    
    fallDown: function(speed, nosound){
        this.hideAll();
        this.enableAnimation(this.hurt);
        if (!this.walk.body.isPlaying("hurt")){
            for(var i in this.hurt)
            {
                if ( this.hurt[i]) this.hurt[i].stop().animate("hurt", speed, 0);
            }
            // play sound by default
            if (nosound === undefined )
                Crafty.audio.play("die");
        }
    },
    
    stopWalking: function() {
        // halt animations
        for(var i in this.walk)
        {
            if ( this.walk[i]) this.walk[i].stop().animate("stand_down", 1, 0);

        }

    },
    
    Ape: function(n) {
        this.name = n;
        //setup animations
        this.requires("Collision, Grid")
        //change direction when a direction change event is received
          
            .bind('Moved', function(from) {
                
                if(this.hit('solid')){
                    this.attr({x: from.x, y:from.y});
                } 

            })
            .onHit("fire", function() {
                this.destroy();
  			    // Subtract life and play scream sound :-)
            });
        return this;
    }
});