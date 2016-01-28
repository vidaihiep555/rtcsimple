var config = null;
var ua = null;
var active_call = null;
var registered = false;
var callStart = 0;
var ws_was_connected = false;

var login_form = null;
var login_realm = null;
var login_private_identity = null;
var login_public_identity = null;
var login_sip_password = null;
var login_display_name = null;
var chat_message = null;

var connect_button = null;
var unconnect_button = null;
var subscribe_button = null;

var callTarget;

var incomingCallBox = null;
var inCallBox = null;

var phone_call_button = null;
var phone_call_audio_button = null;
var phone_accept_button = null;
var phone_hold_button = null;
var phone_reject_button = null;
var phone_mute_button = null;
var phone_hangup_button = null;
var phone_full_screen_button = null;
var message_button = null;
//var phone_chat_button = null;

var videoLocal, videoRemote;

var callType = null;

var txtRegStatus, txtCallStatus;

var outgoingCall, incomingCall;

var peerconnection_config = peerconnection_config || undefined;

var sTransferNumber;
var oRingTone, oRingbackTone;

var ringtone, ringbacktone;

var oSipStack, oSipSessionRegister, oSipSessionCall, oSipSessionTransferCall;
var videoRemote, videoLocal, audioRemote;
var bFullScreen = false;
var oNotifICall;
var bDisableVideo = false;
var viewVideoLocal, viewVideoRemote, viewLocalScreencast; // <video> (webrtc) or <div> (webrtc4all)
var oConfigCall;
var oReadyStateTimer;

var mychatSession;

$(document).ready(function() {
    console.info("Starting phone app ...");
    var PageTitle = "JsSIP Tryit";
    document.title = PageTitle;

    //stream
    videoLocal = document.getElementById('selfView');
    videoRemote = document.getElementById('remoteView');
    audioRemote = document.getElementById("audio_remote");
    txtRegStatus = document.getElementById("txtRegStatus");
    txtCallStatus = document.getElementById("txtCallStatus");

    ringtone = document.getElementById('ringtone');
    ringbacktone = document.getElementById('ringbacktone');
    //login wss inputs
    login_display_name = $("#display_name");
    login_realm = $("#realm");
    login_private_identity = $('#private_identity');
    login_public_identity = $('#public_identity');
    login_sip_password = $("#sip_password");
    chat_message = $('#chat_message');

    connect_button = $('#connectbtn');
    connect_button.click(function(){
        sipRegister();
    });

    unconnect_button = $('#unconnectbtn');
    unconnect_button.click(function() {
        sipUnRegister();
    });

    //subscribe_button = $('#subcribebtn');
    //subscribe_button.click(function() {
    //    subcribe('6000');
    //});

    callTarget = $('#callTarget');

    incomingCallBox = $('#incomingbox');
    inCallBox = $('#incallbox');

    //phone buttons
    phone_accept_button = $('#acceptbtn');
    phone_accept_button.click(function(){
        sipAnswer();
        //moveUIToState('incall');
    });

    phone_call_button = $("#callvideobtn");
    phone_call_button.prop('disabled', true);
    phone_call_button.click(function(){
        sipCall("call-audiovideo");
    });

    phone_call_audio_button = $('#callaudiobtn');
    phone_call_audio_button.click(function() {
        sipCall("call-audio");
    });

    phone_reject_button = $('#rejectbtn');
    phone_reject_button.click(function(){
        sipHangUp();
    });

    phone_hold_button = $("#holdbtn");
    phone_hold_button.click(function() {
        sipToggleHoldResume();
    });

    phone_mute_button = $("#mutebtn");
    phone_mute_button.click(function() {
        sipToggleMute();
    });
    //phone_reject_button.prop('disabled', true);
    phone_hangup_button = $('#hangupbtn');
    phone_hangup_button.click(function(){
        sipHangUp();
        //moveUIToState('connected');
    });

    phone_full_screen_button = $('#fullscreenbtn');
    phone_full_screen_button.click(function() {
        toggleFullScreen();
    });

    message_button = $('#messagebtn');
    message_button.click(function() {
        sendMessage();
    });

    moveUIToState('disconnected');
    SIPml.init(postInit);
});

function postInit() {
    // check for WebRTC support
    if (!SIPml.isWebRtcSupported()) {
        // is it chrome?
        if (SIPml.getNavigatorFriendlyName() == 'chrome') {
            if (confirm("You're using an old Chrome version or WebRTC is not enabled.\nDo you want to see how to enable WebRTC?")) {
                window.location = 'http://www.webrtc.org/running-the-demos';
            }
            else {
                window.location = "index.html";
            }
            return;
        }
        else {
            if (confirm("webrtc-everywhere extension is not installed. Do you want to install it?\nIMPORTANT: You must restart your browser after the installation.")) {
                window.location = 'https://github.com/sarandogou/webrtc-everywhere';
            }
            else {
                // Must do nothing: give the user the chance to accept the extension
                // window.location = "index.html";
            }
        }
    }

    // checks for WebSocket support
    if (!SIPml.isWebSocketSupported()) {
        if (confirm('Your browser don\'t support WebSockets.\nDo you want to download a WebSocket-capable browser?')) {
            window.location = 'https://www.google.com/intl/en/chrome/browser/';
        }
        else {
            window.location = "index.html";
        }
        return;
    }

    // FIXME: displays must be per session
    viewVideoLocal = videoLocal;
    viewVideoRemote = videoRemote;

    if (!SIPml.isWebRtcSupported()) {
        if (confirm('Your browser don\'t support WebRTC.\naudio/video calls will be disabled.\nDo you want to download a WebRTC-capable browser?')) {
            window.location = 'https://www.google.com/intl/en/chrome/browser/';
        }
    }

    //btnRegister.disabled = false;
    //document.body.style.cursor = 'default';
    oConfigCall = {
        audio_remote: audioRemote,
        video_local: viewVideoLocal,
        video_remote: viewVideoRemote,
        screencast_window_id: 0x00000000, // entire desktop
        bandwidth: { audio: undefined, video: undefined },
        video_size: { minWidth: undefined, minHeight: undefined, maxWidth: undefined, maxHeight: undefined },
        events_listener: { events: '*', listener: onSipEventSession },
        sip_caps: [
                        { name: '+g.oma.sip-im' },
                        { name: 'language', value: '\"en,fr\"' }
        ]
    };
}

// sends SIP REGISTER request to login
function sipRegister() {
    // catch exception for IE (DOM not ready)
    try {
        //btnRegister.disabled = true;
        moveUIToState('connected');
        if (!login_realm.val() || !login_private_identity.val() || !login_public_identity.val()) {
            txtRegStatus.innerHTML = '<b>Please fill madatory fields (*)</b>';
            //btnRegister.disabled = false;
            moveUIToState('disconnected');
            return;
        }
        var o_impu = tsip_uri.prototype.Parse(login_public_identity.val());
        if (!o_impu || !o_impu.s_user_name || !o_impu.s_host) {
            txtRegStatus.innerHTML = "<b>[" + login_public_identity.val() + "] is not a valid Public identity</b>";
            //btnRegister.disabled = false;
            moveUIToState('disconnected');
            return;
        }

        // enable notifications if not already done
        if (window.webkitNotifications && window.webkitNotifications.checkPermission() != 0) {
            window.webkitNotifications.requestPermission();
        }

        // save credentials
        //saveCredentials();

        // update debug level to be sure new values will be used if the user haven't updated the page
        SIPml.setDebugLevel((window.localStorage && window.localStorage.getItem('org.doubango.expert.disable_debug') == "true") ? "error" : "info");

        // create SIP stack
        oSipStack = new SIPml.Stack({
            realm: login_realm.val(),
            impi: login_private_identity.val(),
            impu: login_public_identity.val(),
            password: login_sip_password.val(),
            display_name: login_display_name.val(),
            websocket_proxy_url: (window.localStorage ? window.localStorage.getItem('org.doubango.expert.websocket_server_url') : null),
            outbound_proxy_url: (window.localStorage ? window.localStorage.getItem('org.doubango.expert.sip_outboundproxy_url') : null),
            ice_servers: (window.localStorage ? window.localStorage.getItem('org.doubango.expert.ice_servers') : null),
            enable_rtcweb_breaker: (window.localStorage ? window.localStorage.getItem('org.doubango.expert.enable_rtcweb_breaker') == "true" : false),
            events_listener: { events: '*', listener: onSipEventStack },
            enable_early_ims: (window.localStorage ? window.localStorage.getItem('org.doubango.expert.disable_early_ims') != "true" : true), // Must be true unless you're using a real IMS network
            enable_media_stream_cache: (window.localStorage ? window.localStorage.getItem('org.doubango.expert.enable_media_caching') == "true" : false),
            bandwidth: (window.localStorage ? tsk_string_to_object(window.localStorage.getItem('org.doubango.expert.bandwidth')) : null), // could be redefined a session-level
            video_size: (window.localStorage ? tsk_string_to_object(window.localStorage.getItem('org.doubango.expert.video_size')) : null), // could be redefined a session-level
            sip_headers: [
                    { name: 'User-Agent', value: 'IM-client/OMA1.0 sipML5-v1.2015.03.18' },
                    { name: 'Organization', value: 'Doubango Telecom' }
            ]
        }
        );
        if (oSipStack.start() != 0) {
            txtRegStatus.innerHTML = '<b>Failed to start the SIP stack</b>';
        }
        else return;
    }
    catch (e) {
        txtRegStatus.innerHTML = "<b>2:" + e + "</b>";
    }
    moveUIToState('connected');
    //btnRegister.disabled = false;
}

// sends SIP REGISTER (expires=0) to logout
function sipUnRegister() {
    if (oSipStack) {
        oSipStack.stop(); // shutdown all sessions
    }
}

// makes a call (SIP INVITE)
function sipCall(s_type) {
    if (oSipStack && !oSipSessionCall) {
        if (s_type == 'call-screenshare') {
            if (!SIPml.isScreenShareSupported()) {
                alert('Screen sharing not supported. Are you using chrome 26+?');
                return;
            }
            if (!location.protocol.match('https')) {
                if (confirm("Screen sharing requires https://. Do you want to be redirected?")) {
                    sipUnRegister();
                    window.location = 'https://ns313841.ovh.net/call.htm';
                }
                return;
            }
        }
        moveUIToState('calling');

        if (window.localStorage) {
            oConfigCall.bandwidth = tsk_string_to_object(window.localStorage.getItem('org.doubango.expert.bandwidth')); // already defined at stack-level but redifined to use latest values
            oConfigCall.video_size = tsk_string_to_object(window.localStorage.getItem('org.doubango.expert.video_size')); // already defined at stack-level but redifined to use latest values
        }

        // create call session
        oSipSessionCall = oSipStack.newSession(s_type, oConfigCall);
        // make call
        if (oSipSessionCall.call(callTarget.val()) != 0) {
            oSipSessionCall = null;
            txtCallStatus.value = 'Failed to make call';
            return;
        }
        //saveCallOptions();
    }
}

function sipAnswer(){
    if(oSipSessionCall){
        txtCallStatus.innerHTML = '<i>Connecting...</i>';
        oSipSessionCall.accept(oConfigCall);
        //moveUIToState('incall');
    }
}

var messageSession;
var IMListener = function(e){
        console.info('session event='+e.type);
}

function sendMessage(){
    console.log('We can send IM+++++++');
    messageSession = oSipStack.newSession( 'message',{
            events_listener: { events: '*', listener: IMListener}
    });
    //var dtime = new Date();
    //var outtime = dtime.getHours()+":"+dtime.getMinutes+":"+dtime.getSeconds;
    console.log('trying to send IM++++');
    //var myvalpeer = $("#chatpeers").val();
    //messageSession.send($("#chatpeers").val(),$("#sendchat").val(),'text/plain;charset=utf-8');
    if(messageSession.send(callTarget.val(), chat_message.val(),'text/plain;charset=utf-8')!=0){
        txtCallStatus.value = 'Failed to send message';
        messageSession = null;
    } else {
        $("#chatarea").html($("#chatarea").html()+"<b>To "+callTarget.val()+": </b>"+chat_message.val()+"</br>");
        $('#chatarea').scrollTop($('#chatarea')[0].scrollHeight);
    }
    //$("#recchat").html($("#recchat").text()+'('+outtime+')'+$("#sendchat").val()+"\n");
    //$("#recchat").html($("#recchat").text()+'>'+$("#sendchat").val()+"\n");
    //$('#recchat').scrollTop($('#recchat')[0].scrollHeight);
}

//SUBSCRIBE TESTING
/*var subscribeSession;
var eventsListener = function(e){
    console.info('session event = ' + e.type);
    if(e.type == 'i_notify'){
        console.info('NOTIFY content = ' + e.getContentString());
        console.info('NOTIFY content-type = ' + e.getContentType());
        txtRegStatus.innerHTML = "<i>ONLINE</i>";

        if (e.getContentType() == 'application/pidf+xml') {
            if (window.DOMParser) {
                var parser = new DOMParser();
                var xmlDoc = parser ? parser.parseFromString(e.getContentString(), "text/xml") : null;
                var presenceNode = xmlDoc ? xmlDoc.getElementsByTagName ("presence")[0] : null;
                if(presenceNode){
                    var entityUri = presenceNode.getAttribute ("entity");
                    var tupleNode = presenceNode.getElementsByTagName ("tuple")[0];
                    if(entityUri && tupleNode){
                        var statusNode = tupleNode.getElementsByTagName ("status")[0];
                        if(statusNode){
                            var basicNode = statusNode.getElementsByTagName ("basic")[0];
                            if(basicNode){
                                console.info('Presence notification: Uri = ' + entityUri + ' status = ' + basicNode.textContent);
                            }
                        }
                    }
                }
            }
        }
    }
}

function subcribe(to){
    subscribeSession = oSipStack.newSession('subscribe', {
        expires: 200,
        events_listener: { events: '*', listener: eventsListener },
        sip_headers: [
                      { name: 'Event', value: 'presence' }, // only notify for 'presence' events
                      { name: 'Accept', value: 'application/pidf+xml' } // supported content types (COMMA-sparated)
            ],
        sip_caps: [
                    { name: '+g.oma.sip-im', value: null },
                    { name: '+audio', value: null },
                    { name: 'language', value: '\"en,fr\"' }
            ]
    });
    // start watching for entity's presence status (You may track event type 'connected' to be sure that the request has been accepted by the server)
    subscribeSession.subscribe(to);
}*/

// Callback function for SIP Stacks
function onSipEventStack(e /*SIPml.Stack.Event*/) {
    tsk_utils_log_info('==stack event = ' + e.type);
    switch (e.type) {
        case 'started':
            {
                // catch exception for IE (DOM not ready)
                try {
                    // LogIn (REGISTER) as soon as the stack finish starting
                    oSipSessionRegister = this.newSession('register', {
                        expires: 200,
                        events_listener: { events: '*', listener: onSipEventSession },
                        sip_caps: [
                                    { name: '+g.oma.sip-im', value: null },
                                    //{ name: '+sip.ice' }, // rfc5768: FIXME doesn't work with Polycom TelePresence
                                    { name: '+audio', value: null },
                                    { name: 'language', value: '\"en,fr\"' }
                        ]
                    });
                    oSipSessionRegister.register();
                }
                catch (e) {
                    txtRegStatus.value = txtRegStatus.innerHTML = "<b>1:" + e + "</b>";
                    //btnRegister.disabled = false;
                    moveUIToState('disconnected');
                }
                break;
            }
        case 'stopping': case 'stopped': case 'failed_to_start': case 'failed_to_stop':
            {
                var bFailure = (e.type == 'failed_to_start') || (e.type == 'failed_to_stop');
                oSipStack = null;
                oSipSessionRegister = null;
                oSipSessionCall = null;

                //uiOnConnectionEvent(false, false);
                moveUIToState('disconnected');

                stopRingbackTone();
                stopRingTone();

                txtCallStatus.innerHTML = '';
                txtRegStatus.innerHTML = bFailure ? "<i>Disconnected: <b>" + e.description + "</b></i>" : "<i>Disconnected</i>";
                break;
            }

        case 'i_new_call':
            {
                if (oSipSessionCall) {
                    // do not accept the incoming call if we're already 'in call'
                    e.newSession.hangup(); // comment this line for multi-line support
                }
                else {
                    oSipSessionCall = e.newSession;
                    // start listening for events
                    oSipSessionCall.setConfiguration(oConfigCall);
                    startRingTone();
                    moveUIToState('incoming');

                    var sRemoteNumber = (oSipSessionCall.getRemoteFriendlyName() || 'unknown');
                    txtCallStatus.innerHTML = "<i>Incoming call from [<b>" + sRemoteNumber + "</b>]</i>";
                    //showNotifICall(sRemoteNumber);
                }
                break;
            }
        case 'i_new_message': {

                mychatSession = e.newSession;
                mychatSession.accept();

                var sRemoteNumber = (mychatSession.getRemoteFriendlyName() || 'unknown');

                console.info('IMmsg = '+e.getContentString()+' IMtype = '+e.getContentType()+' number: '+sRemoteNumber);

                $("#chatarea").html($("#chatarea").html()+"<b>From "+sRemoteNumber+": </b>"+e.getContentString()+"</br>");
                $('#chatarea').scrollTop($('#chatarea')[0].scrollHeight);

                //newmessageTone();
                //destroy the call session
                //mychatSession.hangup();
                mychatSession = null;

                break;
            }

        case 'm_permission_requested':
            {
                //divGlassPanel.style.visibility = 'visible';
                break;
            }
        case 'm_permission_accepted':
        case 'm_permission_refused':
            {
                //divGlassPanel.style.visibility = 'hidden';
                if (e.type == 'm_permission_refused') {
                    uiCallTerminated('Media stream permission denied');
                }
                break;
            }

        case 'starting': default: break;
    }
};

// Callback function for SIP sessions (INVITE, REGISTER, MESSAGE...)
function onSipEventSession(e /* SIPml.Session.Event */) {
    tsk_utils_log_info('==session event = ' + e.type);

    switch (e.type) {
        case 'connecting':
            {
                var bConnected = (e.type == 'connected');
                if (e.session == oSipSessionRegister) {
                    //uiOnConnectionEvent(bConnected, !bConnected);
                    txtRegStatus.innerHTML = "<i>" + e.description + "</i>";
                    moveUIToState('connecting');
                }
                else if (e.session == oSipSessionCall) {

                    //moveUIToState('connected');
                    if (window.btnBFCP) window.btnBFCP.disabled = false;

                    moveUIToState('incall');
                    txtCallStatus.innerHTML = "<i>" + e.description + "</i>";
                    //divCallOptions.style.opacity = bConnected ? 1 : 0;
                }
                break;
            } // 'connecting' | 'connected'
        case 'connected':
            {
                var bConnected = (e.type == 'connected');
                if (e.session == oSipSessionRegister) {
                    //uiOnConnectionEvent(bConnected, !bConnected);
                    txtRegStatus.innerHTML = "<i>" + e.description + "</i>";
                    moveUIToState('connected');
                }
                else if (e.session == oSipSessionCall) {

                    //moveUIToState('connected');
                    if (window.btnBFCP) window.btnBFCP.disabled = false;

                    if (bConnected) {
                        stopRingbackTone();
                        stopRingTone();
                    }

                    txtCallStatus.innerHTML = "<i>" + e.description + "</i>";
                    moveUIToState('incall');
                }
                break;
            } // 'connecting' | 'connected'
        case 'terminating': case 'terminated':
            {
                if (e.session == oSipSessionRegister) {
                    //uiOnConnectionEvent(false, false);

                    oSipSessionCall = null;
                    oSipSessionRegister = null;
                    moveUIToState('connected');

                    txtRegStatus.innerHTML = "<i>" + e.description + "</i>";
                }
                else if (e.session == oSipSessionCall) {
                    uiCallTerminated(e.description);
                }
                break;
            } // 'terminating' | 'terminated'

        case 'm_stream_video_local_added':
            {
                if (e.session == oSipSessionCall) {
                    //uiVideoDisplayEvent(true, true);
                }
                break;
            }
        case 'm_stream_video_local_removed':
            {
                if (e.session == oSipSessionCall) {
                    //uiVideoDisplayEvent(true, false);
                }
                break;
            }
        case 'm_stream_video_remote_added':
            {
                if (e.session == oSipSessionCall) {
                    //uiVideoDisplayEvent(false, true);
                }
                break;
            }
        case 'm_stream_video_remote_removed':
            {
                if (e.session == oSipSessionCall) {
                    //uiVideoDisplayEvent(false, false);
                }
                break;
            }

        case 'm_stream_audio_local_added':
        case 'm_stream_audio_local_removed':
        case 'm_stream_audio_remote_added':
        case 'm_stream_audio_remote_removed':
            {
                break;
            }

        case 'i_ect_new_call':
            {
                oSipSessionTransferCall = e.session;
                break;
            }

        case 'i_ao_request':
            {
                if (e.session == oSipSessionCall) {
                    var iSipResponseCode = e.getSipResponseCode();
                    if (iSipResponseCode == 180 || iSipResponseCode == 183) {
                        startRingbackTone();
                        txtCallStatus.innerHTML = '<i>Remote ringing...</i>';
                    }
                }
                break;
            }

        case 'm_early_media':
            {
                if (e.session == oSipSessionCall) {
                    stopRingbackTone();
                    stopRingTone();
                    txtCallStatus.innerHTML = '<i>Early media started</i>';
                }
                break;
            }

        case 'm_local_hold_ok':
            {
                if (e.session == oSipSessionCall) {
                    if (oSipSessionCall.bTransfering) {
                        oSipSessionCall.bTransfering = false;
                        // this.AVSession.TransferCall(this.transferUri);
                    }
                    //btnHoldResume.value = 'Resume';
                    //btnHoldResume.disabled = false;
                    txtCallStatus.innerHTML = '<i>Call placed on hold</i>';
                    oSipSessionCall.bHeld = true;
                }
                break;
            }
        case 'm_local_hold_nok':
            {
                if (e.session == oSipSessionCall) {
                    oSipSessionCall.bTransfering = false;
                    //btnHoldResume.value = 'Hold';
                    //btnHoldResume.disabled = false;
                    txtCallStatus.innerHTML = '<i>Failed to place remote party on hold</i>';
                }
                break;
            }
        case 'm_local_resume_ok':
            {
                if (e.session == oSipSessionCall) {
                    oSipSessionCall.bTransfering = false;
                    //btnHoldResume.value = 'Hold';
                    //btnHoldResume.disabled = false;
                    txtCallStatus.innerHTML = '<i>Call taken off hold</i>';
                    oSipSessionCall.bHeld = false;

                    if (SIPml.isWebRtc4AllSupported()) { // IE don't provide stream callback yet
                        //uiVideoDisplayEvent(false, true);
                        //uiVideoDisplayEvent(true, true);
                    }
                }
                break;
            }
        case 'm_local_resume_nok':
            {
                if (e.session == oSipSessionCall) {
                    oSipSessionCall.bTransfering = false;
                    //btnHoldResume.disabled = false;
                    txtCallStatus.innerHTML = '<i>Failed to unhold call</i>';
                }
                break;
            }
        case 'm_remote_hold':
            {
                if (e.session == oSipSessionCall) {
                    txtCallStatus.innerHTML = '<i>Placed on hold by remote party</i>';
                }
                break;
            }
        case 'm_remote_resume':
            {
                if (e.session == oSipSessionCall) {
                    txtCallStatus.innerHTML = '<i>Taken off hold by remote party</i>';
                }
                break;
            }
        case 'm_bfcp_info':
            {
                if (e.session == oSipSessionCall) {
                    txtCallStatus.innerHTML = 'BFCP Info: <i>' + e.description + '</i>';
                }
                break;
            }

        case 'o_ect_trying':
            {
                if (e.session == oSipSessionCall) {
                    txtCallStatus.innerHTML = '<i>Call transfer in progress...</i>';
                }
                break;
            }
        case 'o_ect_accepted':
            {
                if (e.session == oSipSessionCall) {
                    txtCallStatus.innerHTML = '<i>Call transfer accepted</i>';
                }
                break;
            }
        case 'o_ect_completed':
        case 'i_ect_completed':
            {
                if (e.session == oSipSessionCall) {
                    txtCallStatus.innerHTML = '<i>Call transfer completed</i>';
                    //btnTransfer.disabled = false;
                    if (oSipSessionTransferCall) {
                        oSipSessionCall = oSipSessionTransferCall;
                    }
                    oSipSessionTransferCall = null;
                }
                break;
            }
        case 'o_ect_failed':
        case 'i_ect_failed':
            {
                if (e.session == oSipSessionCall) {
                    txtCallStatus.innerHTML = '<i>Call transfer failed</i>';
                    //btnTransfer.disabled = false;
                }
                break;
            }
        case 'o_ect_notify':
        case 'i_ect_notify':
            {
                if (e.session == oSipSessionCall) {
                    txtCallStatus.innerHTML = "<i>Call Transfer: <b>" + e.getSipResponseCode() + " " + e.description + "</b></i>";
                    if (e.getSipResponseCode() >= 300) {
                        if (oSipSessionCall.bHeld) {
                            oSipSessionCall.resume();
                        }
                        //btnTransfer.disabled = false;
                    }
                }
                break;
            }
        case 'i_ect_requested':
            {
                if (e.session == oSipSessionCall) {
                    var s_message = "Do you accept call transfer to [" + e.getTransferDestinationFriendlyName() + "]?";//FIXME
                    if (confirm(s_message)) {
                        txtCallStatus.innerHTML = "<i>Call transfer in progress...</i>";
                        oSipSessionCall.acceptTransfer();
                        break;
                    }
                    oSipSessionCall.rejectTransfer();
                }
                break;
            }
    }
}

//CHECKAGAIN
// transfers the call
function sipTransfer() {
    if (oSipSessionCall) {
        var s_destination = prompt('Enter destination number', '');
        if (!tsk_string_is_null_or_empty(s_destination)) {
            btnTransfer.disabled = true;
            if (oSipSessionCall.transfer(s_destination) != 0) {
                txtCallStatus.innerHTML = '<i>Call transfer failed</i>';
                btnTransfer.disabled = false;
                return;
            }
            txtCallStatus.innerHTML = '<i>Transfering the call...</i>';
        }
    }
}

//CHECKAGAIN
// holds or resumes the call
function sipToggleHoldResume() {
    if (oSipSessionCall) {
        var i_ret;
        //btnHoldResume.disabled = true;
        txtCallStatus.innerHTML = oSipSessionCall.bHeld ? '<i>Resuming the call...</i>' : '<i>Holding the call...</i>';
        i_ret = oSipSessionCall.bHeld ? oSipSessionCall.resume() : oSipSessionCall.hold();
        if (i_ret != 0) {
            txtCallStatus.innerHTML = '<i>Hold / Resume failed</i>';
            //btnHoldResume.disabled = false;
            return;
        }
    }
}

// Mute or Unmute the call
function sipToggleMute() {
    if (oSipSessionCall) {
        var i_ret;
        var bMute = !oSipSessionCall.bMute;
        txtCallStatus.innerHTML = bMute ? '<i>Mute the call...</i>' : '<i>Unmute the call...</i>';
        i_ret = oSipSessionCall.mute('audio'/*could be 'video'*/, bMute);
        if (i_ret != 0) {
            txtCallStatus.innerHTML = '<i>Mute / Unmute failed</i>';
            return;
        }
        oSipSessionCall.bMute = bMute;

        if(bMute) {
            phone_mute_button.text('Unmute');
        } else {
            phone_mute_button.text('Mute');
        }
    }
}

// terminates the call (SIP BYE or CANCEL)
function sipHangUp() {
    if (oSipSessionCall) {
        txtCallStatus.innerHTML = '<i>Terminating the call...</i>';
        oSipSessionCall.hangup({ events_listener: { events: '*', listener: onSipEventSession } });
    }
}

//CHECKAGAIN
function sipSendDTMF(c) {
    if (oSipSessionCall && c) {
        if (oSipSessionCall.dtmf(c) == 0) {
            try { dtmfTone.play(); } catch (e) { }
        }
    }
}

function startRingTone() {
    try { ringtone.play(); }
    catch (e) { }
}

function stopRingTone() {
    try { ringtone.pause(); }
    catch (e) { }
}

function startRingbackTone() {
    try { ringbacktone.play(); }
    catch (e) { }
}

function stopRingbackTone() {
    try { ringbacktone.pause(); }
    catch (e) { }
}

//WORKS BUT CHECKAGAIN
function toggleFullScreen() {
    if (videoRemote.webkitSupportsFullscreen) {
        fullScreen(!videoRemote.webkitDisplayingFullscreen);
    }
    else {
        fullScreen();
    }
}

function fullScreen() {
    if (tsk_utils_have_webrtc4native() && videoRemote.webkitSupportsFullscreen) {
            videoRemote.webkitEnterFullScreen();
    }
}

function uiCallTerminated(s_description) {
    //reset everything
    //************Remove comment and remove this on hangupbtn envent to enable auto terminate ui
    moveUIToState('connected');
    //uiBtnCallSetText("Call");
    //btnHangUp.value = 'HangUp';
    //btnHoldResume.value = 'hold';
    //btnMute.value = "Mute";
    phone_mute_button.text('Mute');
    //btnCall.disabled = false;
    //btnHangUp.disabled = true;
    //if (window.btnBFCP) window.btnBFCP.disabled = true;

    oSipSessionCall = null;

    stopRingbackTone();
    stopRingTone();

    txtCallStatus.innerHTML = "<i>" + s_description + "</i>";
    setTimeout(function () { if (!oSipSessionCall) txtCallStatus.innerHTML = ''; }, 2500);
}


function moveUIToState(panel) {
    if(panel === 'disconnected'){
        connect_button.prop('disabled', false);
        unconnect_button.prop('disabled', false);
        phone_call_button.prop('disabled', true);
        phone_call_audio_button.prop('disabled', true);

        //hide callingbox
        inCallBox.hide();
        incomingCallBox.hide();
        //hide incall box


    } else if (panel === 'connecting'){
        connect_button.prop('disabled', true);
        unconnect_button.prop('disabled', false);
        phone_call_button.prop('disabled', true);
        phone_call_audio_button.prop('disabled', true);

        //hide callingbox
        inCallBox.hide();
        incomingCallBox.hide();
        //hide incall box
    } else if (panel === 'connected'){
        connect_button.prop('disabled', true);
        unconnect_button.prop('disabled', false);
        phone_call_button.prop('disabled', false);
        phone_call_audio_button.prop('disabled', false);

        //hide callingbox
        inCallBox.hide();
        incomingCallBox.hide();
        //hide incall box
    } else if (panel === 'incoming') {

        //hide all box
        inCallBox.hide();
        //show incoming box
        incomingCallBox.show('fast', function() {
            
        });

        $('#caller').val("" + active_call.remote_identity.display_name);
        //callTarget.val("" + active_call.remote_identity.display_name + "is calling you");
        //phone_accept_button.prop('disabled', false);
        //phone_reject_button.prop('disabled', false);
    
    } else if (panel === 'calling') {
        //show calling box ( same to in call box)
        inCallBox.hide();
        incomingCallBox.hide();
        //disable all btns in calling box except hang up
        phone_hangup_button.prop('disabled', false);
        phone_mute_button.prop('disabled', true);

        connect_button.prop('disabled', true);
        unconnect_button.prop('disabled', false);
        phone_call_button.prop('disabled', true);
        phone_call_audio_button.prop('disabled', true);


    } else if (panel === 'incall') {
        //hide calling box and incoming box
        incomingCallBox.hide();

        //show in call box
        inCallBox.show();

        //disable all btns in calling box except hang up
        phone_hangup_button.prop('disabled', false);
        phone_mute_button.prop('disabled', false);
        
        connect_button.prop('disabled', true);
        unconnect_button.prop('disabled', false);
        phone_call_button.prop('disabled', true);
        phone_call_audio_button.prop('disabled', true);
    }
}

