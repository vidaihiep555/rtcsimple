// Global variables (kill me).
//var register_checkbox = null;
//var phone_dialed_number_screen = null;
var phone_call_button = null;
var phone_accept_button = null;
var phone_reject_button = null;
var phone_hangup_button = null;
var phone_chat_button = null;
//var phone_dialpad_button = null;
//var soundPlayer = null;
//var _Session = null;  // The last RTCSession instance.
var peerconnection_config = peerconnection_config || undefined;

$(document).ready(function(){
    // Global variables.
  var PageTitle = "JsSIP Tryit";
  document.title = PageTitle;
  phone_accept_button = $('#acceptbtn');
  //register_checkbox = $("#phone > .status #register");
  //phone_dialed_number_screen = $("#phone > .controls  input.destination");
  phone_call_button = $("#callbtn");
  phone_chat_button = $("#phone > .controls > .dialbox > .dial-buttons > .chat");
  //phone_dialpad_button = $("#phone > .controls > .dialpad .button");
  //soundPlayer = document.createElement("audio");
  //soundPlayer.volume = 1;
  phone_reject_button = $('#rejectbtn');
  phone_hangup_button = $('#hangungbtn');
	// Local variables.

    var display_name = null;
    var sip_uri = null;
    var sip_password = null;
    var ws_servers = null;

    var ws_was_connected = false;

    var login_form = $("#login-form");
    var login_inputs = $("#login-form input");
    var login_display_name = $("#login-form input#display_name");
    var login_sip_uri = $("#login-form input#sip_uri");
    var login_sip_password = $("#login-form input#sip_password");
    var login_ws_servers = $("#login-form input#ws_servers");

    login_form.submit(function() {
        login_advanced_settings.hide();
        try {
          phoneInit();
        } catch(err) {
          console.warn(err.toString());
          alert(err.toString());
        }
        return false;
    });

	function phoneInit() {
		var configuration;

		// If js/custom.js was found then use its CustomJsSIPSettings object.
		//if (window.CustomJsSIPSettings) {
		//	configuration = CustomJsSIPSettings;
		//}

		// Otherwise load data from the forms.
		//else {
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
			//Y_U_NO("Y U NO SIP URI ?");
			return false;
		}
		else if (! ws_servers) {
			//Y_U_NO("Y U NO WS URI ?");
			return false;
		}

		  // Advanced Settings.

		  //var authorization_user = $("#advanced-settings-form input[name$='authorization_user']").val();
		  var register = $("#advanced-settings-form input[name$='register']").is(':checked');
		  //var register_expires = window.parseInt($("#advanced-settings-form input[name$='register_expires']").val());
		  //var registrar_server = $("#advanced-settings-form input[name$='registrar_server']").val();
		  //var no_answer_timeout = window.parseInt($("#advanced-settings-form input[name$='no_answer_timeout']").val());
		  //var session_timers = $("#advanced-settings-form input[name$='session_timers']").is(':checked');
		  //peerconnection_config = JSON.parse($("#advanced-settings-form input[name$='peerconnection_config']").val());
          peerconnection_config = JSON.parse('{ "iceServers": [ {"urls": ["stun:stun.l.google.com:19302"]} ], "gatheringTimeout": 2000 }');
		  //var use_preloaded_route = $("#advanced-settings-form input[name$='use_preloaded_route']").is(':checked');
		  //var connection_recovery_min_interval = window.parseInt($("#advanced-settings-form input[name$='connection_recovery_min_interval']").val());
		  //var connection_recovery_max_interval = window.parseInt($("#advanced-settings-form input[name$='connection_recovery_max_interval']").val());
		  //var hack_via_tcp = $("#advanced-settings-form input[name$='hack_via_tcp']").is(':checked');
		  //var hack_via_ws = $("#advanced-settings-form input[name$='hack_via_ws']").is(':checked');
		  //var hack_ip_in_contact = $("#advanced-settings-form input[name$='hack_ip_in_contact']").is(':checked');

		  configuration  = {
		  	log: { level: 'debug' },
		  	uri: sip_uri,
		  	password:  sip_password,
		  	ws_servers:  ws_servers,
		  	display_name: display_name,
		  	//authorization_user: authorization_user,
		  	register: register
		  	//register_expires: register_expires,
		  	//registrar_server: registrar_server,
		  	//no_answer_timeout: no_answer_timeout,
		  	//session_timers: session_timers,
		  	//use_preloaded_route: use_preloaded_route,
		  	//connection_recovery_min_interval: connection_recovery_min_interval,
		  	//connection_recovery_max_interval: connection_recovery_max_interval,
		  	//hack_via_tcp: hack_via_tcp,
		  	//hack_via_ws: hack_via_ws,
		  	//hack_ip_in_contact: hack_ip_in_contact
		  };
		//}

		try {
			ua = new JsSIP.UA(configuration);
		} catch(e) {
			console.log(e.toString());
			//Y_U_NO(e.message, 4000);
			return;
		}

		//$("#phone > .status .user").text(sip_uri);
		//phone_dialed_number_screen.focus();
		//div_webcam.show();

		// Transport connection/disconnection callbacks
		ua.on('connected', function(e) {
			document.title = PageTitle;
			//GUI.setStatus("connected");
		  // Habilitar el phone.
		  //$("#phone .controls .ws-disconnected").hide();

		  ws_was_connected = true;
		});

		ua.on('disconnected', function(e) {
			document.title = PageTitle;
			//GUI.setStatus("disconnected");
		  // Deshabilitar el phone.
		  //$("#phone .controls .ws-disconnected").show();
		  // Eliminar todas las sessiones existentes.
		  $("#sessions > .session").each(function(i, session) {
		  	GUI.removeSession(session, 500);
		  });

		  if (! ws_was_connected) {
		    //alert("WS connection error:\n\n- WS close code: " + e.data.code + "\n- WS close reason: " + e.data.reason);
		    console.error("WS connection error | WS close code: " + e.code + " | WS close reason: " + e.reason);
		    //if (! window.CustomJsSIPSettings) { window.location.reload(false); }
		  }
		});

		register_checkbox.change(function(event) {
			if ($(this).is(":checked")) {
				console.warn("register_checkbox has been checked");
		    // Don't change current status for now. Registration callbacks will do it.
		    register_checkbox.attr("checked", false);
		    // Avoid new change until the registration action ends.
		    register_checkbox.attr("disabled", true);
		    ua.register();
    		}
    		else {
    			console.warn("register_checkbox has been unchecked");
    		    // Don't change current status for now. Registration callbacks will do it.
    		    register_checkbox.attr("checked", true);
    		    // Avoid new change until the registration action ends.
    		    register_checkbox.attr("disabled", true);
    		    ua.unregister();
    		}
		});

		// NOTE: Para hacer unregister_all (esquina arriba-dcha un cuadro
		// transparente de 20 x 20 px).
		/*$("#unregister_all").click(function() {
			ua.unregister({'all': true});
		});

		// NOTE: Para desconectarse/conectarse al WebSocket.
		$("#ws_reconnect").click(function() {
			if (ua.transport.connected)
				ua.transport.disconnect();
			else
				ua.transport.connect();
		});*/

		phone_call_button.click(function(event) {
			GUI.phoneCallButtonPressed();
		});

		phone_chat_button.click(function(event) {
			//GUI.phoneChatButtonPressed();
		});

        phone_accept_button.click(function(){
            //call la incoming
            GUI.buttonAnswerClick(this.state.call);
        });

        phone_reject_button.click(function(){

        });

        phone_hangup_button.click(function(){

        });

        


		/*phone_dialpad_button.click(function() {
			if ($(this).hasClass("digit-asterisk"))
				sound_file = "asterisk";
			else if ($(this).hasClass("digit-pound"))
				sound_file = "pound";
			else
				sound_file = $(this).text();
			soundPlayer.setAttribute("src", "sounds/dialpad/" + sound_file + ".ogg");
			soundPlayer.play();

			phone_dialed_number_screen.val(phone_dialed_number_screen.val() + $(this).text());
		});

		phone_dialed_number_screen.keypress(function(e) {
		   // Enter pressed? so Dial.
		   if (e.which == 13)
		   	GUI.phoneCallButtonPressed();
		});*/

		// Call/Message reception callbacks
		ua.on('newRTCSession', function(e) {
		  // Set a global '_Session' variable with the session for testing.
		  _Session = e.session;
		  GUI.new_call(e);
		});

		ua.on('newMessage', function(e) {
			GUI.new_message(e)
		});

		// Registration/Deregistration callbacks
		ua.on('registered', function(e){
			console.info('Registered');
			//GUI.setStatus("registered");

			/*if (invitedBy) {
    		    // This fails in Chrome M38 (it does not propmt for getUseMedia).
    		    // phone_dialed_number_screen.val(invitedBy);
    		    // phone_call_button.click();
    		    // var invited_session = GUI.getSession("sip:" + invitedBy + "@" + tryit_sip_domain);
    		    // invitedBy = null;

    		    // $(invited_session).find(".chat > input[type='text']").val("Hi there, you have invited me to call you :)");
    		    // var e = jQuery.Event("keydown");
    		    // e.which = 13  // Enter
    		    // $(invited_session).find(".chat > input[type='text']").trigger(e);
    		    // $(invited_session).find(".chat > input[type='text']").focus();

    		    // So let's just chat.
    		    phone_dialed_number_screen.val(invitedBy);
    		    phone_chat_button.click();
    		    var invited_session = GUI.getSession("sip:" + invitedBy + "@" + tryit_sip_domain);
    		    invitedBy = null;

    		    $(invited_session).find(".chat > input[type='text']").val("Hi there, wanna talk?");
    		    var e = jQuery.Event("keydown");
    		    e.which = 13  // Enter
    		    $(invited_session).find(".chat > input[type='text']").trigger(e);
    		    $(invited_session).find(".chat > input[type='text']").focus();
    		}*/
		});

		ua.on('unregistered', function(e){
			console.info('Deregistered');
			//GUI.setStatus("connected");
		});

		ua.on('registrationFailed', function(e) {
			console.info('Registration failure');
			//GUI.setStatus("connected");

			if (! e.response) {
		    // alert("SIP registration error:\n" + e.data.cause);
    		}
    		else {
    		    // alert("SIP registration error:\n" + e.data.response.status_code.toString() + " " + e.data.response.reason_phrase)
    		}
    		  // if (! window.CustomJsSIPSettings) { window.location.reload(false); }
    	});

		// Start
		ua.start();

		// Remove login page.
		/*$("#login-full-background").fadeOut(1000, function() {
			$(".balloonTip").css("display", "none");
			$(this).remove();
		});
		$("#login-box").fadeOut(1000, function() {
			$(this).remove();
		});*/

		// Apply custom settings.
		if (window.Settings) {
			if (window.Settings.videoDisabledByDefault) {
				$('#enableVideo').prop('checked', false);
			}
		}


		// Invitation text and balloon for tryit.jssip.net accounts.

		/*if (ua.configuration.uri.host === tryit_sip_domain) {
			$("#call-invitation").show();
			$("#call-invitation").click(function() { return false; });

			var invitation_link = invitation_link_pre + ua.configuration.uri.user;

			$("#call-invitation > a").balloon({
				position: "bottom",
				contents: "<p>copy and give the following link to others (via e-mail, chat, fax):</p><a href='" + invitation_link + "' target='_blank'>" + invitation_link + "</a>",
				classname: "balloonInvitationTip",
				css: {
					border: 'solid 1px #000',
					padding: '4px 10px',
					fontSize: '150%',
					fontWeight: 'bold',
					textAlign: 'center',
					lineHeight: '2',
					backgroundColor: '#FFF',
					color: '#444'
				}
			});
		}*/
	}
}