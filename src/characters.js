

function LoadObjectAsset( type, name ) 
{
    var asset = {};
    var ASSET_PREFIX = "../pics/";
    var str = ASSET_PREFIX+'walkcycle/'+type+'_'+name+'.png';
    asset['walk'] = str;
    asset['hurt'] = ASSET_PREFIX+'hurt/'+type+'_'+name+'.png';
    asset['slash'] = ASSET_PREFIX+'slash/'+type+'_'+name+'.png';
    asset['spellcast'] = ASSET_PREFIX+'spellcast/'+type+'_'+name+'.png';
    asset['thrust'] = ASSET_PREFIX+'thrust/'+type+'_'+name+'.png';
    asset['bow'] = ASSET_PREFIX+'bow/'+type+'_'+name+'.png';

    console.log('Asset:'+asset);

    $.each( asset, function(key,value){

        var tmp = {};
        var n = type+'_'+name+'_'+key;
        tmp[n] = [0,0];
        
        console.log( 'Crafty.sprite(64, '+value+',' + tmp +') - ' + n);
        Crafty.sprite(64, value, tmp);
    });
    

    /*Crafty.sprite(64, asset['hurt'], tmp);
    Crafty.sprite(64, asset['slash'],tmp);
    Crafty.sprite(64, asset['spellcast'], tmp);
    Crafty.sprite(64, asset['thrust'], tmp);
    Crafty.sprite(64, asset['bow'], tmp);*/
}



function CreateObject( name, xc,yc ){
    
    var gameObject = {
        entities: {
            body: Crafty.e("2D, DOM, Keyboard, LeftControls, Mouse,Ape, SpriteAnimation, BODY_" +name+'_walk_up')
                .attr({x:wx, y:yc, z:1})
                .leftControls(1)
                .animate( "walk_up", 1,0,8),
            head: Create.e("2D, DOM, SpriteAnimation, HEAD_" +name+'_walk_up')
                .attr({x:wx, y:yc, z:2})
                .animate( "walk_up", 1,0,8)
        }
    }


   return obj;
}





Crafty.c("LeftControls", {
    init: function() {
        this.requires('Multiway');
    },
    
    leftControls: function(speed) {
        this.multiway(speed, {W: -90, S: 90, D: 0, A: 180})
        return this;
    }
    

});


