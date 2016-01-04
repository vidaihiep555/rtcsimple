package websocketsdemo;

import java.io.IOException;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import javax.websocket.OnClose;
import javax.websocket.OnError;
import javax.websocket.OnMessage;
import javax.websocket.OnOpen;
import javax.websocket.Session;
import javax.websocket.server.ServerEndpoint;

import org.json.JSONObject;

@ServerEndpoint("/echo")
public class EchoServer {

    private static final Set<Session> sessionList = Collections
            .synchronizedSet(new HashSet<Session>());
    private static Map<String, Set<Session>> roomList = new HashMap<>();

    /**
     * @OnOpen allows us to intercept the creation of a new session. The session
     *         class allows us to send data to the user. In the method onOpen,
     *         we'll let the user know that the handshake was successful.
     */
    @OnOpen
    public void onOpen(Session session) {
        System.out.println(session.getId() + " has opened a connection");
        /*
         * try { sessionList.add(session);
         * session.getBasicRemote().sendText("Connection Established"); } catch
         * (IOException ex) { ex.printStackTrace(); }
         */
    }

    /**
     * When a user sends a message to the server, this method will intercept the
     * message and allow us to react to it. For now the message is read as a
     * String.
     */
    @OnMessage
    public void onMessage(String message, Session sender) {
        System.out.println("XXX: " + message);
        JSONObject obj = new JSONObject(message);
        String type = obj.getString("type");
        String roomName = obj.getString("channel");
        String mes = obj.getString("message");
        switch (type) {
        case MessageTypeConstants.CREATEORJOIN:
            onCreateOrJoin(roomName, sender);
            break;
        case MessageTypeConstants.MESSAGE:
            onMessages(roomName, "Message from ID-" + sender.getId() + ": "
                    + mes, sender);
            break;
        default:
            // break;
        }
        System.out
                .println("Message from ID-" + sender.getId() + ": " + message);
        /*
         * try { for (Session s : sessionList) { s.getBasicRemote().sendText(
         * "Message from ID-" + sender.getId() + ": " + message); } //
         * session.getBasicRemote().sendText(message); } catch (IOException ex)
         * { ex.printStackTrace(); }
         */
    }

    @OnError
    public void onError(Throwable exception, Session session) {
        sessionList.remove(session);
        System.out.println("Broken pipe");
    }

    /**
     * The user closes the connection.
     *
     * Note: you can't send messages to the client from this method
     */
    @OnClose
    public void onClose(Session session) throws Exception {
        sessionList.remove(session);
        System.out.println("Session " + session.getId() + " has ended");
    }

    public void onCreateOrJoin(String roomName, Session sender) {

        if (!roomList.containsKey(roomName)) {
            // create new room
            Set<Session> sessionList = new HashSet<>();
            sessionList.add(sender);
            roomList.put(roomName, sessionList);
            sendToSender(MessageTypeConstants.CREATED, roomName, sender);
        } else {
            // log('S --> Room ' + room + ' has ' + numClients + ' client(s)');
            int numClients = roomList.get(roomName).size();
            sendToSender(MessageTypeConstants.LOG, "S --> Room" + roomName
                    + "has" + numClients + "client(s)", sender);
            // log('S --> Request to create or join room', room);
            sendToSender(MessageTypeConstants.LOG,
                    "S --> Request to create or join room: " + roomName, sender);
            Set<Session> sessionList = roomList.get(roomName);
            if (numClients == 2) {
                // full
                sendToSender(MessageTypeConstants.FULL, roomName + "is full",
                        sender);
            } else {
                // join
                sessionList.add(sender);
                sendToSender(MessageTypeConstants.JOINED, roomName, sender);
                sendToClientInRoomExceptSender(MessageTypeConstants.JOIN,
                        roomName, roomName, sender);
            }
        }

    }

    public void onMessages(String roomName, String message, Session sender) {
        // log('S --> got message: ', message.message);
        sendToSender(MessageTypeConstants.LOG, "S --> got message: " + message,
                sender);
        sendToSender(MessageTypeConstants.MESSAGE, message, sender);
        sendToClientInRoomExceptSender(MessageTypeConstants.MESSAGE, roomName,
                message, sender);
    }

    public void sendToSender(String type, String message, Session sender) {
        String messageToSender = "{\"type\":\"" + type + "\",\"message\":\""
                + message + "\"}";
        try {
            sender.getBasicRemote().sendText(messageToSender);
        } catch (IOException e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
        }
    }

    public void sendToClientInRoomExceptSender(String type, String roomName,
            String message, Session sender) {
        Set<Session> sessionList = roomList.get(roomName);
        for (Session s : sessionList) {
            if (!s.equals(sender)) {
                String messageToCallee = "{\"type\":\"" + type
                        + "\",\"message\":\"" + message + "\"}";
                try {
                    s.getBasicRemote().sendText(messageToCallee);
                } catch (IOException e) {
                    // TODO Auto-generated catch block
                    e.printStackTrace();
                }
            }
        }
    }

    public void sendAll(String message) {

    }

    public void sendInRoom(String message) {

    }

}
