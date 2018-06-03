


var localConnection;
var remoteConnection;
var maximumBytes;
var sendChannel;
var receiveChannel;


var megsToSend = document.querySelector('input#megsToSend');
var sendButton = document.querySelector('#sendTheData');
var orderedCheckbox = document.querySelector('input#ordered');
var sendProgress = document.querySelector('#sendProgress');
var receiveProgress = document.querySelector('#receiveProgress');
var errorMessage = document.querySelector('#errorMsg');
var totalSent = document.querySelector('#totalSent');
var totalReceive = document.querySelector('#totalReceive');

var receivedSize = 0;
var bytesToSend = 0;

sendButton.onclick = createConnection;

// Prevent data sent to be set to 0.
megsToSend.addEventListener('change', function (e) {
    if (this.value <= 0) {
        sendButton.disabled = true;
        errorMessage.innerHTML = '<p>Please enter a number greater than zero.</p>';
    } else {
        sendButton.disabled = false;
    }
});

function createConnection() {
    errorMessage.innerHTML = 'Generating...';
    console.log("here");
    sendButton.disabled = true;
    megsToSend.disabled = true;
    var servers = null;

    bytesToSend = Math.round(megsToSend.value) * 1024 * 1024;

    localConnection = new RTCPeerConnection(servers);
    trace('Created local peer connection object localConnection');

    var dataChannelParams = { ordered: false };
    // if (orderedCheckbox.checked) {
    //     dataChannelParams.ordered = true;
    // }

    sendChannel = localConnection.createDataChannel(
        'sendDataChannel', dataChannelParams);
    sendChannel.binaryType = 'arraybuffer';
    trace('Created send data channel');

    sendChannel.onopen = onSendChannelStateChange;
    sendChannel.onclose = onSendChannelStateChange;
    localConnection.onicecandidate = function (e) {
        onIceCandidate(localConnection, e);
    };

    localConnection.createOffer().then(
        gotDescription1,
        onCreateSessionDescriptionError
    );

    remoteConnection = remoteConnection = new RTCPeerConnection(servers);
    trace('Created remote peer connection object remoteConnection');

    remoteConnection.onicecandidate = function (e) {
        onIceCandidate(remoteConnection, e);
    };
    remoteConnection.ondatachannel = receiveChannelCallback;
}

function onCreateSessionDescriptionError(error) {
    trace('Failed to create session description: ' + error.toString());
}

function randomAsciiString(length) {
    var result = '';
    for (var i = 0; i < length; i++) {
        // Visible ASCII chars are between 33 and 126.
        result += String.fromCharCode(33 + Math.random() * 93);
    }
    return result;
}

function sendGeneratedData() {

    sendProgress.max = bytesToSend;
    receiveProgress.max = sendProgress.max;
    maximumBytes = bytesToSend;
    var sentBytes = 0;

    sendProgress.value = 0;
    receiveProgress.value = 0;

    var chunkSize = 16384;
    var stringToSendRepeatedly = randomAsciiString(chunkSize);
    var bufferFullThreshold = 5 * chunkSize;

    var usePolling = true;

    if (typeof sendChannel.bufferedAmountLowThreshold === 'number') {
        trace('Using the bufferedamountlow event for flow control');
        usePolling = false;

        // Reduce the buffer fullness threshold, since we now have more efficient
        // buffer management.
        bufferFullThreshold = chunkSize / 2;

        // This is "overcontrol": our high and low thresholds are the same.
        sendChannel.bufferedAmountLowThreshold = bufferFullThreshold;
    }
    // Listen for one bufferedamountlow event.
    var listener = function () {
        sendChannel.removeEventListener('bufferedamountlow', listener);
        sendAllData();
    };
    var sendAllData = function () {
        // Try to queue up a bunch of data and back off when the channel starts to
        // fill up. We don't setTimeout after each send since this lowers our
        // throughput quite a bit (setTimeout(fn, 0) can take hundreds of milli- 
        // seconds to execute).
        while (sentBytes <= maximumBytes) {
            if (sendChannel.bufferedAmount > bufferFullThreshold) {
                if (usePolling) {
                    //if buffer is full, call function after 250 ms 
                    setTimeout(sendAllData, 250);
                } else {
                    sendChannel.addEventListener('bufferedamountlow', listener);
                }
                return;
            }
            sentBytes += chunkSize;
            updateProgressbarSend(sentBytes);
            sendChannel.send(stringToSendRepeatedly);
        }
    };
    setTimeout(sendAllData, 0);
}

//----------for updateing the progressBar
function updateProgressbarSend(sent) {
    
    var persentage = (sent / maximumBytes) * 100;
    persentage = Math.floor(persentage);
    totalSent.innerText = sent + " bytes";
    sendProgress.style.width = persentage + '%';

}

function updateProgressbarReceive(receive) {
    var persentage = (receive / maximumBytes) * 100;
    persentage = Math.floor(persentage);
    totalReceive.innerText = receive + " bytes";
    receiveProgress.style.width = persentage + '%';
}
//_______________________________________


function closeDataChannels() {
        errorMessage.innerHTML = "Status: Done"
    trace('Closing data channels');
    sendChannel.close();
    trace('Closed data channel with label: ' + sendChannel.label);
    receiveChannel.close();
    trace('Closed data channel with label: ' + receiveChannel.label);
    localConnection.close();
    remoteConnection.close();
    localConnection = null;
    remoteConnection = null;
    trace('Closed peer connections');
}

function gotDescription1(desc) {
    localConnection.setLocalDescription(desc);
    trace('Offer from localConnection \n' + desc.sdp);
    remoteConnection.setRemoteDescription(desc);
    remoteConnection.createAnswer().then(
        gotDescription2,
        onCreateSessionDescriptionError
    );
}

function gotDescription2(desc) {
    remoteConnection.setLocalDescription(desc);
    trace('Answer from remoteConnection \n' + desc.sdp);
    localConnection.setRemoteDescription(desc);
}

function getOtherPc(pc) {
    return (pc === localConnection) ? remoteConnection : localConnection;
}

function getName(pc) {
    return (pc === localConnection) ? 'localPeerConnection' :
        'remotePeerConnection';
}

function onIceCandidate(pc, event) {
    getOtherPc(pc).addIceCandidate(event.candidate)
        .then(
            function () {
                onAddIceCandidateSuccess(pc);
            },
            function (err) {
                onAddIceCandidateError(pc, err);
            }
        );
    trace(getName(pc) + ' ICE candidate: \n' + (event.candidate ?
        event.candidate.candidate : '(null)'));
}

function onAddIceCandidateSuccess() {
    trace('AddIceCandidate success.');
}

function onAddIceCandidateError(error) {
    trace('Failed to add Ice Candidate: ' + error.toString());
}

function receiveChannelCallback(event) {
    trace('Receive Channel Callback');
    receiveChannel = event.channel;
    receiveChannel.binaryType = 'arraybuffer';
    receiveChannel.onmessage = onReceiveMessageCallback;

    receivedSize = 0;
}

function onReceiveMessageCallback(event) {
    receivedSize += event.data.length;

    updateProgressbarReceive(receivedSize);

    if (receivedSize === bytesToSend) {
        closeDataChannels();
        sendButton.disabled = false;
        megsToSend.disabled = false;
    }
}

function onSendChannelStateChange() {
    var readyState = sendChannel.readyState;
    trace('Send channel state is: ' + readyState);
    if (readyState === 'open') {
        sendGeneratedData();
    }
}

function trace(text) {
    if (text[text.length - 1] === '\n') {
        text = text.substring(0, text.length - 1);
    }
    if (window.performance) {
        var now = (window.performance.now() / 1000).toFixed(3);
        console.log(now + ': ' + text);
    } else {
        console.log(text);
    }
}
