const browser = require('webextension-polyfill')

console.log("Passwall started ;)")

// CATCHER
let inputs = document.querySelectorAll('input'), i;
let username = "";
let password = "";

for (i = 0; i < inputs.length; ++i) {

    // Find password
    if (inputs[i].type === "password") {
        password = inputs[i];
        
        // Find username. Check type against type hidden or checkbox etc.
        for (var k = i; k >= 0; k--) {  
            if (inputs[k].type == "text") {
                username = inputs[k];
                break;
            }
        }
    }
}

// Listen and send data to fill hashmap in the background
if (password !== "" && username !== "") {
    password.addEventListener('blur', function () {
        let login = browser.runtime.sendMessage({
            username: username.value,
            password: password.value,
        });
        login.then(handleResponse, handleError);
    });
}

function handleResponse(message) { console.log(`Response: ${message.response}`); }
function handleError(error) { console.log(`Error: ${error}`); }

// FILLER
// Sender is in /src/popup/views/Logins/detail.vue
browser.runtime.onMessage.addListener((request, sender) => {
    username.value = request.msg.username;
    password.value = request.msg.password;
});