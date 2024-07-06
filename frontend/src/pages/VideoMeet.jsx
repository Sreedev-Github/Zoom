import React, { useEffect, useRef, useState } from 'react'
import io from "socket.io-client";
import { Badge, IconButton, TextField } from '@mui/material';
import { Button } from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import styles from "../styles/videoComponent.module.css";
import CallEndIcon from '@mui/icons-material/CallEnd'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare'
import ChatIcon from '@mui/icons-material/Chat'
import server from '../environment';

const server_url = server;

var connections = {};

const peerConfigConnections = {
    "iceServers": [
        { "urls": "stun:stun.l.google.com:19302" }
    ]
}

export default function VideoMeetComponent() {

    var socketRef = useRef();
    let socketIdRef = useRef();

    let localVideoref = useRef();

    let [videoAvailable, setVideoAvailable] = useState(true);

    let [audioAvailable, setAudioAvailable] = useState(true);

    let [video, setVideo] = useState([]);

    let [audio, setAudio] = useState();

    let [screen, setScreen] = useState();

    let [showModal, setModal] = useState(true);

    let [screenAvailable, setScreenAvailable] = useState();

    let [messages, setMessages] = useState([])

    let [message, setMessage] = useState("");

    let [newMessages, setNewMessages] = useState(3);

    let [askForUsername, setAskForUsername] = useState(true);

    let [username, setUsername] = useState("");

    const videoRef = useRef([])

    let [videos, setVideos] = useState([])

    // TODO
    // if(isChrome() === false) {


    // }

    useEffect(() => {
        console.log("HELLO");
        getPermissions();
    }, [getPermissions]);

    let getDislayMedia = () => {
        if (screen) {
            if (navigator.mediaDevices.getDisplayMedia) {
                navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
                    .then(getDislayMediaSuccess)
                    .then((stream) => { })
                    .catch((e) => console.log(e))
            }
        }
    }

    const getPermissions = async () => {
        try {
            const videoPermission = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoPermission) {
                setVideoAvailable(true);
                console.log('Video permission granted');
            } else {
                setVideoAvailable(false);
                console.log('Video permission denied');
            }

            const audioPermission = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (audioPermission) {
                setAudioAvailable(true);
                console.log('Audio permission granted');
            } else {
                setAudioAvailable(false);
                console.log('Audio permission denied');
            }

            if (navigator.mediaDevices.getDisplayMedia) {
                setScreenAvailable(true);
            } else {
                setScreenAvailable(false);
            }

            if (videoAvailable || audioAvailable) {
                const userMediaStream = await navigator.mediaDevices.getUserMedia({ video: videoAvailable, audio: audioAvailable });
                if (userMediaStream) {
                    window.localStream = userMediaStream;
                    if (localVideoref.current) {
                        localVideoref.current.srcObject = userMediaStream;
                    }
                }
            }
        } catch (error) {
            console.log(error);
        }
    };

    useEffect(() => {
        if (video !== undefined && audio !== undefined) {
            getUserMedia();
            console.log("SET STATE HAS ", video, audio);
        }
    }, [video, audio, getUserMedia]);

    let getMedia = () => {
        setVideo(videoAvailable);
        setAudio(audioAvailable);
        connectToSocketServer();
    }

    let getUserMediaSuccess = (stream) => {
        try {
            window.localStream.getTracks().forEach(track => track.stop())
        } catch (e) { console.log(e) }

        window.localStream = stream
        localVideoref.current.srcObject = stream

        for (let id in connections) {
            if (id === socketIdRef.current) continue

            connections[id].addStream(window.localStream)

            connections[id].createOffer().then((description) => {
                console.log(description)
                connections[id].setLocalDescription(description)
                    .then(() => {
                        socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                    })
                    .catch(e => console.log(e))
            })
        }

        stream.getTracks().forEach(track => track.onended = () => {
            setVideo(false);
            setAudio(false);

            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { console.log(e) }

            let blackSilence = (...args) => new MediaStream([black(...args), silence()])
            window.localStream = blackSilence()
            localVideoref.current.srcObject = window.localStream

            for (let id in connections) {
                connections[id].addStream(window.localStream)

                connections[id].createOffer().then((description) => {
                    connections[id].setLocalDescription(description)
                        .then(() => {
                            socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                        })
                        .catch(e => console.log(e))
                })
            }
        })
    }

    let getUserMedia = () => {
        if ((video && videoAvailable) || (audio && audioAvailable)) {
            navigator.mediaDevices.getUserMedia({ video: video, audio: audio })
                .then(getUserMediaSuccess)
                .then((stream) => { })
                .catch((e) => console.log(e))
        } else {
            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { }
        }
    }

    let getDislayMediaSuccess = (stream) => {
        console.log("HERE")
        try {
            window.localStream.getTracks().forEach(track => track.stop())
        } catch (e) { console.log(e) }

        window.localStream = stream
        localVideoref.current.srcObject = stream

        for (let id in connections) {
            if (id === socketIdRef.current) continue

            connections[id].addStream(window.localStream)

            connections[id].createOffer().then((description) => {
                connections[id].setLocalDescription(description)
                    .then(() => {
                        socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                    })
                    .catch(e => console.log(e))
            })
        }

        stream.getTracks().forEach(track => track.onended = () => {
            setScreen(false)

            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { console.log(e) }

            let blackSilence = (...args) => new MediaStream([black(...args), silence()])
            window.localStream = blackSilence()
            localVideoref.current.srcObject = window.localStream

            getUserMedia()
        })
    }

    let gotMessageFromServer = (fromId, message) => {
        var signal = JSON.parse(message)

        if (fromId !== socketIdRef.current) {
            if (signal.sdp) {
                connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
                    if (signal.sdp.type === 'offer') {
                        connections[fromId].createAnswer().then((description) => {
                            connections[fromId].setLocalDescription(description).then(() => {
                                socketRef.current.emit('signal', fromId, JSON.stringify({ 'sdp': connections[fromId].localDescription }))
                            }).catch(e => console.log(e))
                        }).catch(e => console.log(e))
                    }
                }).catch(e => console.log(e))
            }

            if (signal.ice) {
                connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log(e))
            }
        }
    }

    let changeCssVideos = (main) => {
        let widthMain = main.offsetWidth;
        let minWidth = "30%";
        if ((widthMain * 30 / 100) < 300) {
            minWidth = "300px";
        }
        let minHeight = "40%";
        let elms = main.querySelectorAll("video").length; // Calculate the number of video elements
        let height = String(100 / elms) + "%";
        let width = "";
        if (elms === 0 || elms === 1) {
            width = "100%";
            height = "100%";
        } else if (elms === 2) {
            width = "45%";
            height = "100%";
        } else if (elms === 3 || elms === 4) {
            width = "35%";
            height = "50%";
        } else {
            width = String(100 / elms) + "%";
        }
    
        let videos = main.querySelectorAll("video");
        for (let a = 0; a < videos.length; ++a) {
            videos[a].style.minWidth = minWidth;
            videos[a].style.minHeight = minHeight;
            videos[a].style.setProperty("width", width);
            videos[a].style.setProperty("height", height);
        }
    
        return { minWidth, minHeight, width, height };
    }
    
    let connectToSocketServer = () => {
        socketRef.current = io.connect(server_url);

        socketRef.current.on('signal', gotMessageFromServer);

        socketRef.current.on('connect', () => {
            socketIdRef.current = socketRef.current.id

            socketRef.current.emit('join-call', window.location.href)
            socketRef.current.on('chat-message', addMessage);

            socketRef.current.on('user-left', (id) => {
                let video = document.querySelector(`[data-socket="${id}"]`)
                if (video !== null) {
                    let main = document.getElementById('main')
                    video.parentNode.removeChild(video)

                    changeCssVideos(main)
                }
            })

            socketRef.current.on('user-joined', (id, clients) => {
                console.log(connections)
                clients.forEach((socketListId) => {
                    connections[socketListId] = new RTCPeerConnection(peerConfigConnections)

                    // Wait for their ice candidate
                    connections[socketListId].onicecandidate = function (event) {
                        if (event.candidate != null) {
                            socketRef.current.emit('signal', socketListId, JSON.stringify({ 'ice': event.candidate }))
                        }
                    }

                    // Wait for their video stream
                    connections[socketListId].onaddstream = (event) => {
                        let searchVidep = document.querySelector(`[data-socket="${socketListId}"]`);
                        if (searchVidep !== null) { // if i don't do this check it make an empy square
                            let main = document.getElementById('main')
                            let video = document.createElement('video')

                            video.srcObject = event.stream
                            video.autoplay = true
                            video.className = "video"
                            video.setAttribute('data-socket', socketListId)

                            main.appendChild(video)

                            let cssMesure = changeCssVideos(main)

                        }
                    }

                    // Add the local video stream
                    if (window.localStream !== undefined && window.localStream !== null && window.localStream.getTracks().length > 0) {
                        connections[socketListId].addStream(window.localStream)
                    }
                })

                if (id === socketIdRef.current) {
                    for (let id2 in connections) {
                        if (id2 === socketIdRef.current) continue

                        try {
                            connections[id2].addStream(window.localStream)
                        } catch (e) { }

                        connections[id2].createOffer().then((description) => {
                            connections[id2].setLocalDescription(description)
                                .then(() => {
                                    socketRef.current.emit('signal', id2, JSON.stringify({ 'sdp': connections[id2].localDescription }))
                                })
                                .catch(e => console.log(e))
                        })
                    }
                }
            })
        })
    }

    let silence = () => {
        let ctx = new AudioContext()
        let oscillator = ctx.createOscillator()
        let dst = oscillator.connect(ctx.createMediaStreamDestination())
        oscillator.start()
        ctx.startRendering()
        return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false })
    }

    let black = ({ width = 640, height = 480 } = {}) => {
        let canvas = Object.assign(document.createElement("canvas"), { width, height })
        canvas.getContext('2d').fillRect(0, 0, width, height)
        let stream = canvas.captureStream()
        return Object.assign(stream.getVideoTracks()[0], { enabled: false })
    }

    let handleVideo = () => setVideo(!video);

    let handleAudio = () => setAudio(!audio);

    let handleScreen = () => setScreen(!screen);

    let handleEndCall = () => {
        try {
            let tracks = localVideoref.current.srcObject.getTracks()
            tracks.forEach(track => track.stop())
        } catch (e) { }
        window.location.href = "/"
    }

    let addMessage = (data, sender, socketIdSender) => {
        console.log("ADDED");
        setMessages(messages => [...messages, { "sender": sender, "data": data }])
        if (socketIdSender !== socketIdRef.current) {
            setNewMessages(newMessages => newMessages + 1)
        }
    }

    let handleUsername = (e) => {
        setUsername(e.target.value)
    }

    let sendMessage = () => {
        socketRef.current.emit("chat-message", message, username)
        setMessages(messages => [...messages, { "sender": username, "data": message }])
        setMessage("")
        setModal(false)
    }

    return (
        <div className={styles.videoContainer}>
            <div className={styles.videoBox}>
                <div>
                    <video id="my-video" ref={localVideoref} autoPlay muted className={styles.localVideo}></video>
                </div>
                <div className={styles.otherVideos} id="main"></div>
                <div className={styles.controls}>
                    <IconButton className={styles.controlButton} onClick={handleVideo}>
                        {video ? <VideocamIcon /> : <VideocamOffIcon />}
                    </IconButton>
                    <IconButton className={styles.controlButton} onClick={handleAudio}>
                        {audio ? <MicIcon /> : <MicOffIcon />}
                    </IconButton>
                    {screenAvailable && (
                        <IconButton className={styles.controlButton} onClick={handleScreen}>
                            {screen ? <ScreenShareIcon /> : <StopScreenShareIcon />}
                        </IconButton>
                    )}
                    <Badge badgeContent={newMessages} max={999} color='secondary' onClick={() => setModal(!showModal)}>
                        <IconButton className={styles.controlButton} onClick={() => setModal(!showModal)}>
                            <ChatIcon />
                        </IconButton>
                    </Badge>
                    <IconButton className={styles.controlButton} onClick={handleEndCall}>
                        <CallEndIcon style={{ color: 'red' }} />
                    </IconButton>
                </div>
            </div>
            {showModal && (
                <div className={styles.chatBox}>
                    <div className={styles.chatHeader}>
                        <h3>Chat</h3>
                        <button className={styles.closeButton} onClick={() => setModal(false)}>X</button>
                    </div>
                    <div className={styles.chatMessages}>
                        {messages.map((msg, index) => (
                            <div key={index}>
                                <strong>{msg.sender}: </strong>
                                <span>{msg.data}</span>
                            </div>
                        ))}
                    </div>
                    <div className={styles.chatInput}>
                        <TextField
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Type a message..."
                            fullWidth
                        />
                        <Button onClick={sendMessage}>Send</Button>
                    </div>
                </div>
            )}
        </div>
    );
}
