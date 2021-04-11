const browser = require('webextension-polyfill')

// CATCHER
let inputs = document.querySelectorAll('input'), i;
let username = "";
let password = "";

for (i = 0; i < inputs.length; ++i) {

    // Find password field.
    if (inputs[i].type === "password") {
        password = inputs[i];
        
        // Find username field. Check type against type hidden or checkbox etc.
        for (var k = i; k >= 0; k--) {  
            if ((inputs[k].type == "text") || (inputs[k].type == "email")) {
                username = inputs[k];
                break;
            }
        }
    }
}

// Listen and send data to fill hashmap in the background
/* if (password !== "" && username !== "") {
    password.addEventListener('blur', function () {
        let login = browser.runtime.sendMessage({
            username: username.value,
            password: password.value,
        });
        login.then(handleResponse, handleError);
    });
}

function handleResponse(message) { console.log(`Response: ${message.response}`); }
function handleError(error) { console.log(`Error: ${error}`); } */

// FILLER
// Sender is in /src/popup/views/Logins/detail.vue
browser.runtime.onMessage.addListener((request, sender) => {
    if (username !== "") {
        username.style.borderColor = "#5707FF";
        username.value = request.msg.username;
    }

    if (password !== "") {
        password.style.borderColor = "#5707FF";
        password.value = request.msg.password;
    }
});