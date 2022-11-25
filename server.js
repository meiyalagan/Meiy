/*
*@autor: Rio 3D Studios
*@description:  java script file that works as master server of  Game
*@date: 07/04/2020
*/
var express = require('express'); //import express NodeJS framework module

var app = express(); // create an object of the express module

var http = require('http').Server(app); // create a http web server using the http library

var io = require('socket.io')(http); // import socketio communication module

var shortId 		= require('shortid');


app.use("/public/TemplateData",express.static(__dirname + "/public/TemplateData"));

app.use("/public/Build",express.static(__dirname + "/public/Build"));

app.use(express.static(__dirname+'/public'));

var clientLookup = {};
var sockets = {};//// to storage sockets

/**
 * Instance Variables
 */
const rooms = {};
function getDistance(x1, y1, x2, y2){
    let y = x2 - x1;
    let x = y2 - y1;
    
    return Math.sqrt(x * x + y * y);
}
/**
 * Will connect a socket to a specified room
 * @param socket A connected socket.io socket
 * @param room An object that represents a room from the `rooms` instance variable object
 */
const joinRoom = (socket, room,playernew) => {

  
    console.log("max players: "+room.max_players);
  if(room.current_players<room.max_players)
  {

   room.sockets.push(socket);
   room.listofplayer.push(playernew);
   room.current_players +=1;
   
   console.log("current players: "+room.current_players);

   clientLookup[socket.id].roomID = room.id;
	 console.log("add player");



  if(room.current_players== room.max_players)
  {
   //start game
    socket.join(room.id, () => {
      // store the room id in the socket for future use
      socket.roomId = room.id;
      console.log(socket.id, "Joined", room.id);



	  // Tell all the players to start game
      for (const s in room.sockets) {
        console.log("emit can start game");
	   //spawn current player for current player
	   room.sockets[s].emit('CAN_START_GAME');
	   
      }//END_FOR

      });//ENDSOCKET.JOIN
  }//END_IF

 //first player
    if(room.current_players == 1)
	{
	  console.log('sending to master client');
	  //master client
	  socket.join(room.id, () => {
      // store the room id in the socket for future use
      socket.roomId = room.id;
      console.log(socket.id, "Joined", room.id);

       socket.emit("CREATE_ROOM_SUCCESS",room.id,room.current_players,room.max_players, room.map);//END_SOCKET.EMIT

      });//ENDSOCKET.JOIN

	}//END_IF

	else
	{
	  console.log('sending to others clients');
	  //start game
      socket.join(room.id, () => {
      // store the room id in the socket for future use
      socket.roomId = room.id;
      console.log(socket.id, "Joined", room.id);

	  socket.emit('OPEN_LOBBY_ROOM',room.id, room.current_players, room.max_players, room.map);

      // Tell all the players to start game
      for (const socket in room.sockets) {

	    console.log("socket id:"+room.sockets[socket].id );
	    console.log("send to:"+clientLookup[room.sockets[socket].id].name );
	    room.sockets[socket].emit('UPDATE_CURRENT_PLAYERS',room.current_players);


      }//END_FOR

      });//ENDSOCKET.JOIN

	}//END_ELSE


  }//END_IF

};

/**
 * Will make the socket leave any rooms that it is a part of
 * @param socket A connected socket.io socket
 */
const leaveRooms = (socket) => {
  const roomsToDelete = [];
  for (const id in rooms) {
    const room = rooms[id];
    // check to see if the socket is in the current room
    if (room.sockets.includes(socket)) {
      socket.leave(id);
      // remove the socket from the room object
      room.sockets = room.sockets.filter((item) => item !== socket);
    }
    // Prepare to delete any rooms that are now empty
    if (room.sockets.length == 0) {
      roomsToDelete.push(room);
    }
  }

  // Delete all the empty rooms that we found earlier
  for (const room of roomsToDelete) {
    delete rooms[room.id];
  }
};



//open a connection with the specific client
io.on('connection', function(socket){

 console.log('A user ready for connection!');//prints in the  nodeJS console

  
  var sended = false;
  
  var muteAll = false;

  var current_player;

 //create a callback fuction to listening EmitPing() method in NetworkMannager.cs unity script
  socket.on("PING",function(_data){

   var pack = JSON.parse(_data);
   console.log('menssagem recebida do unity: '+pack.message);

   var json_pack = {

     message:"pong!!!"

   };

  socket.emit("PONG",json_pack.message);


});//END_SOCKET.ON

/**
   * Gets fired when a user wants to create a new room.
   */
 socket.on('CREATE_ROOM', function(_data){

   var pack = JSON.parse(_data);
  // fills out with the information emitted by the player in the unity
  current_player = {

    name : pack.name,
    id: socket.id,
	  avatar: pack.avatar,
	  dx:pack.dx,
	  dy:pack.dy,
	  dz:pack.dz,
	  rotation:'r',
	  health:100,
	  maxHealth:100,
      muteUsers:[],
	  roomID:'',
	  isDead:false

	};

  console.log("[INFO] player " + current_player.id + ": logged!");
		 sockets[current_player.id] = socket;//add curent user socket
  clientLookup[current_player.id] = current_player;

    const room = {
	    name: pack.name,
      id: shortId.generate(), // generate a unique id for the new room, that way we don't need to deal with duplicates.
      current_players:0,
	    max_players: pack.max_players,
	    map: pack.map,
	    isPrivate: pack.isPrivateRoom,
      sockets: [],
	  listofplayer: []
    };
    rooms[room.id] = room;
    // have the socket join the room they've just created.
    joinRoom(socket, room,current_player);
	

  });

  socket.on("START_GAME",function(){

	  socket.emit('START_GAME', current_player.id,current_player.name,current_player.avatar);
	  const room = rooms[socket.roomId];
	  					        console.log("current_player "+current_player.id);



	   //spawn all connected clients for currentUser client 

         room.listofplayer.forEach( function(i) {
		    if(i.id!=current_player.id)
			{ 
		      //send to the client.js script
		      socket.emit('SPAWN_PLAYER',i.id,i.name,i.avatar,i.dx,i.dy,i.dz,i.rotation);
			        console.log("id "+i.id+".."+i.dx);
			        console.log("room player count "+room.sockets.length);

		    }//END_IF
	   
	     });//end_forEach
		
		 // spawn currentUser client on clients in broadcast
	//	socket.broadcast.emit('SPAWN_PLAYER', current_player.id,current_player.name,current_player.avatar,current_player.dx,current_player.dy,current_player.dz);

  });

//create a callback fuction to listening EmitJoin() method in NetworkMannager.cs unity script
socket.on("JOIN_ROOM",function(_data){

   var pack = JSON.parse(_data);
  if (pack.roomID in rooms)
  {
      console.log("receive join room");
      // fills out with the information emitted by the player in the unity
      current_player = {

          name : pack.name,
    id: socket.id,
	  avatar: pack.avatar,
	  dx:pack.dx,
	  dy:pack.dy,
	  dz:pack.dz,
	  rotation:'r',
	  health:100,
	  maxHealth:100,
      muteUsers:[],
	  roomID:'',
	  isDead:false

      };

      console.log("[INFO] player " + current_player.name + ": logged!");
      clientLookup[current_player.id] = current_player;
	  		 sockets[current_player.id] = socket;//add curent user socket

      joinRoom(socket,rooms[pack.roomID],current_player);
    }//END_IF
    else
    {
     console.log("room doesn't exist!");
    }


});//END_SOCKET.ON



 socket.on('CHANGE_AVATAR', function(_data){

    var pack = JSON.parse(_data);
  clientLookup[current_player.id].avatar = pack.avatar;

 });


socket.on('GET_ROOMS',function(_data){

    var pack = JSON.parse(_data);
  console.log("receive get room");
  // Tell all the players to start game
  for (const room in rooms) {



  console.log("room: "+rooms[room].name);

     if(pack.map == rooms[room].map  && rooms[room].current_players<rooms[room].max_players &&rooms[room].isPrivate=="False")
	 {
	   console.log("sending room");

	   socket.emit('UPDATE_ROOMS',rooms[room].id,
	                               rooms[room].name,
	                               rooms[room].current_players,
	                               rooms[room].max_players
		);
	 }


  }//END_FOR


});//END_SOCKET.ON

socket.on("POS_AND_ROT",function(_data){
	   console.log("posz"+_data);

var pack = JSON.parse(_data);


 clientLookup[current_player.id].dx = pack.dx;

 clientLookup[current_player.id].dy = pack.dy;
 clientLookup[current_player.id].dz = pack.dz;

 clientLookup[current_player.id].rotation = pack.rotation;
 var data = {
   id:current_player.id,
   dx:pack.dx,
   dy:pack.dy,
   dz:pack.dz,
   rotation:pack.rotation
 };


 const room = rooms[socket.roomId];
 //broadcast emit
  socket.broadcast.emit('UPDATE_POS_AND_ROT',data.id,data.dx,data.dy,data.dz,data.rotation);

});//END_SOCKET.ON



socket.on('ANIMATION',function(_data){

 var pack = JSON.parse(_data);

 const room = rooms[socket.roomId];
 //broadcast emit
  socket.to(room.id).emit('UPDATE_ANIMATOR',current_player.id,
                                            pack.animation);

});//END_SOCKET.ON



socket.on('MUTE_ALL_USERS', function ()
	{
	  if(current_player )
      {
		current_player.muteAll = true;
		 room.listofplayer.forEach(function(u) {
		current_player.muteUsers.push( clientLookup[u.id] );
		 });
	  }
	});//END_SOCKET_ON
	
	
	socket.on('REMOVE_MUTE_ALL_USERS', function ()
	{
	  if(current_player )
      {
		current_player.muteAll = false;
		while(current_player.muteUsers.length > 0) {
         current_player.muteUsers.pop();
        }
	  }
	});//END_SOCKET_ON
	
	socket.on('ADD_MUTE_USER', function (_data)
	{
	  var data = JSON.parse(_data);	
	  if(current_player )
      {
		console.log("add mute user: "+clientLookup[data.id].name);
		current_player.muteUsers.push( clientLookup[data.id] );
	  }
	});//END_SOCKET_ON
	
	socket.on('REMOVE_MUTE_USER', function (_data)
	{
	  var data = JSON.parse(_data);	
	  if(current_player )
      {
		 for (var i = 0; i < current_player.muteUsers.length; i++)
		 {
			if (current_player.muteUsers[i].id == data.id) 
			{
				console.log("User "+current_player.muteUsers[i].name+" has removed from the mute users list");
				current_player.muteUsers.splice(i,1);

			};
		};
	  }
	});//END_SOCKET_ON
	

socket.on("VOICE", function (data) {
	var minDistanceToPlayer = 3;
		  const room = rooms[socket.roomId];

  if(current_player )
  {

   var newData = data.split(";");
   
    newData[0] = "data:audio/ogg;";
    newData = newData[0] + newData[1];
	  	    //console.log("socket id:emitting voicedddddddddddddd" );

     room.listofplayer.forEach(function(u) {
		var distance = getDistance(parseFloat(current_player.posX), parseFloat(current_player.posY),parseFloat(u.posX), parseFloat(u.posY))
		var muteUser = false;
			  	  	  //  console.log("socket id:emitting voicedddddddddddddd" );

							 sockets[u.id].emit('UPDATE_VOICE',newData);
         sockets[u.id].broadcast.emit('SEND_USER_VOICE_INFO', current_player.id);
      if(sockets[u.id]&&u.id!= current_player.id&&!current_player.isMute&& distance < minDistanceToPlayer &&!muteUser &&! sockets[u.id].muteAll)
      {
	    console.log("socket id:"+sockets[u.id]+"emitting voice" );
		 sockets[u.id].emit('UPDATE_VOICE',newData);
         sockets[u.id].broadcast.emit('SEND_USER_VOICE_INFO', current_player.id);
      }
    });
  }
});



socket.on("AUDIO_MUTE", function (data) {

if(current_player)
{
  current_player.isMute = !current_player.isMute;

}

});



socket.on('disconnect', function ()
	{
        console.log("User  has disconnected");
		const room = rooms[socket.roomId];

	      if(current_player)
		    {
		       current_player.isDead = true;

			   //broadcast emit
               socket.to(room.id).emit('USER_DISCONNECTED', current_player.id);


		       delete clientLookup[current_player.id];

			   leaveRooms(socket);


         }
    });//END_SOCKET.ON


});//END_IO.ON


http.listen(process.env.PORT ||3000, function(){
	console.log('listening on *:3000');
});

console.log('------- NodeJS server is running -------');
