// Configuration
var GRAPHIC_ID = '#example';
var GRAPHIC_DATA_URL = 'assets/playoffs.json';
var GRAPHIC_DEFAULT_WIDTH = 750;
var MOBILE_THRESHOLD = 660;
var seriesheight = 60;
var lineheight = 24;

var series_list;
var teams;

var percent = d3.format(",.0%");

var GRAPHIC_MARGIN = {
    top: seriesheight*1.5,
    right: 0,
    bottom: 0,
    left: 0
};

// Globals
var $graphic = null;
var pymChild = null;
var graphicData = null;
var matrices = {};
var legendData = null;
var isMobile = false;
var total_sim = 0;

var leagues = ['al','nl','ws']
var rounds = ['wc','lds','lcs','ws']

var series_games = d3.scaleOrdinal()
    .domain(rounds)
    .range([1,5,7,7])

var round_names = d3.scaleOrdinal()
    .domain(rounds)
    .range(['Wild Card','Division Series','Championship Series','World Series','Champion'])

var league_offset = d3.scaleOrdinal()
    .domain(leagues)
    .range([0,seriesheight*3,seriesheight*2])

var lds_offset = function(seriesid) {
    if (seriesid==2||seriesid==6||seriesid==3){ // lds second series, al lcs
        return seriesheight
    } else if (seriesid==7){ //lcs series 
        return 0
    } else if (seriesid==8) { // world series
        return 0
    } else if (seriesid==9) { //winner
        return lineheight/2
    } else {
        return 0
    }
}

var log5 = function(team1pct,team2pct,H){
    probability = (team1pct - team1pct*team2pct)/(team1pct+team2pct-2*team1pct*team2pct)
    probabilityH = 1 / (1+team2pct*(1-team1pct)*(1-homefield)/team1pct/homefield/(1-team2pct))
    console.log(probability,probabilityH)

    return probability;
} 

/*
 * Initialize graphic
 */
var onWindowLoaded = function() {
    $graphic = $(GRAPHIC_ID);

    if (Modernizr.svg) {
        d3.json(GRAPHIC_DATA_URL, onDataLoaded);
        d3.json('assets/matrix_1.json',function(error,data){
            matrices.matrix_1=data;
        })
        d3.json('assets/matrix_5.json',function(error,data){
            matrices.matrix_5=data;
        })
        d3.json('assets/matrix_7.json',function(error,data){
            matrices.matrix_7=data;
        })
    } else {
        pymChild = new pym.Child({});
    }
}

/*
 * CSV loaded
 */
var onDataLoaded = function(error, data) {
    graphicData = data;
    processPlayoffs(data)

    pymChild = new pym.Child({
        renderCallback: render
    });
}

/*
 * Render the graphic(s)
 */
var render = function(containerWidth) {
    $graphic = $(GRAPHIC_ID);
    
    // Fallback if page is loaded outside of an iframe
    if (!containerWidth) {
        containerWidth = $graphic.parent().width();
    }

    if (containerWidth <= MOBILE_THRESHOLD) {
        isMobile = true;
    } else {
        isMobile = false;
    }

    // Clear out existing graphic (for re-drawing)
    $graphic.empty();

    drawGraph(containerWidth, GRAPHIC_ID, graphicData);

    // Resize iframe to fit
    if (pymChild) {
        pymChild.sendHeight();
    }
}

$( window ).resize(function(){
    render();
})

var processPlayoffs = function(data){
    series_list = [];
    teams = []
    count = 0;

    $.each(data, function(league, rounds) {
        $.each(rounds, function(round,value) {

            if (round == 'lds') {
                series_count = 2
            } else {
                series_count = 1
            }

            $.each(value.teams, function(index, team) {
                teams.push(team)            
            })

            if (value.teams.length > 0){
                topteam = value.teams[0];
                bottomteam = value.teams[1];
            }

            for (i=0;i<series_count;i++) {
                adjustment = i*1

                if (value.teams.length > 0 && i==0 && series_count == 2){
                    topteam = value.teams[0];
                    bottomteam = undefined;
                } else if (value.teams.length > 0 && i==1 && series_count == 2) {
                    topteam = value.teams[1];
                    bottomteam = value.teams[2];
                } else if (value.teams.length > 0 && i==0 && series_count == 1) {
                    topteam = value.teams[0];
                    bottomteam = value.teams[1];
                } else {
                    topteam = undefined;
                    bottomteam = undefined;
                }

                wins_needed = Math.round(series_games(round)/2)

                wins = value.wins;

                series_list.push({
                    seriesid: count,
                    round: round,
                    league: league,
                    topteam: topteam,
                    bottomteam: bottomteam,
                    wins:wins,
                    wins_needed: wins_needed,
                    games:[],
                    next_round:value.next_round
                });

                count++;
            }

        });
    });
}

/*
 * DRAW THE GRAPH
 */
var drawGraph = function(graphicWidth, id, data) {
    var graph = d3.select(id);

    var thebutton = graph.append("div")
        .attr("class", "thebutton")
        .html('<button class="btn btn-default btn-sm" type="submit">Play ball!</button>');

    var thebutton1000 = graph.append("div")
        .attr("class", "thebutton1000")
        .html('<button class="btn btn-default btn-sm" type="submit">Play ball (1,000x)!</button>');

    var reset = graph.append("div")
        .attr("class", "reset")
        .html('<button class="btn btn-default btn-sm" type="submit">Reset</button>');

    //formatters
    var fmtRound = d3.format('.2f');

    // Desktop / default
    var aspectWidth = 16;
    var aspectHeight = 9;
    var ticksX = 10;
    var ticksY = 10;
    var text_margin = 8;
    var row_number = 5
    var series_multiplier = 6;
    var column_percent = 0.30;

    // Mobile
    if (isMobile) {
        aspectWidth = 4;
        aspectHeight = 3;
        ticksX = 5;
        ticksY = 5;
        row_number = 3;
        series_multiplier=7;
    }

    var classify = function(str) {
        return str.toLowerCase()
            .replace(/\s+/g, '-')           // Replace spaces with -
            .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
            .replace(/\-\-+/g, '-')         // Replace multiple - with single -
            .replace(/^-+/, '')             // Trim - from start of text
            .replace(/-+$/, '');            // Trim - from end of text
    }

    // define chart dimensions
    var width = graphicWidth - GRAPHIC_MARGIN['left'] - GRAPHIC_MARGIN['right'];
    // var height = Math.ceil((graphicWidth * aspectHeight) / aspectWidth) - GRAPHIC_MARGIN['top'] - GRAPHIC_MARGIN['bottom'];
    var height = seriesheight*series_multiplier

    var series_offset = d3.scaleOrdinal()
        .domain(rounds)
        .range([0,width*column_percent,width*column_percent*2,width*column_percent*2])

    // draw the chart
    var bracket = graph.append('svg')
		.attr('width', width + GRAPHIC_MARGIN['left'] + GRAPHIC_MARGIN['right'])
		.attr('height', height + GRAPHIC_MARGIN['top'] + GRAPHIC_MARGIN['bottom'])
        .append('g')
            .attr('transform', 'translate(' + GRAPHIC_MARGIN['left'] + ',' + GRAPHIC_MARGIN['top'] + ')');

    // draw top titles
    american = bracket.append("g")

    american.append('text')
        .attr("x", 0)
        .attr("y", 0-lineheight*2)
        .attr("class", "american")
        .text("AMERICAN");

    national = bracket.append("g")

    national.append('text')
        .attr("x", 0)
        .attr("y", seriesheight*3-lineheight*2)
        .attr("class", "national")
        .text("NATIONAL");

    national.append('text')
        .attr("x", 0)
        .attr("y", seriesheight*5)
        .attr("class", "total")
        .text("TOTAL WINS");

    var clear_bracket = function(callback){
        console.log('clear_bracket')

        series = bracket.selectAll('.series')
        winnerbox = bracket.selectAll('.winner')
        team_scorecard = bracket.selectAll('.team')

        if (typeof series != "undefined") {
            series.remove();
        }

        if (typeof winnerbox != "undefined") {
            winnerbox.remove();
        }

        if (typeof team_scorecard != "undefined") {
            team_scorecard.remove();
        }
        callback();
    }

    var create_bracket = function() {

        winnerbox = bracket.append("g")
            .data([{winner: undefined}])
            .attr("class", "winner");

        winnerbox
            .append("text")
            .attr("x", width*0.75+text_margin)
            .attr("y", league_offset('ws')+lds_offset(9));

        // round_labels = bracket.selectAll('.round_labels')
        //     .data(rounds)
        //     .enter()
        //     .append('g')
        //         .attr("class", function(d) { return "round " +d; });

        // round_labels.append('text')
        //     .attr("x", function(d){return series_offset(d)})
        //     .attr("y", -lineheight*1.5)
        //     .attr("class", "top")
        //     .text(function(d) { 
        //         if (isMobile) {
        //             return round_names(d); 
        //         } else {
        //             return round_names(d); 
        //         }
        //     });

        series = bracket.selectAll('.series')
            .data(series_list)
            .enter()
            .append('g')
                .attr("class", function(d) { return "series " +d.league+' '+d.round +' series'+d.seriesid; });

        series.append("line")
            .attr("x1", function(d){return series_offset(d.round)})
            .attr("x2", function(d){return series_offset(d.round)+width*column_percent})
            .attr("y1", function(d,i){return league_offset(d.league)+lds_offset(d.seriesid)-lineheight})
            .attr("y2", function(d,i){return league_offset(d.league)+lds_offset(d.seriesid)-lineheight})
            .attr("class", "top");

        series.append("line")
            .attr("x1", function(d){return series_offset(d.round)})
            .attr("x2", function(d){return series_offset(d.round)+width*column_percent})
            .attr("y1", function(d,i){return league_offset(d.league)+lds_offset(d.seriesid)+lineheight*1.5})
            .attr("y2", function(d,i){return league_offset(d.league)+lds_offset(d.seriesid)+lineheight*1.5})
            .attr("class", "bottom");

        series.append("line")
            .attr("x1", function(d){return series_offset(d.round)+width*column_percent})
            .attr("x2", function(d){return series_offset(d.round)+width*column_percent})
            .attr("y1", function(d,i){return league_offset(d.league)+lds_offset(d.seriesid)-lineheight})
            .attr("y2", function(d,i){return league_offset(d.league)+lds_offset(d.seriesid)+lineheight*1.5})
            .attr("class", "end");

        series.append('text')
            .attr("x", function(d){return series_offset(d.round)+text_margin})
            .attr("y", function(d,i){return league_offset(d.league)+lds_offset(d.seriesid)})
            .attr("class", "top")
            .text(function(d) { 
                if (d.topteam) {
                    if (isMobile) {
                        return d.topteam.nickname; 
                    } else {
                        return d.topteam.city + " " + d.topteam.nickname;
                    }
                }
            });

        series.append('text')
            .attr("x", function(d){return series_offset(d.round)+text_margin})
            .attr("y", function(d,i){return league_offset(d.league)+lds_offset(d.seriesid)+lineheight})
            .attr("class", "bottom")    
            .text(function(d) { 
                if (d.bottomteam) {
                    if (isMobile) {
                        return d.bottomteam.nickname; 
                    } else {
                        return d.bottomteam.city + " " + d.bottomteam.nickname; 
                    }
                }
            });

        team_scorecard = bracket.selectAll('.team')
            .data(teams)
            .enter()
            .append('g')
                .attr("class", function(d) { return "team " +classify(d.nickname); });

        team_scorecard.append("line")
            .attr("x1", function(d){return series_offset('wc')})
            .attr("x2", function(d){return series_offset('wc')+width*column_percent})
            .attr("y1", function(d,i){return seriesheight*5+lineheight*0.5})
            .attr("y2", function(d,i){return seriesheight*5+lineheight*0.5})
            .attr("class", "end");

        team_scorecard.append('text')
            .attr("x", function(d,i){return (i%row_number)*(width/row_number)})
            .attr("y", function(d,i){
                return seriesheight*5.5+lineheight*(Math.floor(i/row_number));
            })
            .attr("class", "team-text")
            .text(function(d) { 
                return d.nickname
            });
    }

    var play_series = function(topteam,bottomteam,series) {
          if (topteam.league=='nl' & bottomteam.league=='al') {
              homefield = -1
          } else if (topteam.league=='al' & bottomteam.league=='nl'){
              homefield = 0
          } else if (topteam.wildcard == true & bottomteam.wildcard != true) {
              homefield = -1
          } else if (topteam.win<bottomteam.win) {
              homefield = -1
          } else {
              homefield = 0
          }

        
        games = series_games(series.round);
        H = ((wins+1+homefield) * .54 + (wins-homefield) * .46)/games
        topteam_pct = log5(topteam.win,bottomteam.win,H);

        console.log(topteam.nickname,bottomteam.nickname,topteam_pct)
        topteam.wins = 0;
        bottomteam.wins = 0;

        matrix_id = 'matrix_'+games
        console.log(matrix_id, matrices)

        matrix = matrices[matrix_id]

        bottomteam.probability = matrix[topteam.nickname][bottomteam.nickname]
        topteam.probability = matrix[bottomteam.nickname][topteam.nickname]

        console.log(topteam.probability,bottomteam.probability)

        for (i=0;i<games;i++) {
            number = Math.random();

            if (number <= topteam_pct) {
                topteam.wins++;
                console.log(number,topteam_pct,topteam.nickname +' Win! '+topteam.wins);
                
                if (topteam.wins == series.wins_needed){
                    series.winner = topteam;
                    advance(topteam,series);
                    return;
                };
                    
            } else {
                bottomteam.wins++;
                console.log(number,topteam_pct,bottomteam.nickname+' Win! '+bottomteam.wins); 

                if (bottomteam.wins == series.wins_needed){
                    series.winner = bottomteam
                    advance(bottomteam,series);
                    return;
                };
            }

        }

    }

    var advance = function(winner,series) {
        winner = JSON.parse(JSON.stringify(winner))
        console.log(winner.city+' advances to the '+series.next_round)
        if (series.next_round == 'ws') {
            next_series_id = 8;
            if (series.league == 'al'){is_top = true;}
            if (series.league == 'nl'){is_top = false;}
        } else if (series.next_round == 'lcs') {
            if (series.league == 'al'){next_series_id =  3}
            if (series.league == 'nl'){next_series_id =  7}
            is_top = series.seriesid % 2 == 1;
        } else if (series.next_round == 'lds') {
            if (series.league == 'al'){next_series_id =  1}
            if (series.league == 'nl'){next_series_id =  5}
            is_top = false;
        } else if (series.next_round == 'winner') {
            console.log(winner.city +' wins the World Series!');

            winning_team = d3.select(".team."+classify(winner.nickname))
            
            winning_team.datum().total+=1;

            total_sim+=1;
            
            return;
        }

        next_series = d3.select(".series" + next_series_id)

        if (is_top) {
            next_series.datum().topteam = winner;
        } else {
            next_series.datum().bottomteam = winner;
        }

    }

    var drawWinners = function (){
        
        d3.selectAll(".series" +'>text.top')
            .text(function(d) { 
                if (d.topteam) {
                    if (isMobile) {
                        if (d.topteam.probability){
                            return percent(d.topteam.probability)+' '+d.topteam.nickname + ' ' + d.topteam.wins;
                        } else {
                            return d.topteam.nickname + ' ' + d.topteam.wins;
                        } 
                    } else {
                        if (d.topteam.probability){
                            return percent(d.topteam.probability)+' '+d.topteam.nickname + ' ' + d.topteam.wins;
                        } else {
                            return d.topteam.nickname + ' ' + d.topteam.wins;
                        } 
                    }
                }
            });

        d3.selectAll(".series" +'>text.bottom')
            .text(function(d) { 
                if (d.bottomteam) {
                    if (isMobile) {
                        if (d.bottomteam.probability){
                            return percent(d.bottomteam.probability)+' '+d.bottomteam.nickname + ' ' + d.bottomteam.wins;
                        } else {
                            return d.bottomteam.nickname + ' ' + d.bottomteam.wins;
                        } 
                    } else {
                        if (d.bottomteam.probability){
                            return percent(d.bottomteam.probability)+' '+d.bottomteam.nickname + ' ' + d.bottomteam.wins;
                        } else {
                            return d.bottomteam.nickname + ' ' + d.bottomteam.wins;
                        } 
                    }
                }
            });

        d3.selectAll('.team >text')
            .text(function(d) {
                if (total_sim>0){
                    return d.nickname + ': '+d.total+' ('+percent(d.total/total_sim)+')'; 
                } else {
                    return d.nickname + ': ' +d.total; 
                }
                
            });

    }

    create_bracket();
    drawWinners();

    var simulate = function(){
        create_bracket();
        $.each(series_list,function(i,series){
            d3.select('.series'+i).each(function(d){
                play_series(d.topteam,d.bottomteam,series);
            })

        })

        drawWinners();
    }

    function interval(func, wait, times){
        var interv = function(w, t){
            return function(){
                if(typeof t === "undefined" || t-- > 0){
                    setTimeout(interv, w);
                    try{
                        func.call(null);
                    }
                    catch(e){
                        t = 0;
                        throw e.toString();
                    }
                }
            };
        }(wait, times);

        timer = setTimeout(interv, wait);

    };

    var stop;

    $('.thebutton').click(function(){
        // simulate();
        stop = interval(function(){
            simulate();
        }, 10, 1);

    })

    $('.thebutton1000').click(function(){
        // simulate();
        stop = interval(function(){
            simulate();
        }, 10, 1000);

    })

    $('.reset').click(function(){
        clear_bracket(onWindowLoaded);
    })

}

/*
 * Initially load the graphic
 * (NB: Use window.load instead of document.ready
 * to ensure all images have loaded)
 */
$(window).load(onWindowLoaded);