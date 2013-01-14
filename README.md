# High frequency trading

### A node.js application that allows you to setup your own virtual trading platform. 

This app is forked from [Quote-Stream](https://github.com/nodesocket/quote-stream). It pushes realtime stock quotes to client side, listens and handles realtime client side orders. Currently, three type of orders are supported: limit, stop and market. API calls are also supported (through web sockets). 

## Current Stage
On top of Quote-Stream, I added mutiple tickers support. Also, a baseline structure of Portfolio, OrderBook objects are created. Client-side rendering is done through underscore templates. 

## Next Step
I will continue to refine it, and add margin accounts into play. Then, I will write another leg of the app, an automated trading algorithum example to communicate with HFT, to allow for some quick and free quant strategy testing. 
