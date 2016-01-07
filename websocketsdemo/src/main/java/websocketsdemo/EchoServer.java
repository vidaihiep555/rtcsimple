package websocketsdemo;

import java.io.IOException;
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

    // private static final Set<Session> sessionList = Collections
    // .synchronizedSet(new HashSet<Session>());
    private static Map<String, Set<Session>> roomList = new HashMap<>();

    /**
     * @OnOpen allows us to intercept the creation of a new session. The session
     *         class allows us to send data to the user. In the method onOpen,
     *         we'll let the user know that the handshake was successful.
     */
    @OnOpen
    public void onOpen(Session session) {
        System.out.println(session.getId() + " has opened a connection");
        // sendToSender(type, roomName, message, sender);
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
        // System.out.println("XXX: " + message);
        JSONObject obj = new JSONObject(message);
        String type = obj.getString("type");
        String roomName = obj.getString("channel");
        String mes = obj.getString("message");
        switch (type) {
        case MessageTypeConstants.CREATEORJOIN:
            if (!roomName.equals(""))
                onCreateOrJoin(roomName, sender);
            else
                sendToSender(MessageTypeConstants.ERROR, roomName,
                        "The channel name is null", sender);
            break;
        case MessageTypeConstants.MESSAGE:
            Set<Session> sessionList = roomList.get(roomName);
            if (sessionList != null && sessionList.contains(sender)) {
                onMessages(roomName, mes, sender);
            }
            break;
        case MessageTypeConstants.LEAVE:
            onLeave(roomName, mes, sender);
            break;
        default:
            // break;
        }
        // System.out
        // .println("Message from ID-" + sender.getId() + ": " + message);
    }

    @OnError
    public void onError(Throwable exception, Session session) {
        // sessionList.remove(session);
        removeSessionFromChannel(session);
        System.out.println("Broken pipe");
    }

    /**
     * The user closes the connection.
     *
     * Note: you can't send messages to the client from this method
     */
    @OnClose
    public void onClose(Session session) throws Exception {
        // sessionList.remove(session);
        removeSessionFromChannel(session);
        System.out.println("Session " + session.getId() + " has ended");
    }

    public void onCreateOrJoin(String roomName, Session sender) {

        if (!roomList.containsKey(roomName)) {
            // create new room
            Set<Session> sessionList = new HashSet<>();
            sessionList.add(sender);
            roomList.put(roomName, sessionList);
            sendToSender(MessageTypeConstants.CREATED, roomName,
                    "ID-" + sender.getId() + " created channel: " + roomName,
                    sender);
        } else {
            int numClients = roomList.get(roomName).size();
            // sendToSender(MessageTypeConstants.LOG, roomName, "S --> Room"
            // + roomName + "has" + numClients + "client(s)", sender);
            // sendToSender(MessageTypeConstants.LOG, roomName,
            // "S --> Request to create or join room: " + roomName, sender);
            Set<Session> sessionList = roomList.get(roomName);
            if (numClients >= 2) {
                // full
                sendToSender(MessageTypeConstants.FULL, roomName, "Channel "
                        + roomName + "is full", sender);
            } else {
                // join
                sessionList.add(sender);
                sendToSender(MessageTypeConstants.JOINED, roomName,
                        "Joined channel " + roomName, sender);
                sendToClientInRoomExceptSender(MessageTypeConstants.JOIN,
                        roomName, "ID-" + sender.getId() + "joined channel "
                                + roomName, sender);
            }
        }
    }

    public void onMessages(String roomName, String message, Session sender) {
        // sendToSender(MessageTypeConstants.LOG, "S --> got message: " +
        // message,
        // sender);
        sendToSender(MessageTypeConstants.MESSAGE, roomName, message, sender);
        sendToClientInRoomExceptSender(MessageTypeConstants.MESSAGE, roomName,
                message, sender);
    }

    public void onLeave(String roomName, String message, Session sender) {
        Set<Session> sessionList = roomList.get(roomName);
        if(sessionList!=null){
            sessionList.remove(sender);
            sendToSender(MessageTypeConstants.LEAVE, roomName,
                    "ID-" + sender.getId() + " has left", sender);
            sendToClientInRoomExceptSender(MessageTypeConstants.LEAVE, roomName,
                    "ID-" + sender.getId() + " has left", sender);
            if (sessionList.size() == 0)
                removeChannel(roomName);
        }

    }

    public void sendToSender(String type, String roomName, String message,
            Session sender) {
        JSONObject messageObj = new JSONObject().put("type", type)
                .put("channel", roomName).put("message", message);
        String messageToSender = messageObj.toString();
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
                JSONObject messageObj = new JSONObject().put("type", type)
                        .put("channel", roomName).put("message", message);
                String messageToCallee = messageObj.toString();
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

    public void removeSessionFromChannel(Session session) {
        for (Map.Entry<String, Set<Session>> e : roomList.entrySet()) {
            Set<Session> sessionList = e.getValue();
            sessionList.remove(session);
        }
    }

    public void removeChannel(String roomName) {
        roomList.remove(roomName);
    }

    public boolean isChannelAvailable(String roomName) {
        if (roomList.get(roomName) == null)
            return false;
        return true;
    }

}
