$(document).ready(function(){

  var selfView = document.getElementById('selfView');
  var remoteView = document.getElementById('remoteView');
  var localStream, remoteStream;
  var lastSelectedCall;
  // Flags indicating whether local peer can renegotiate RTC (or PC reset is required).
  var localCanRenegotiateRTC = function() {
    return JsSIP.rtcninja.canRenegotiate;
  };

  window.GUI = {
    // Active session collection
    //Sessions: [],

    // Add a session object to the session collection

    phoneCallButtonPressed : function() {
      var target = phone_dialed_number_screen.val();

      if (target) {
        phone_dialed_number_screen.val("");
        GUI.jssipCall(target);
      }
    },

    phoneChatButtonPressed: function() {
      var uri,
        target = phone_dialed_number_screen.val();

      if (target) {
        uri = ua.normalizeTarget(target);
        if (! uri) {
          throw new Error("wrong target: '%s'", target)
        }

        phone_dialed_number_screen.val("");

        // create session
        GUI.createSession(uri.user, uri.toAor());

        // render it
        //GUI.renderSessions();
      }
    },

    // JsSIP.UA newRTCSession event listener
    new_call: function(e) {//e = Object {originator: "remote", session: RTCSession, request: IncomingRequest} or OutgoingRequest
      var session,
        call = e.session,//call == _Session now//call = RTCSession {ua: UA, status: 4, dialog: null, earlyDialogs: Object, connection: null…}, e = Object {originator: "remote", session: RTCSession, r
        uri = call.remote_identity.uri,
        display_name = call.remote_identity.display_name || uri.user;

      //GUI.renderSessions();
      GUI.setCallEventHandlers(e);
    },

    // RTCSession event callback definition
    setCallEventHandlers: function(e) {
      var
        request = e.request,
        call = e.session;

      // check custom X-Can-Renegotiate header field
      if (call.direction === 'incoming') {
        if (call.request.getHeader('X-Can-Renegotiate') === 'false') {
          call.data.remoteCanRenegotiateRTC = false;
        }
        else {
          call.data.remoteCanRenegotiateRTC = true;
        }

        //GUI.playSound("sounds/incoming-call2.ogg");
      }

      call.on('connecting', function() {
        // TMP
        if (call.connection.getLocalStreams().length > 0) {
          window.localStream = call.connection.getLocalStreams()[0];
        }
      });

      // Progress
      call.on('progress',function(e){
        if (e.originator === 'remote') {
        }
      });

      // Started
      call.on('accepted',function(e){
        //Attach the streams to the views if it exists.
        if (call.connection.getLocalStreams().length > 0) {
          localStream = call.connection.getLocalStreams()[0];
          selfView = JsSIP.rtcninja.attachMediaStream(selfView, localStream);
          selfView.volume = 0;

          // TMP
          window.localStream = localStream;
        }

        if (e.originator === 'remote') {
          if (e.response.getHeader('X-Can-Renegotiate') === 'false') {
            call.data.remoteCanRenegotiateRTC = false;
          }
          else {
            call.data.remoteCanRenegotiateRTC = true;
          }
        }
      });

      //remote stream is coming
      call.on('addstream', function(e) {
        console.log('Tryit: addstream()');
        remoteStream = e.stream;
        remoteView = JsSIP.rtcninja.attachMediaStream(remoteView, remoteStream);
      });

      // Failed
      call.on('failed',function(e) {
        //GUI.playSound("sounds/outgoing-call-rejected.wav");

        /*GUI.removeSession(call.remote_identity.uri.toAor());

        if (GUI.Sessions.length === 0) {
          _Session = null;

          selfView.src = '';
          remoteView.src = '';
        }*/
      });

      // NewDTMF
      call.on('newDTMF',function(e) {
        //GUI.playSound("sounds/dialpad/" + e.dtmf.tone + ".ogg");
      });

      call.on('hold',function(e) {
        //GUI.playSound("sounds/dialpad/pound.ogg");
      });

      call.on('unhold',function(e) {
        //GUI.playSound("sounds/dialpad/pound.ogg");
      });

      // Ended
      call.on('ended', function(e) {
        /*var session, remoteStream;

        GUI.removeSession(call.remote_identity.uri.toAor());

        // last call
        if (GUI.Sessions.length === 0) {
          _Session = null;

          selfView.src = '';
          remoteView.src = '';

          JsSIP.rtcninja.closeMediaStream(localStream);

        }*/
      });

      // received UPDATE
      call.on('update', function(e) {
        var request = e.request;

        if (! request.body) { return; }

        if (! localCanRenegotiateRTC() || ! call.data.remoteCanRenegotiateRTC) {
          console.warn('Tryit: UPDATE received, resetting PeerConnection');
          call.connection.reset();
          call.connection.addStream(localStream);
        }
      });

      // received reINVITE
      call.on('reinvite', function(e) {
        var request = e.request;

        if (! e.request.body) { return; }

        /*
        if (! localCanRenegotiateRTC() || ! call.data.remoteCanRenegotiateRTC) {
          console.warn('Tryit: reINVITE received, resetting PeerConnection');
          call.connection.reset();
          call.connection.addStream(localStream);
        }
        */
      });
    },

    // JsSIP.UA new_message event listener
    new_message: function(e) {
      var session, text,
        uri = e.message.remote_identity.uri;
        display_name = e.message.remote_identity.display_name || uri.user;

      text = e.request.body;
      session = GUI.getSession(uri.toAor());

      if (!session) {
        session = GUI.createSession(display_name, uri.toAor());
      }

      if (e.originator === 'remote') {
        // compossing stuff
        if (session.compositionIndicator.received(text, e.request.getHeader('Content-Type'))) {
          return;
        }

        // reset isComposing since we are receiving a text message from the peer
        session.isComposing = false;

        //GUI.playSound("sounds/incoming-chat.ogg");
      } else if (e.originator === 'local') {

        if (e.request.getHeader('content-type').match(/iscomposing/)) {
          return;
        }

        e.message.on('failed', function(e){
          var cause;

          if (e.response)
            cause = e.response.status_code.toString() + " " + e.response.reason_phrase;
          else
            cause = e.cause.toString();

          session.chat.push({
            who: 'error',
            text: cause
          });

          //GUI.renderSessions();
        });
      }

      // set the display name
      session.displayName = display_name;

      // add text to chat collection
      session.chat.push({
        who: e.originator==='local'?'me':'peer',
        text: text
      });

      //GUI.renderSessions();
    },

    // Button Click handlers
    buttonCloseClick: function(uri) {
      console.log('Tryit: buttonCloselClick');
      //GUI.removeSession(uri, true /*force*/);
    },

    buttonDialClick: function(target) {
      console.log('Tryit: buttonDialClick');

      GUI.jssipCall(target);
    },

    buttonAnswerClick: function(call) {
      console.log('Tryit: buttonAnswerClick');

       call.answer({
         pcConfig: peerconnection_config,
         // TMP:
         mediaConstraints: {audio: true, video: true},
         extraHeaders: [
           'X-Can-Renegotiate: ' + String(localCanRenegotiateRTC())
         ],
         rtcOfferConstraints: {
           offerToReceiveAudio: 1,
           offerToReceiveVideo: 1
         },
       });
    },

    buttonHangupClick: function(call) {
      console.log('Tryit: buttonHangupClick');

      call.terminate();
    },

    buttonDtmfClick: function(call,digit) {
      console.log('Tryit: buttonDtmfClick');

      call.sendDTMF(digit);
    },

    jssipCall : function(target) {
        ua.call(target, {
            pcConfig: peerconnection_config,
            mediaConstraints: { audio: true, video:$('#enableVideo').is(':checked') },
            extraHeaders: [
              'X-Can-Renegotiate: ' + String(localCanRenegotiateRTC())
            ],
            rtcOfferConstraints: {
              offerToReceiveAudio: 1,
              offerToReceiveVideo: 1
            }
        });
    }

  };//END WINDOW GUI

});
