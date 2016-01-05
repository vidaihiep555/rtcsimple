var webSocket;
var messages = document.getElementById("messages");

// Look after different browser vendors' ways of calling the getUserMedia()
// API method:
// Opera --> getUserMedia
// Chrome --> webkitGetUserMedia
// Firefox --> mozGetUserMedia
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia
        || navigator.mozGetUserMedia;
// Clean-up function:
// collect garbage before unloading browser's window
window.onbeforeunload = function(e) {
    hangup();
}
// Data channel information
var sendChannel, receiveChannel;
var sendButton = document.getElementById("sendButton");
var sendTextarea = document.getElementById("dataChannelSend");
var receiveTextarea = document.getElementById("dataChannelReceive");
// HTML5 <video> elements
var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');
// Handler associated with Send button
sendButton.onclick = sendData;
// Flags...
var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
// WebRTC data structures
// Streams
var localStream;
var remoteStream;
// PeerConnection
var pc;
// PeerConnection ICE protocol configuration (either Firefox or Chrome)
var pc_config = webrtcDetectedBrowser === 'firefox' ? {
    'iceServers' : [ {
        'url' : 'stun:23.21.150.121'
    } ]
} : // IP address
{
    'iceServers' : [ {
        'url' : 'stun:stun.l.google.com:19302'
    } ]
};
var pc_constraints = {
    'optional' : [ {
        'DtlsSrtpKeyAgreement' : true
    } ]
};
var sdpConstraints = {};

//START SOCKET
openSocket();
// Let's get started: prompt user for input (room name)
var room = prompt('Enter room name:');


// Send 'Create or join' message to singnaling server
if (room !== '') {
    console.log('Create or join room', room);
    var messageObj = {
        type : "create or join",
        room : room,
        message : "Create or Join!!!"
    }
    sendMessage(messageObj);
}

// Set getUserMedia constraints
var constraints = {
    video : true,
    audio : true
};

function openSocket() {
    // Ensures only one connection is open at a time
    if (webSocket !== undefined && webSocket.readyState !== WebSocket.CLOSED) {
        writeResponse("WebSocket is already opened.");
        return;
    }
    // Connect to signaling server
    // Create a new instance of the websocket
    webSocket = new WebSocket("ws://localhost:8080/websocketsdemo/rtcserver");
    /**
     * Binds functions to the listeners for the websocket.
     */
    webSocket.onopen = function(event) {
        // For reasons I can't determine, onopen gets called twice
        // and the first time event.data is undefined.
        // Leave a comment if you know the answer.
        if (event.data === undefined)
            return;

        writeResponse(event.data);
    };

    webSocket.onmessage = function(event) {
        console.log(event.data)
        var obj = JSON.parse(event.data);
        switch(obj.type){
            case "created" :
                onCreated(obj.message);
                break;
            case "full" :
                onFull(obj.message);
                break;
            case "joined" :
                onJoined(obj.message);
                break;
            case "join" :
                onJoin(obj.message);
                break;
            case "log" :
                onLog();
                break;
            case "message" :
                onMessage(obj.message);
                break;
            default :
                console.log('Something wrong!!!');
        }
        writeResponse(event.data);
    };

    webSocket.onclose = function(event) {
        writeResponse("Connection closed");
    };
}

/**
 * Sends the value of the text input to the server
 */
function sendX() {
    var text = document.getElementById("messageinput").value;
    webSocket.send(text);
}

// Send message to the other peer via the signaling server
function sendMessage(message) {
    console.log('Sending message: ', message);
    //var mesObj = {
    //    type: type,
    //    message: message
    //};
    webSocket.send(JSON.stringify(message));
}

function closeSocket() {
    webSocket.close();
}

function writeResponse(text) {
    //messages.innerHTML += "<br/>" + text;
}


// Connect to signaling server
//var socket = io.connect("http://localhost:8181");

// From this point on, execution proceeds based on asynchronous events...
// getUserMedia() handlers...
function handleUserMedia(stream) {
    localStream = stream;
    attachMediaStream(localVideo, stream);
    console.log('Adding local stream.');
    var messageObj = {
        type : "message",
        room: room,
        message : "got user media"
    }
    sendMessage(messageObj);
}
function handleUserMediaError(error) {
    console.log('navigator.getUserMedia error: ', error);
}

// Server-mediated message exchanging...
// 1. Server-->Client...
// Handle 'created' message coming back from server:
// this peer is the initiator
function onCreated(room){
    console.log('Created room ' + room);
    isInitiator = true;
    // Call getUserMedia()
    navigator.getUserMedia(constraints, handleUserMedia, handleUserMediaError);
    console.log('Getting user media with constraints', constraints);
    checkAndStart();
}

// Handle 'full' message coming back from server:
// this peer arrived too late :-(
function onFull(room){
    console.log('Room ' + room + ' is full');
}

// Handle 'join' message coming back from server:
// another peer is joining the channel
function onJoin(room){
    console.log('Another peer made a request to join room ' + room);
    console.log('This peer is the initiator of room ' + room + '!');
    isChannelReady = true;
}

// Handle 'joined' message coming back from server:
// this is the second peer joining the channel
function onJoined(room){
    console.log('This peer has joined room ' + room);
    isChannelReady = true;
    // Call getUserMedia()
    navigator.getUserMedia(constraints, handleUserMedia, handleUserMediaError);
    console.log('Getting user media with constraints', constraints);
}

// Server-sent log message...
function onLog(){
    //console.log.apply(console, array);
}

//FIXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
// Receive message from the other peer via the signaling server
function onMessage(message){
    console.log('Received message:', message);
    if (message === 'got user media') {
        checkAndStart();
    } else if (message.type === 'offer') {
        if (!isInitiator && !isStarted) {
            checkAndStart();
        }
        pc.setRemoteDescription(new RTCSessionDescription(message));
        doAnswer();
    } else if (message.type === 'answer' && isStarted) {
        pc.setRemoteDescription(new RTCSessionDescription(message));
    } else if (message.type === 'candidate' && isStarted) {
        var candidate = new RTCIceCandidate({
            sdpMLineIndex : message.label,
            candidate : message.candidate
        });
        pc.addIceCandidate(candidate);
    } else if (message === 'bye' && isStarted) {
        handleRemoteHangup();
    }
}

// Channel negotiation trigger function
function checkAndStart() {
    if (!isStarted && typeof localStream != 'undefined' && isChannelReady) {
        createPeerConnection();
        isStarted = true;
        if (isInitiator) {
            doCall();
        }
    }
}
// PeerConnection management...
function createPeerConnection() {
    try {
        pc = new RTCPeerConnection(pc_config, pc_constraints);
        pc.addStream(localStream);
        pc.onicecandidate = handleIceCandidate;
        console.log('Created RTCPeerConnnection with:\n' + ' config: \''
                + JSON.stringify(pc_config) + '\';\n' + ' constraints: \''
                + JSON.stringify(pc_constraints) + '\'.');
    } catch (e) {
        console.log('Failed to create PeerConnection, exception: ' + e.message);
        alert('Cannot create RTCPeerConnection object.');
        return;
    }
    pc.onaddstream = handleRemoteStreamAdded;
    pc.onremovestream = handleRemoteStreamRemoved;
    if (isInitiator) {
        try {
            // Create a reliable data channel
            sendChannel = pc.createDataChannel("sendDataChannel", {
                reliable : true
            });
            trace('Created send data channel');
        } catch (e) {
            alert('Failed to create data channel. ');
            trace('createDataChannel() failed with exception: ' + e.message);
        }
        sendChannel.onopen = handleSendChannelStateChange;
        sendChannel.onmessage = handleMessage;
        sendChannel.onclose = handleSendChannelStateChange;
    } else { // Joiner
        pc.ondatachannel = gotReceiveChannel;
    }
}
// Data channel management
function sendData() {
    var data = sendTextarea.value;
    if (isInitiator)
        sendChannel.send(data);
    else
        receiveChannel.send(data);
    trace('Sent data: ' + data);
}
// Handlers...--DONE
function gotReceiveChannel(event) {
    trace('Receive Channel Callback');
    receiveChannel = event.channel;
    receiveChannel.onmessage = handleMessage;
    receiveChannel.onopen = handleReceiveChannelStateChange;
    receiveChannel.onclose = handleReceiveChannelStateChange;
}
function handleMessage(event) {
    trace('Received message: ' + event.data);
    receiveTextarea.value += event.data + '\n';
}
function handleSendChannelStateChange() {
    var readyState = sendChannel.readyState;
    trace('Send channel state is: ' + readyState);
    // If channel ready, enable user's input
    if (readyState == "open") {
        dataChannelSend.disabled = false;
        dataChannelSend.focus();
        dataChannelSend.placeholder = "";
        sendButton.disabled = false;
    } else {
        dataChannelSend.disabled = true;
        sendButton.disabled = true;
    }
}
function handleReceiveChannelStateChange() {
    var readyState = receiveChannel.readyState;
    trace('Receive channel state is: ' + readyState);
    // If channel ready, enable user's input
    if (readyState == "open") {
        dataChannelSend.disabled = false;
        dataChannelSend.focus();
        dataChannelSend.placeholder = "";
        sendButton.disabled = false;
    } else {
        dataChannelSend.disabled = true;
        sendButton.disabled = true;
    }
}
// ICE candidates management --DONE
function handleIceCandidate(event) {
    console.log('handleIceCandidate event: ', event);
    if (event.candidate) {
        var messageObj = {
            type: "message",
            room: room,
            message: {
                type : 'candidate',
                label : event.candidate.sdpMLineIndex,
                id : event.candidate.sdpMid,
                candidate : event.candidate.candidate
            }
        };
        sendMessage(messageObj);
        /*sendMessage({
            type : 'candidate',
            label : event.candidate.sdpMLineIndex,
            id : event.candidate.sdpMid,
            candidate : event.candidate.candidate
        });*/
    } else {
        console.log('End of candidates.');
    }
}
// Create Offer
function doCall() {
    console.log('Creating Offer...');
    pc.createOffer(setLocalAndSendMessage, onSignalingError, sdpConstraints);
}

// Create Answer
function doAnswer() {
    console.log('Sending answer to peer.');
    pc.createAnswer(setLocalAndSendMessage, onSignalingError, sdpConstraints);
}

// Signaling error handler
function onSignalingError(error) {
    console.log('Failed to create signaling message : ' + error.name);
}
// Success handler for both createOffer()
// and createAnswer()
function setLocalAndSendMessage(sessionDescription) {
    pc.setLocalDescription(sessionDescription);
    var messageObj = {
        type: "message",
        room: room,
        message: sessionDescription
    };
    sendMessage(messageObj);
    //sendMessage(sessionDescription);
}
// Remote stream handlers...--DONE
function handleRemoteStreamAdded(event) {
    console.log('Remote stream added.');
    attachMediaStream(remoteVideo, event.stream);
    console.log('Remote stream attached!!.');
    remoteStream = event.stream;
}
//--DONE
function handleRemoteStreamRemoved(event) {
    console.log('Remote stream removed. Event: ', event);
}
// Clean-up functions...
function hangup() {
    console.log('Hanging up.');
    stop();
    var messageObj = {
        type: "message",
        room: room,
        message: "bye"
    };
    sendMessage(messageObj);
}
function handleRemoteHangup() {
    console.log('Session terminated.');
    stop();
    isInitiator = false;
}
function stop() {
    isStarted = false;
    if (sendChannel)
        sendChannel.close();
    if (receiveChannel)
        receiveChannel.close();
    if (pc)
        pc.close();
    pc = null;
    sendButton.disabled = true;
}
