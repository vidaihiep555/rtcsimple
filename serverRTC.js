var static = require('node-static');
var http = require('http');
// Create a node-static server instance
var file = new(static.Server)();
// We use the http module’s createServer function and
// rely on our instance of node-static to serve the files
var app = http.createServer(function (req, res) {
	file.serve(req, res);
}).listen(8181);
// Use socket.io JavaScript library for real-time web applications
var io = require('socket.io').listen(app);

var nums = 0;
// Let's start managing connections...
io.sockets.on('connection', function (socket){
	// Handle 'message' messages
	socket.on('message', function (message) {
		log('S --> got message: ', message);
		// channel-only broadcast...
		socket.broadcast.to(message.channel).emit('message', message);
	});
	// Handle 'create or join' messages
	socket.on('create or join', function (room) {
		//var numClients = io.sockets.adapter.clients(room).length;
		var clientsList = io.sockets.adapter.rooms[room];
		//var numClients = clientsList.length;
		var numClients = nums;
		log('S --> Room ' + room + ' has ' + numClients + ' client(s)');
		log('S --> Request to create or join room', room);
		// First client joining...
		if (numClients == 0){
			socket.join(room);
			socket.emit('created', room);
		} else if (numClients == 1) {
			// Second client joining...
			io.sockets.in(room).emit('join', room);
			socket.join(room);
			socket.emit('joined', room);
		} else { // max two clients
			socket.emit('full', room);
		}
		nums = nums +1;
	});
	function log(){
		var array = [">>> "];
		for (var i = 0; i < arguments.length; i++) {
			array.push(arguments[i]);
		}
		socket.emit('log', array);
	}
});