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
var connect_button = null;
var unconnect_button = null;

var callTarget;

var incomingCallBox = null;
var inCallBox = null;

var phone_call_button = null;
var phone_accept_button = null;
var phone_reject_button = null;
var phone_hangup_button = null;
//var phone_chat_button = null;

var videoLocal, videoRemote;

var txtRegStatus, txtCallStatus;

var outgoingCall, incomingCall;

var peerconnection_config = peerconnection_config || undefined;

var sTransferNumber;
var oRingTone, oRingbackTone;
var oSipStack, oSipSessionRegister, oSipSessionCall, oSipSessionTransferCall;
var videoRemote, videoLocal, audioRemote;
var bFullScreen = false;
var oNotifICall;
var bDisableVideo = false;
var viewVideoLocal, viewVideoRemote, viewLocalScreencast; // <video> (webrtc) or <div> (webrtc4all)
var oConfigCall;
var oReadyStateTimer;


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

    //login wss inputs
    login_display_name = $("#display_name");
    login_realm = $("#realm");
    login_private_identity = $('#private_identity');
    login_public_identity = $('#public_identity');
    login_sip_password = $("#sip_password");
    //login_ws_servers = $("#ws_servers");
    connect_button = $('#connectbtn');
    connect_button.click(function(){
        //createSipStack();
        sipRegister();
    });

    unconnect_button = $('#unconnectbtn');
    unconnect_button.click(function(event) {
        /* Act on the event */
        sipUnRegister();
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
    phone_call_button.click(function(){
        sipcall(true);
    });
    //phone_call_button.prop('disabled', true);
    //phone_chat_button = $("#phone > .controls > .dialbox > .dial-buttons > .chat");
    phone_reject_button = $('#rejectbtn');
    //phone_reject_button.prop('disabled', true);
    phone_hangup_button = $('#hangungbtn');
    //phone_hangup_button.prop('disabled', true);

    //phone_call_button.click(sipcall(true));
    phone_accept_button.click(function(){
        accept();
    });
    phone_reject_button.click(function(){
        reject();
    });
    phone_hangup_button.click(function(){
        hangup();
    });

    phone_call_button.prop('disabled', true);
    //moveUIToState('phone');

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
        if (!login_realm.val() || !login_private_identity.val() || !login_public_identity.val()) {
            txtRegStatus.innerHTML = '<b>Please fill madatory fields (*)</b>';
            //btnRegister.disabled = false;
            return;
        }
        var o_impu = tsip_uri.prototype.Parse(login_public_identity.val());
        if (!o_impu || !o_impu.s_user_name || !o_impu.s_host) {
            txtRegStatus.innerHTML = "<b>[" + login_public_identity.val() + "] is not a valid Public identity</b>";
            //btnRegister.disabled = false;
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
    if (oSipStack && !oSipSessionCall && !tsk_string_is_null_or_empty(callTarget.val())) {
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
        //btnCall.disabled = true;
        //btnHangUp.disabled = false;

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
            btnCall.disabled = false;
            btnHangUp.disabled = true;
            return;
        }
        //saveCallOptions();
    }
    else if (oSipSessionCall) {
        txtCallStatus.innerHTML = '<i>Connecting...</i>';
        oSipSessionCall.accept(oConfigCall);
    }
}

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
                    btnRegister.disabled = false;
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

                //stopRingbackTone();
                //stopRingTone();

                //uiVideoDisplayShowHide(false);
                //divCallOptions.style.opacity = 0;

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

                    //uiBtnCallSetText('Answer');
                    btnHangUp.value = 'Reject';
                    btnCall.disabled = false;
                    btnHangUp.disabled = false;

                    startRingTone();

                    var sRemoteNumber = (oSipSessionCall.getRemoteFriendlyName() || 'unknown');
                    txtCallStatus.innerHTML = "<i>Incoming call from [<b>" + sRemoteNumber + "</b>]</i>";
                    //showNotifICall(sRemoteNumber);
                }
                break;
            }

        case 'm_permission_requested':
            {
                divGlassPanel.style.visibility = 'visible';
                break;
            }
        case 'm_permission_accepted':
        case 'm_permission_refused':
            {
                divGlassPanel.style.visibility = 'hidden';
                if (e.type == 'm_permission_refused') {
                    //uiCallTerminated('Media stream permission denied');
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
        case 'connecting': case 'connected':
            {
                var bConnected = (e.type == 'connected');
                if (e.session == oSipSessionRegister) {
                    //uiOnConnectionEvent(bConnected, !bConnected);
                    txtRegStatus.innerHTML = "<i>" + e.description + "</i>";
                }
                else if (e.session == oSipSessionCall) {
                    //btnHangUp.value = 'HangUp';
                    //btnCall.disabled = true;
                    //btnHangUp.disabled = false;
                    //btnTransfer.disabled = false;
                    if (window.btnBFCP) window.btnBFCP.disabled = false;

                    if (bConnected) {
                        //stopRingbackTone();
                        //stopRingTone();

                        if (oNotifICall) {
                            oNotifICall.cancel();
                            oNotifICall = null;
                        }
                    }

                    //txtCallStatus.innerHTML = "<i>" + e.description + "</i>";
                    divCallOptions.style.opacity = bConnected ? 1 : 0;

                    if (SIPml.isWebRtc4AllSupported()) { // IE don't provide stream callback
                        //uiVideoDisplayEvent(false, true);
                        //uiVideoDisplayEvent(true, true);
                    }
                }
                break;
            } // 'connecting' | 'connected'
        case 'terminating': case 'terminated':
            {
                if (e.session == oSipSessionRegister) {
                    //uiOnConnectionEvent(false, false);

                    oSipSessionCall = null;
                    oSipSessionRegister = null;

                    //txtRegStatus.innerHTML = "<i>" + e.description + "</i>";
                }
                else if (e.session == oSipSessionCall) {
                    //uiCallTerminated(e.description);
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
                    uiVideoDisplayEvent(true, false);
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
                        btnTransfer.disabled = false;
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
        btnHoldResume.disabled = true;
        txtCallStatus.innerHTML = oSipSessionCall.bHeld ? '<i>Resuming the call...</i>' : '<i>Holding the call...</i>';
        i_ret = oSipSessionCall.bHeld ? oSipSessionCall.resume() : oSipSessionCall.hold();
        if (i_ret != 0) {
            txtCallStatus.innerHTML = '<i>Hold / Resume failed</i>';
            btnHoldResume.disabled = false;
            return;
        }
    }
}

//CHECKAGAIN
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
        btnMute.value = bMute ? "Unmute" : "Mute";
    }
}

//CHECKAGAIN
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

//CHECKAGAIN
function toggleFullScreen() {
    if (videoRemote.webkitSupportsFullscreen) {
        fullScreen(!videoRemote.webkitDisplayingFullscreen);
    }
    else {
        fullScreen(!bFullScreen);
    }
}

function fullScreen(b_fs) {
    bFullScreen = b_fs;
    if (tsk_utils_have_webrtc4native() && bFullScreen && videoRemote.webkitSupportsFullscreen) {
        if (bFullScreen) {
            videoRemote.webkitEnterFullScreen();
        }
        else {
            videoRemote.webkitExitFullscreen();
        }
    }
    else {
        if (tsk_utils_have_webrtc4npapi()) {
            try { if (window.__o_display_remote) window.__o_display_remote.setFullScreen(b_fs); }
            catch (e) { divVideo.setAttribute("class", b_fs ? "full-screen" : "normal-screen"); }
        }
        else {
            divVideo.setAttribute("class", b_fs ? "full-screen" : "normal-screen");
        }
    }
}

//CHECKAGAIN
function showNotifICall(s_number) {
    // permission already asked when we registered
    if (window.webkitNotifications && window.webkitNotifications.checkPermission() == 0) {
        if (oNotifICall) {
            oNotifICall.cancel();
        }
        oNotifICall = window.webkitNotifications.createNotification('images/sipml-34x39.png', 'Incaming call', 'Incoming call from ' + s_number);
        oNotifICall.onclose = function () { oNotifICall = null; };
        oNotifICall.show();
    }
}


function uiOnConnectionEvent(b_connected, b_connecting) { // should be enum: connecting, connected, terminating, terminated
    btnRegister.disabled = b_connected || b_connecting;
    btnUnRegister.disabled = !b_connected && !b_connecting;
    btnCall.disabled = !(b_connected && tsk_utils_have_webrtc() && tsk_utils_have_stream());
    btnHangUp.disabled = !oSipSessionCall;
}

function uiVideoDisplayEvent(b_local, b_added) {
    var o_elt_video = b_local ? videoLocal : videoRemote;

    if (b_added) {
        o_elt_video.style.opacity = 1;
        uiVideoDisplayShowHide(true);
    }
    else {
        o_elt_video.style.opacity = 0;
        fullScreen(false);
    }
}

function uiVideoDisplayShowHide(b_show) {
    if (b_show) {
        tdVideo.style.height = '340px';
        divVideo.style.height = navigator.appName == 'Microsoft Internet Explorer' ? '100%' : '340px';
    }
    else {
        tdVideo.style.height = '0px';
        divVideo.style.height = '0px';
    }
    btnFullScreen.disabled = !b_show;
}

function uiDisableCallOptions() {
    if (window.localStorage) {
        window.localStorage.setItem('org.doubango.expert.disable_callbtn_options', 'true');
        uiBtnCallSetText('Call');
        alert('Use expert view to enable the options again (/!\\requires re-loading the page)');
    }
}

function uiBtnCallSetText(s_text) {
    switch (s_text) {
        case "Call":
            {
                var bDisableCallBtnOptions = (window.localStorage && window.localStorage.getItem('org.doubango.expert.disable_callbtn_options') == "true");
                btnCall.value = btnCall.innerHTML = bDisableCallBtnOptions ? 'Call' : 'Call <span id="spanCaret" class="caret">';
                btnCall.setAttribute("class", bDisableCallBtnOptions ? "btn btn-primary" : "btn btn-primary dropdown-toggle");
                btnCall.onclick = bDisableCallBtnOptions ? function () { sipCall(bDisableVideo ? 'call-audio' : 'call-audiovideo'); } : null;
                ulCallOptions.style.visibility = bDisableCallBtnOptions ? "hidden" : "visible";
                if (!bDisableCallBtnOptions && ulCallOptions.parentNode != divBtnCallGroup) {
                    divBtnCallGroup.appendChild(ulCallOptions);
                }
                else if (bDisableCallBtnOptions && ulCallOptions.parentNode == divBtnCallGroup) {
                    document.body.appendChild(ulCallOptions);
                }

                break;
            }
        default:
            {
                btnCall.value = btnCall.innerHTML = s_text;
                btnCall.setAttribute("class", "btn btn-primary");
                btnCall.onclick = function () { sipCall(bDisableVideo ? 'call-audio' : 'call-audiovideo'); };
                ulCallOptions.style.visibility = "hidden";
                if (ulCallOptions.parentNode == divBtnCallGroup) {
                    document.body.appendChild(ulCallOptions);
                }
                break;
            }
    }
}

function uiCallTerminated(s_description) {
    uiBtnCallSetText("Call");
    btnHangUp.value = 'HangUp';
    btnHoldResume.value = 'hold';
    btnMute.value = "Mute";
    btnCall.disabled = false;
    btnHangUp.disabled = true;
    if (window.btnBFCP) window.btnBFCP.disabled = true;

    oSipSessionCall = null;

    stopRingbackTone();
    stopRingTone();

    txtCallStatus.innerHTML = "<i>" + s_description + "</i>";
    //uiVideoDisplayShowHide(false);
    divCallOptions.style.opacity = 0;

    if (oNotifICall) {
        oNotifICall.cancel();
        oNotifICall = null;
    }

    //uiVideoDisplayEvent(false, false);
    //uiVideoDisplayEvent(true, false);

    setTimeout(function () { if (!oSipSessionCall) txtCallStatus.innerHTML = ''; }, 2500);
}


/**
 * Initialize sip stack
 */
/*function createSipStack() {
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
        //no_answer_timeout: 20,
        session_timers: false,
        register: true,
        trace_sip: true
        //connection_recovery_max_interval: 30,
        //connection_recovery_min_interval: 2
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
        //document.title = PageTitle;
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
        }////
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
        //if(!ua === null){
            //active_call = ua.call(callTarget.val(), options);
            ua.call(callTarget.val(), options);
        //}
        
        
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

        moveUIToState('incall');
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
}*/

/*function createACallBox(call){
    <div class="panel panel-default" id="incomingbox">
        <div class="panel-heading">
            <h4 class="modal-title">Incoming call...</h4>
        </div>
        <div class="panel-body">                    
            <p>You have an incoming video call from <span id="caller"></span></p>
            <div class="btn-group btn-group-justified">
                <div class="btn-group">
                    <button type="button" class="btn btn-success accept" id="acceptbtn">Accept</button>
                </div>
                <div class="btn-group">
                    <button type="button" class="btn btn-danger reject" id="rejectbtn">Reject</button>
                </div>
            </div>
        </div>
    </div>

    var incomingbox = $("<div class='panel panel-default' id='" + call.)
    $('#sessions').append()
}*/


/*$(document).unload(function() {
    console.info("Unload application");
    
    if(active_call !== null) 
        active_call.terminate();
    
    if(ua !== null) {
        ua.unregister();
        ua.stop();
    }
});*/
