
Crafty.c('Targetpos', {
    targetx: 0,
    targety: 0,
    setTarget: function(x,y){
        this.targetx = x;
        this.targety = y;
        return this;
    }
});

// Create debouncer for DisplayFadingText()
var DisplayFadingText = _.debounce(DisplayFadingTextDebounced, 300);

function DisplayFadingTextDebounced( text, xpos, ypos, size, font )
{

    if ( !size ) size="34pt";
    if ( !font) font ="Impact";

    var e = Crafty.e("2D, DOM, Targetpos, Tween, Text")
        .attr({alpha: 1.0, x:xpos, y:ypos,z:8})
        .setTarget(xpos,ypos-100)
        .text(text)
        .css({
            "font-family":font,
            "font-size":size,
            "font-weight":"bold"
        })
        .bind("TweenEnd", function(){
            this.destroy();
        });
    e.tween({alpha: 0.0, x:e.targetx, y:e.targety}, 100);
}
