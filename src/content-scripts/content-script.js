const browser = require('webextension-polyfill')

console.log("Passwall started ;)")

let inputs = document.querySelectorAll('input'), i;
let username = "";
let password = "";

for (i = 0; i < inputs.length; ++i) {
    if (inputs[i].type === "password") {
        password = inputs[i];
        username = inputs[i-1];
    }
}

if (password !== "" && username !== "") {
    password.addEventListener('blur', function () {
        let login = browser.runtime.sendMessage({
            username: username.value,
            password: password.value,
        });
        login.then(handleResponse, handleError);
    });
}

function handleResponse(message) {console.log(`Response: ${message.response}`);}
function handleError(error) {console.log(`Error: ${error}`);}