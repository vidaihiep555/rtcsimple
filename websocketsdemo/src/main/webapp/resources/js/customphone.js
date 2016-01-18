var config = null;
var ua = null;
var active_call = null;
var registered = false;
var callStart = 0;
var ws_was_connected = false;

var login_form = null;
var login_inputs = null;
var login_display_name = null;
var login_sip_uri = null;
var login_sip_password = null;
var login_ws_servers = null;
var connect_button = null;

var callTarget;

var incomingCallBox = null;
var inCallBox = null;

var phone_call_button = null;
var phone_accept_button = null;
var phone_reject_button = null;
var phone_hangup_button = null;
//var phone_chat_button = null;

var selfView, remoteView;

var outgoingCall, incomingCall;

var peerconnection_config = peerconnection_config || undefined;

JsSIP.debug.enable('JsSIP:*');

$(document).ready(function() {
	console.info("Starting phone app ...");
	var PageTitle = "JsSIP Tryit";
	document.title = PageTitle;

	//stream
	selfView = document.getElementById('selfView');
	remoteView = document.getElementById('remoteView');

	//login wss inputs
    login_display_name = $("#display_name");
    login_sip_uri = $("#sip_uri");
    login_sip_password = $("#sip_password");
    login_ws_servers = $("#ws_servers");
    connect_button = $('#connectbtn');
    connect_button.click(function(){
    	createSipStack();
    });

    callTarget = $('#callTarget');

    incomingCallBox = $('#incomingbox');
    incomingCallBox.hide();
    inCallBox = $('#incallbox');
    inCallBox.hide();

	//phone buttons
	phone_accept_button = $('#acceptbtn');
	//phone_accept_button.prop('disabled', true);
	phone_call_button = $("#callbtn");
	phone_call_button.prop('disabled', true);
	//phone_chat_button = $("#phone > .controls > .dialbox > .dial-buttons > .chat");
	phone_reject_button = $('#rejectbtn');
	//phone_reject_button.prop('disabled', true);
	phone_hangup_button = $('#hangungbtn');
	//phone_hangup_button.prop('disabled', true);

	phone_call_button.click(sipcall(true));
	phone_accept_button.click(accept);
	phone_reject_button.click(reject);
	phone_hangup_button.click(hangup);

});
/**
 * Initialize sip stack
 */
function createSipStack() {
 	var display_name = null;
    var sip_uri = null;
    var sip_password = null;
    var ws_servers = null;
    //get all configure value
    if (login_display_name.val() != "")
    	display_name = login_display_name.val();
    if (login_sip_uri.val() != "")
    	sip_uri = login_sip_uri.val();
    if (login_sip_password.val() != "")
    	sip_password = login_sip_password.val();
    if (login_ws_servers.val() != "") {
    	ws_servers = login_ws_servers.val();
    // To JSON (in case of a simple string we must enclose between ").
    if (ws_servers) {
    	if (ws_servers.charAt(0) != "[")
    		ws_servers = '"' + ws_servers + '"'
    	ws_servers = window.JSON.parse(ws_servers);
        }
	}
	if (! sip_uri) {
		return false;
	}
	else if (! ws_servers) {
		return false;
	}
	peerconnection_config = JSON.parse('{ "iceServers": [ {"urls": ["stun:stun.l.google.com:19302"]} ], "gatheringTimeout": 2000 }');
 	var configuration = {
 		uri: sip_uri,
 		password: sip_password,
 		ws_servers: ws_servers,
 		display_name: display_name,
 		no_answer_timeout: 20,
 		session_timers: false,
 		register: true,
 		trace_sip: true,
 		connection_recovery_max_interval: 30,
 		connection_recovery_min_interval: 2
 	};

 	console.info("Create SIP stack with configuration: " + JSON.stringify(configuration));
 	try {
 		ua = new JsSIP.UA(configuration);
 		phone_call_button.prop('disabled', false);
 		//connect_button.prop('disabled', true);
 	} catch (e) {
 		console.debug(e.toString());
 		return;
 	}

 	ua.on('connected', function(e){ 
 		console.debug("Connected to websocket.");
 		document.title = PageTitle;
 		ws_was_connected = true;
 	});

 	ua.on('disconnected', function(e){ 
 		console.debug("Disconnected from websocket");
 		//document.title = PageTitle;
 		if (! ws_was_connected) {
		    //alert("WS connection error:\n\n- WS close code: " + e.data.code + "\n- WS close reason: " + e.data.reason);
		    console.error("WS connection error | WS close code: " + e.code + " | WS close reason: " + e.reason);
		    //if (! window.CustomJsSIPSettings) { window.location.reload(false); }
		}
 	});

 	ua.on('newMessage', function(e) {
 		e.data.message.accept();
 	});

 	ua.on('newRTCSession', function(e) {
 		console.debug("New session created");
 		//incoming call
 		if(active_call === null && e.session !== undefined) {
			// new incoming call
			active_call = e.session;
			new_call(e);
			// ui
			if(e.session.direction === 'incoming') {
				moveUIToState('incoming');
				//message: "" + active_call.remote_identity.display_name + " is calling you"
			} else {
				moveUIToState('calling');
			}
		} else {
			e.data.session.terminate({status_code: 486});
		}
	});

	ua.on('registered', function(e) {
		console.debug("Registered.");
	});

	ua.on('unregistered', function(e){
		console.debug("Unregistered.");
	});

	ua.on('registrationFailed', function(e){
		console.debug("Registration failed.");
	});

	console.info("Starting stack ...");
	ua.start();
}

function new_call(e){
	var call = e.session,//call == _Session now//call = RTCSession {ua: UA, status: 4, dialog: null, earlyDialogs: Object, connection: null…}, e = Object {originator: "remote", session: RTCSession, r
        uri = call.remote_identity.uri,
        display_name = call.remote_identity.display_name || uri.user;

    active_call.on('connecting', function() {
        // TMP
        if (active_call.connection.getLocalStreams().length > 0) {
          window.localStream = active_call.connection.getLocalStreams()[0];
        }
    });

    active_call.on('confirmed', function(e) {
		console.log('call confirmed');
		//callStart = new Date().getTime();
		//chrome.notifications.clear("ring", function() {});
		//var selfView = document.getElementById('selfView');
		if(active_call.connection.getLocalStreams().length > 0){
			var local_stream = active_call.connection.getLocalStreams()[0];
			selfView = JsSIP.rtcninja.attachMediaStream(selfView, local_stream);
			selfView.volume = 0;

			// TMP
			window.localStream = localStream;
		}
		moveUIToState('incall');
	});

	// Started
	active_call.on('accepted',function(e){
		console.log('call accepted');
		//Attach the streams to the views if it exists.		

		/*if (e.originator === 'remote') {
		  if (e.response.getHeader('X-Can-Renegotiate') === 'false') {
		    call.data.remoteCanRenegotiateRTC = false;
		  }
		  else {
		    call.data.remoteCanRenegotiateRTC = true;
		  }
		}*/
	});

    active_call.on('progress', function(e) {
		if (e.originator === 'remote') {
			//e.response.body = null;
		}
	});

	active_call.on('addstream', function(e) {
		var remoteStream = e.stream;
		console.log('remote stream added');
		// Attach remote stream to remoteView
		//var remoteView = document.getElementById('remoteView');
		remoteView = JsSIP.rtcninja.attachMediaStream(remoteView, remoteStream);
	});

	active_call.on('failed', function(e) {
		console.log('call failed with cause: '+ e.cause);
		active_call = null;
		moveUIToState('phone');
		//setTimeout(function() { moveUIToState('phone'); }, 1500);
		//chrome.notifications.clear("ring", function() {});
	});

	// NewDTMF
	active_call.on('newDTMF',function(e) {
		//GUI.playSound("sounds/dialpad/" + e.dtmf.tone + ".ogg");
	});

	active_call.on('hold',function(e) {
		//GUI.playSound("sounds/dialpad/pound.ogg");
	});

	active_call.on('unhold',function(e) {
		//GUI.playSound("sounds/dialpad/pound.ogg");
	});

	active_call.on('ended', function(e) {
		console.debug("Call terminated");
		moveUIToState('phone');
		active_call = null;	
		//chrome.notifications.clear("ring", function() {});
	});

	active_call.on('reinvite', function(e) {
		console.log('call reinvited with request: '+ e.request);
	});
}

//call
function sipcall(isvideosupport) {
	if(active_call === null) {
		//console.debug("New call to " + $('#display').val());
		var eventHandlers = {};
		
		var options = {
			'pcConfig': peerconnection_config,
			'eventHandlers': eventHandlers,
			'mediaConstraints': {audio: true, video: isvideosupport},
			'rtcOfferConstraints': {offerToReceiveAudio: 1, offerToReceiveVideo: 1}
		};
		if(!ua === null){
			//active_call = ua.call(callTarget.val(), options);
			ua.call(callTarget.val(), options);
		}
		
		
	} else {
		console.log("Hangup active call");
		active_call.terminate();
	}
}

///answer
function accept() {
	console.log('Tryit: buttonAnswerClick');
	if (active_call !== null) {
		//active_call.answer({mediaConstraints: {audio: true, video: false}});
		active_call.answer({
			pcConfig: peerconnection_config,
			// TMP:
			mediaConstraints: {audio: true, video: true},
			rtcOfferConstraints: {
				offerToReceiveAudio: 1,
				offerToReceiveVideo: 1
			},
		});
	}
}

function hangup() {
	if (active_call !== null) {
		active_call.terminate();
		moveUIToState('phone');
	}
}

function reject() {
	if (active_call !== null) {
		active_call.terminate(486);
		moveUIToState('phone');
	}
}

function moveUIToState(panel) {
	if (panel === 'phone') {
		// hide all
		incomingCallBox.hide();
		inCallBox.hide();

	} else if (panel === 'incoming') {
		inCallBox.hide();
		incomingCallBox.show();
		$('#caller').val("" + active_call.remote_identity.display_name);
		//callTarget.val("" + active_call.remote_identity.display_name + "is calling you");
		//phone_accept_button.prop('disabled', false);
		//phone_reject_button.prop('disabled', false);
	
	} else if (panel === 'calling') {

	} else if (panel === 'incall') {
		incomingCallBox.hide();
		inCallBox.show();
		///phone_hangup_button.prop('disabled', false);
	}
}


/*$(document).unload(function() {
	console.info("Unload application");
	
	if(active_call !== null) 
		active_call.terminate();
	
	if(ua !== null) {
		ua.unregister();
		ua.stop();
	}
});*/
