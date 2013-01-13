/**
 * Quote Stream
 *
 * @version 0.2.0
 * @author NodeSocket <http://www.nodesocket.com> <hello@nodesocket.com>
 */

 /*
 * Copyright (C) 2012 NodeSocket LLC 
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and 
 * associated documentation files (the "Software"), to deal in the Software without restriction, including 
 * without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the
 * following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial 
 * portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
 * TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
 * CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

////
// CONFIGURATION SETTINGS
///
var PORT = 4000;
var API_PORT = 5000;
var FETCH_INTERVAL = 15000;
var PRETTY_PRINT_JSON = true;
var MAX_SIZE = 10;

var PortManager = require("./app_modules/portfolio.js");

///
// START OF APPLICATION
///
var express = require('express');
var http = require('http');
var io = require('socket.io');
var ws = require("websocket-server");
var _ = require("underscore")._;


var app = express();
var server = http.createServer(app);
var io = io.listen(server);
io.set('log level', 2);

server.listen(PORT);

var tickers = [], test = PortManager.createPort();

app.use(express.static(__dirname + '/media'));
app.use(express.bodyParser());

app.get('/', function(req, res){
	res.sendfile(__dirname + '/index.html');
});

app.post('/', function(req, res){
   	console.log(req.body);
	var ticker = req.body.tickers;
	ticker = ticker.replace(/^\s+|\s+$/, "");
	tickers = tickers.concat(ticker.split(/\s*,\s*/));
	res.redirect('/trade/');
});

app.get('/trade/', function(req, res) {
	if (tickers.length){
	    res.sendfile(__dirname + '/trade.html');
	} else {
	    res.redirect('/');
	}
});

// for web client
io.sockets.on('connection', function(socket) {
	var local_ticker = tickers.splice(0, MAX_SIZE);
	test.addTicker(local_ticker);
	tickers.length = 0;

	//Run the first time immediately
	get_quote(socket, local_ticker);
	//Tell the client about tickers 
	socket.emit("tickers", local_ticker);

	//Every N seconds
	var timer = setInterval(function() {
		get_quote(socket, local_ticker);
	}, FETCH_INTERVAL);

	socket.on("incoming_order", function(order_str){
		try{
		    var order = JSON.parse(order_str);
		} catch (err) {
		    var order = order_str;
		}
		test.processOrder(order);
	});

	socket.on("cancel_order", function(orderId){
        test.cancel(orderId);	
	});

	socket.on('disconnect', function () {
		clearInterval(timer);
	});

	test.on("change", function(change){
		var msg = JSON.stringify(change);
		socket.emit("portfolio", msg);	
		api_server.broadcast(msg);
	});

});

var api_server = ws.createServer();

api_server.addListener("connection", function(connection){

	  if (!(test && test.tickers.length)) {
		  api_server.send(connection.id, 
			  "No portfolio in existence, connection will close.");
	      connection.close();
		  return 
	  }

      var allowing = /^(incoming_order|cancel_order)$/;

	  connection.addListener("message", function(msg){

		  msg = JSON.parse(msg);
		  if (msg === Object(msg)) {
			  for (key in msg){
				  if (!allowing.test(key)) continue;
				  test.emit(key, msg[key]);
			  }
          }
 
	  });

});

api_server.listen(API_PORT);



function get_quote(p_socket, p_tickers) {
	var i, prices={};
    for (i in p_tickers) {
		p_ticker = p_tickers[i];
		http.get({
			host: 'www.google.com',
			port: 80,
			path: '/finance/info?client=ig&q=' + p_ticker
		}, function(response) {
                        console.log(response);
			response.setEncoding('utf8');
			var data = "";
						
			response.on('data', function(chunk) {
				data += chunk;
			});
			
			response.on('end', function() {
				if(data.length > 0) {
					try {
						var data_object = JSON.parse(data.substring(3));
					} catch(e) {
						return;
					}
										
					var quote = {}, last;
					quote.ticker = data_object[0].t;
					quote.exchange = data_object[0].e;
					// for testin purposes randomize the prices
					quote.price = Number(data_object[0].l_cur) || Number(data_object[0].l_cur.replace(/[^\d]*/, ""));
					quote.change = data_object[0].c;
					quote.change_percent = data_object[0].cp;
					quote.last_trade_time = data_object[0].lt;
					quote.dividend = data_object[0].div;
					quote.yield = data_object[0].yld;

					prices[quote.ticker] = quote.price;
					last = test.LastPrice[quote.ticker];

					// if (last && last != Number(quote.price)){
					    test.priceUpdate(prices);
					// }
					
					p_socket.emit('quote', PRETTY_PRINT_JSON ? JSON.stringify(quote, true, '\t') : JSON.stringify(quote));
				}
			});
		});
	}
}
