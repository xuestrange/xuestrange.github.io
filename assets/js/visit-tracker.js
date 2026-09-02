(function () {
    "use strict";

    var script = document.currentScript;
    var endpoint = script && script.dataset.endpoint;

    if (
        !endpoint ||
        navigator.doNotTrack === "1" ||
        window.doNotTrack === "1" ||
        navigator.globalPrivacyControl === true
    ) {
        return;
    }

    endpoint = endpoint.replace(/\/$/, "");

    function sendVisit() {
        var payload = JSON.stringify({
            path: window.location.pathname
        });

        fetch(endpoint + "/collect", {
            method: "POST",
            body: payload,
            mode: "cors",
            credentials: "omit",
            keepalive: true
        }).catch(function () {
            // Analytics must never interfere with the page experience.
        });
    }

    sendVisit();
}());
